// server/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import db from './database.js';
import {
  AiError,
  activeProvider,
  generateText,
  listOllamaModels,
  streamText,
  testConnection,
} from './ai.js';
import {
  clearAnthropicKey,
  describeSettings,
  getAnthropicKey,
  saveConfig,
  setAnthropicKey,
  TIERS,
} from './settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting state (simple in-memory implementation).
// Applied only to the routes that spend money or hold a model busy (chat,
// refine, connection tests) — see where it's mounted below. Library CRUD and
// the static UI are exempt: this is a single-user local app, and flipping
// quickly through chapters must never 429.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  
  const record = rateLimitMap.get(ip);
  
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  record.count++;
  next();
}

// Input validation helpers
function isValidId(id) {
  // Allow alphanumeric IDs between 8-36 characters (covers UUID and short IDs)
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,36}$/.test(id);
}

function isValidTitle(title) {
  return typeof title === 'string' && title.length <= 500;
}

function isValidContent(content) {
  return typeof content === 'string' && content.length <= 5000000; // 5MB text limit
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Basic sanitization - remove null bytes and trim
  return str.replace(/\0/g, '').trim();
}

const CODEX_ENTRY_TYPES = new Set(['person', 'place', 'item', 'event', 'organization', 'other']);
const MAX_CODEX_NAME_LENGTH = 200;
const MAX_CODEX_FIELD_VALUE_LENGTH = 10000;
const MAX_CODEX_FIELDS_JSON = 20000;
const MAX_CODEX_ENTRIES_PER_NOVEL = 500;   // was MAX_CODEX_ENTRIES_PER_DOCUMENT
const MAX_CODEX_CONTEXT_CHARS = 30000;
const MAX_MESSAGE_CONTEXT_ENTRIES = 20;
const MAX_MANUSCRIPT_CONTEXT_CHARS = 120000; // was an inline 50000 for documentContext
const MAX_CHAPTERS_PER_NOVEL = 500;
const MAX_SYNOPSIS_LENGTH = 4000; // index-card synopsis, not a second manuscript

function validateCodexFields(fields) {
  if (fields == null) return { ok: true, json: '{}' };
  if (typeof fields !== 'object' || Array.isArray(fields)) return { ok: false };
  for (const [key, value] of Object.entries(fields)) {
    if (key.length > 100) return { ok: false };
    if (typeof value !== 'string' || value.length > MAX_CODEX_FIELD_VALUE_LENGTH) return { ok: false };
  }
  const json = JSON.stringify(fields);
  if (json.length > MAX_CODEX_FIELDS_JSON) return { ok: false };
  return { ok: true, json };
}

// Snapshot of attached entries stored on a chat message ({id, name, type}[]).
function validateContextEntries(value) {
  if (value == null) return { ok: true, json: null };
  if (!Array.isArray(value) || value.length > MAX_MESSAGE_CONTEXT_ENTRIES) return { ok: false };
  const cleaned = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return { ok: false };
    if (!isValidId(entry.id)) return { ok: false };
    if (typeof entry.name !== 'string' || !entry.name || entry.name.length > MAX_CODEX_NAME_LENGTH) {
      return { ok: false };
    }
    if (!CODEX_ENTRY_TYPES.has(entry.type)) return { ok: false };
    cleaned.push({ id: entry.id, name: entry.name, type: entry.type });
  }
  return { ok: true, json: cleaned.length ? JSON.stringify(cleaned) : null };
}

function formatCodexEntry(row) {
  let fields = {};
  try {
    fields = JSON.parse(row.fields) || {};
  } catch {
    fields = {};
  }
  return {
    id: row.id,
    novelId: row.novel_id,   // was documentId
    type: row.type,
    name: row.name,
    fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function formatNovel(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    lastModified: row.last_modified,
    ...(row.chapter_count !== undefined ? { chapterCount: row.chapter_count } : {}),
    ...(row.word_count !== undefined ? { wordCount: row.word_count } : {}),
  };
}
function formatChapter(row, { withContent = true } = {}) {
  return {
    id: row.id,
    novelId: row.novel_id,
    title: row.title,
    ...(withContent ? { content: row.content } : {}),
    synopsis: row.synopsis ?? '',
    wordCount: row.word_count,
    position: row.position,
    createdAt: row.created_at,
    lastModified: row.last_modified,
  };
}
function novelExists(id) {
  return Boolean(db.prepare('SELECT id FROM novels WHERE id = ?').get(id));
}
/** Any chapter mutation makes the novel "recently modified" for list sorting. */
function touchNovel(novelId, timestamp = new Date().toISOString()) {
  db.prepare('UPDATE novels SET last_modified = ? WHERE id = ?').run(timestamp, novelId);
}
/** Guard every :novelId route in one place. */
function requireNovel(req, res) {
  if (!isValidId(req.params.novelId)) {
    res.status(400).json({ error: 'Invalid novel ID format' });
    return false;
  }
  if (!novelExists(req.params.novelId)) {
    res.status(404).json({ error: 'Novel not found' });
    return false;
  }
  return true;
}

// Configure CORS with specific options
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
// AI-facing routes only (prefix match — '/api/chat' also covers
// '/api/chat/stream'). Everything else is local CRUD against our own SQLite
// and stays unmetered.
app.use(['/api/chat', '/api/refine', '/api/settings/ai/test'], rateLimit);

// Clean up rate limit map periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

// System prompts
const SYSTEM_PROMPTS = {
  refine: `You are a skilled literary editor and prose stylist helping an author refine their novel. Your role is to:
- Maintain the author's unique voice and style
- Preserve narrative flow and pacing
- Keep character consistency
- Honor the existing tone (whether dark, light, literary, commercial, etc.)
When given text to refine with a specific instruction, return ONLY the refined text without any explanation, preamble, or commentary. Do not include phrases like "Here's the refined version" or any meta-commentary. Just output the improved prose directly.
Match the approximate length of the original unless specifically asked to expand or condense.`,
  ideation: `You are a creative writing collaborator with deep knowledge of storytelling, narrative structure, and literary craft. You're helping an author develop their novel.
The author's work is organized as a novel made of ordered chapters. You may be shown an outline of every chapter plus the full prose of the chapters nearest the one they're currently writing.
Your role is to:
- Generate creative ideas while respecting the author's vision
- Offer suggestions for plot development, character arcs, themes, and world-building
- Track continuity across chapters and flag contradictions when you notice them
- Provide thoughtful analysis when asked
- Be encouraging but honest
- Ask clarifying questions when helpful
You have a warm, collegial tone - like a well-read friend who happens to be excellent at brainstorming. You're enthusiastic about good ideas and gentle with critiques.
When the author shares context about their story, remember it and build upon it in future responses.`
};
/** Shared by /api/chat and /api/chat/stream. */
function buildIdeationSystemPrompt(manuscriptContext, codexContext) {
  let prompt = SYSTEM_PROMPTS.ideation;
  if (manuscriptContext && typeof manuscriptContext === 'string') {
    prompt += `\n\nMANUSCRIPT CONTEXT:\n"""${manuscriptContext.slice(0, MAX_MANUSCRIPT_CONTEXT_CHARS)}"""`;
  }
  if (codexContext && typeof codexContext === 'string' && codexContext.trim()) {
    prompt += `\n\nSTORY CODEX (author-curated reference notes about characters, places, items, and events — treat these as canon):\n"""${codexContext.slice(0, MAX_CODEX_CONTEXT_CHARS)}"""`;
  }
  return prompt;
}
function validateChatMessages(messages) {
  if (!messages || !Array.isArray(messages)) return 'Messages array required';
  if (messages.length > 50) return 'Too many messages in conversation';
  for (const msg of messages) {
    if (!msg.role || !['user', 'assistant'].includes(msg.role)) return 'Invalid message role';
    if (typeof msg.content !== 'string' || msg.content.length > 100000) return 'Invalid message content';
  }
  return null;
}

// ============================================
// NOVEL ENDPOINTS
// ============================================
app.get('/api/novels', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT n.id, n.title, n.created_at, n.last_modified,
             COUNT(c.id)                  AS chapter_count,
             COALESCE(SUM(c.word_count),0) AS word_count
      FROM novels n
      LEFT JOIN chapters c ON c.novel_id = n.id
      GROUP BY n.id
      ORDER BY n.last_modified DESC
    `).all();
    res.json(rows.map(formatNovel));
  } catch (error) {
    console.error('Error fetching novels:', error);
    res.status(500).json({ error: 'Failed to fetch novels' });
  }
});
// Novel + its chapter summaries. Content is fetched per-chapter.
app.get('/api/novels/:novelId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const novel = db.prepare('SELECT * FROM novels WHERE id = ?').get(req.params.novelId);
    const chapters = db.prepare(`
      SELECT id, novel_id, title, synopsis, word_count, position, created_at, last_modified
      FROM chapters WHERE novel_id = ?
      ORDER BY position ASC, created_at ASC, rowid ASC
    `).all(req.params.novelId);
    res.json({
      ...formatNovel(novel),
      chapters: chapters.map((row) => formatChapter(row, { withContent: false })),
    });
  } catch (error) {
    console.error('Error fetching novel:', error);
    res.status(500).json({ error: 'Failed to fetch novel' });
  }
});
/**
 * Full prose for every chapter, in reading order. Powers two things:
 *  - the novel-scoped chat context
 *  - the novel-wide codex suggestion scan
 */
app.get('/api/novels/:novelId/manuscript', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const rows = db.prepare(`
      SELECT id, title, position, content, word_count
      FROM chapters WHERE novel_id = ?
      ORDER BY position ASC, created_at ASC, rowid ASC
    `).all(req.params.novelId);
    res.json(rows.map((row) => ({
      id: row.id,
      title: row.title,
      position: row.position,
      wordCount: row.word_count,
      content: row.content,
    })));
  } catch (error) {
    console.error('Error fetching manuscript:', error);
    res.status(500).json({ error: 'Failed to fetch manuscript' });
  }
});
// Creating a novel also creates its first chapter, atomically — an empty novel
// has nothing to edit, and a two-request dance can leave one behind.
const createNovelTx = db.transaction((novelId, title, chapterId, chapterTitle, now) => {
  db.prepare('INSERT INTO novels (id, title, created_at, last_modified) VALUES (?, ?, ?, ?)')
    .run(novelId, title, now, now);
  db.prepare(`
    INSERT INTO chapters (id, novel_id, title, content, word_count, position, created_at, last_modified)
    VALUES (?, ?, ?, '', 0, 0, ?, ?)
  `).run(chapterId, novelId, chapterTitle, now, now);
});
app.post('/api/novels', (req, res) => {
  try {
    const { id: rawId, title } = req.body ?? {};
    const novelId = rawId ?? randomUUID();
    if (!isValidId(novelId)) {
      return res.status(400).json({ error: 'Invalid novel ID format' });
    }
    const sanitizedTitle = sanitizeString(title) || 'Untitled Novel';
    if (!isValidTitle(sanitizedTitle)) {
      return res.status(400).json({ error: 'Title too long' });
    }
    const chapterId = randomUUID();
    const now = new Date().toISOString();
    createNovelTx(novelId, sanitizedTitle, chapterId, 'Chapter One', now);
    const novel = db.prepare('SELECT * FROM novels WHERE id = ?').get(novelId);
    const chapters = db.prepare(`
      SELECT id, novel_id, title, synopsis, word_count, position, created_at, last_modified
      FROM chapters WHERE novel_id = ? ORDER BY position ASC
    `).all(novelId);
    res.status(201).json({
      ...formatNovel(novel),
      chapterCount: chapters.length,
      wordCount: 0,
      chapters: chapters.map((row) => formatChapter(row, { withContent: false })),
    });
  } catch (error) {
    console.error('Error creating novel:', error);
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Novel with this ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create novel' });
  }
});
// Partial update. Today that's just the title; add `author` here if you want it.
app.put('/api/novels/:novelId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { title } = req.body ?? {};
    if (title === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const sanitizedTitle = sanitizeString(title);
    if (!sanitizedTitle || !isValidTitle(sanitizedTitle)) {
      return res.status(400).json({ error: 'Invalid title' });
    }
    db.prepare('UPDATE novels SET title = ?, last_modified = ? WHERE id = ?')
      .run(sanitizedTitle, new Date().toISOString(), req.params.novelId);
    res.json(formatNovel(db.prepare('SELECT * FROM novels WHERE id = ?').get(req.params.novelId)));
  } catch (error) {
    console.error('Error updating novel:', error);
    res.status(500).json({ error: 'Failed to update novel' });
  }
});
// Explicit deletes in addition to ON DELETE CASCADE, matching the old
// deleteDocumentTx: the data goes even if foreign_keys is ever off.
const deleteNovelTx = db.transaction((novelId) => {
  db.prepare('DELETE FROM chat_messages WHERE novel_id = ?').run(novelId);
  db.prepare('DELETE FROM codex_entries WHERE novel_id = ?').run(novelId);
  db.prepare('DELETE FROM codex_dismissed_suggestions WHERE novel_id = ?').run(novelId);
  db.prepare('DELETE FROM chapters WHERE novel_id = ?').run(novelId);
  db.prepare('DELETE FROM novels WHERE id = ?').run(novelId);
});
app.delete('/api/novels/:novelId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    deleteNovelTx(req.params.novelId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting novel:', error);
    res.status(500).json({ error: 'Failed to delete novel' });
  }
});
// ============================================
// CHAPTER ENDPOINTS (scoped to a novel)
// ============================================
function findChapter(novelId, chapterId) {
  return db.prepare('SELECT * FROM chapters WHERE id = ? AND novel_id = ?').get(chapterId, novelId);
}
app.get('/api/novels/:novelId/chapters', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const rows = db.prepare(`
      SELECT id, novel_id, title, synopsis, word_count, position, created_at, last_modified
      FROM chapters WHERE novel_id = ?
      ORDER BY position ASC, created_at ASC, rowid ASC
    `).all(req.params.novelId);
    res.json(rows.map((row) => formatChapter(row, { withContent: false })));
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
});
/**
 * Reorder. Registered BEFORE `/chapters/:chapterId` so "order" can never be
 * mistaken for an id. (It also fails isValidId, so this is belt-and-braces.)
 * Takes the complete desired order — a stale client can't produce duplicates.
 */
const reorderChaptersTx = db.transaction((novelId, chapterIds, now) => {
  const update = db.prepare('UPDATE chapters SET position = ? WHERE id = ? AND novel_id = ?');
  chapterIds.forEach((chapterId, index) => update.run(index, chapterId, novelId));
  touchNovel(novelId, now);
});
app.put('/api/novels/:novelId/chapters/order', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { chapterIds } = req.body ?? {};
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return res.status(400).json({ error: 'chapterIds array required' });
    }
    if (chapterIds.some((id) => !isValidId(id))) {
      return res.status(400).json({ error: 'Invalid chapter ID in order' });
    }
    if (new Set(chapterIds).size !== chapterIds.length) {
      return res.status(400).json({ error: 'Duplicate chapter IDs in order' });
    }
    const existing = db
      .prepare('SELECT id FROM chapters WHERE novel_id = ?')
      .all(req.params.novelId)
      .map((row) => row.id);
    // The order must be a permutation of the novel's chapters — no more, no less.
    if (existing.length !== chapterIds.length || chapterIds.some((id) => !existing.includes(id))) {
      return res.status(400).json({ error: 'chapterIds must list every chapter exactly once' });
    }
    reorderChaptersTx(req.params.novelId, chapterIds, new Date().toISOString());
    const rows = db.prepare(`
      SELECT id, novel_id, title, synopsis, word_count, position, created_at, last_modified
      FROM chapters WHERE novel_id = ? ORDER BY position ASC
    `).all(req.params.novelId);
    res.json(rows.map((row) => formatChapter(row, { withContent: false })));
  } catch (error) {
    console.error('Error reordering chapters:', error);
    res.status(500).json({ error: 'Failed to reorder chapters' });
  }
});
app.get('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    if (!isValidId(req.params.chapterId)) {
      return res.status(400).json({ error: 'Invalid chapter ID format' });
    }
    const chapter = findChapter(req.params.novelId, req.params.chapterId);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    res.json(formatChapter(chapter));
  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({ error: 'Failed to fetch chapter' });
  }
});
const createChapterTx = db.transaction((novelId, chapterId, title, content, wordCount, position, now) => {
  db.prepare(`
    INSERT INTO chapters (id, novel_id, title, content, word_count, position, created_at, last_modified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chapterId, novelId, title, content, wordCount, position, now, now);
  touchNovel(novelId, now);
});
app.post('/api/novels/:novelId/chapters', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { id: rawId, title, content, wordCount } = req.body ?? {};
    const chapterId = rawId ?? randomUUID();
    if (!isValidId(chapterId)) {
      return res.status(400).json({ error: 'Invalid chapter ID format' });
    }
    const count = db
      .prepare('SELECT COUNT(*) AS count FROM chapters WHERE novel_id = ?')
      .get(req.params.novelId).count;
    if (count >= MAX_CHAPTERS_PER_NOVEL) {
      return res.status(400).json({ error: 'Chapter limit reached for this novel' });
    }
    const sanitizedTitle = sanitizeString(title) || `Chapter ${count + 1}`;
    if (!isValidTitle(sanitizedTitle)) return res.status(400).json({ error: 'Title too long' });
    const safeContent = content ?? '';
    if (!isValidContent(safeContent)) return res.status(400).json({ error: 'Content too large' });
    const validWordCount =
      typeof wordCount === 'number' && wordCount >= 0 ? Math.floor(wordCount) : 0;
    createChapterTx(
      req.params.novelId, chapterId, sanitizedTitle, safeContent,
      validWordCount, count, new Date().toISOString()
    );
    res.status(201).json(formatChapter(findChapter(req.params.novelId, chapterId)));
  } catch (error) {
    console.error('Error creating chapter:', error);
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Chapter with this ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create chapter' });
  }
});
/**
 * Partial update: any of { title, content, wordCount }.
 * This is what lets the sidebar rename a chapter without round-tripping
 * its entire body, which the old document PUT forced.
 */
app.put('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    if (!isValidId(req.params.chapterId)) {
      return res.status(400).json({ error: 'Invalid chapter ID format' });
    }
    const existing = findChapter(req.params.novelId, req.params.chapterId);
    if (!existing) return res.status(404).json({ error: 'Chapter not found' });
    const { title, content, wordCount, synopsis } = req.body ?? {};
    let nextTitle = existing.title;
    if (title !== undefined) {
      nextTitle = sanitizeString(title);
      if (!nextTitle || !isValidTitle(nextTitle)) {
        return res.status(400).json({ error: 'Invalid title' });
      }
    }
    let nextContent = existing.content;
    if (content !== undefined) {
      if (!isValidContent(content)) return res.status(400).json({ error: 'Content too large' });
      nextContent = content.replace(/\0/g, '');
    }
    let nextWordCount = existing.word_count;
    if (wordCount !== undefined) {
      nextWordCount = typeof wordCount === 'number' && wordCount >= 0 ? Math.floor(wordCount) : 0;
    }
    let nextSynopsis = existing.synopsis ?? '';
    if (synopsis !== undefined) {
      if (typeof synopsis !== 'string' || synopsis.length > MAX_SYNOPSIS_LENGTH) {
        return res.status(400).json({ error: 'Synopsis too long' });
      }
      nextSynopsis = synopsis.replace(/\0/g, '');
    }
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE chapters SET title = ?, content = ?, word_count = ?, synopsis = ?, last_modified = ?
      WHERE id = ? AND novel_id = ?
    `).run(nextTitle, nextContent, nextWordCount, nextSynopsis, now, req.params.chapterId, req.params.novelId);
    touchNovel(req.params.novelId, now);
    res.json(formatChapter(findChapter(req.params.novelId, req.params.chapterId)));
  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({ error: 'Failed to update chapter' });
  }
});
// Deleting renumbers the survivors so `position` stays contiguous 0..n-1.
const deleteChapterTx = db.transaction((novelId, chapterId, now) => {
  db.prepare('DELETE FROM chapters WHERE id = ? AND novel_id = ?').run(chapterId, novelId);
  const remaining = db
    .prepare('SELECT id FROM chapters WHERE novel_id = ? ORDER BY position ASC, created_at ASC, rowid ASC')
    .all(novelId);
  const update = db.prepare('UPDATE chapters SET position = ? WHERE id = ?');
  remaining.forEach((row, index) => update.run(index, row.id));
  touchNovel(novelId, now);
});
app.delete('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    if (!isValidId(req.params.chapterId)) {
      return res.status(400).json({ error: 'Invalid chapter ID format' });
    }
    if (!findChapter(req.params.novelId, req.params.chapterId)) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    deleteChapterTx(req.params.novelId, req.params.chapterId, new Date().toISOString());
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting chapter:', error);
    res.status(500).json({ error: 'Failed to delete chapter' });
  }
});

// ============================================
// CORKBOARD ENDPOINTS
// ============================================
//
// The corkboard's card arrangement, stored per novel as one JSON value:
//   { mode: 'manuscript' | 'custom', order: [chapterId, ...] }
//
// 'manuscript' mirrors chapters.position (dragging there reorders the real
// manuscript through the normal reorder endpoint). 'custom' is a planning
// order that lives ONLY here — it never touches chapters.position until the
// author explicitly applies it. Stale/missing ids are tolerated on read: the
// client reconciles against the live chapter list.
function readCorkboard(novelRow) {
  let parsed = {};
  try {
    parsed = JSON.parse(novelRow.corkboard || '{}') || {};
  } catch {
    parsed = {};
  }
  return {
    mode: parsed.mode === 'custom' ? 'custom' : 'manuscript',
    order: Array.isArray(parsed.order) ? parsed.order.filter(isValidId) : [],
  };
}

app.get('/api/novels/:novelId/corkboard', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const novel = db.prepare('SELECT corkboard FROM novels WHERE id = ?').get(req.params.novelId);
    res.json(readCorkboard(novel));
  } catch (error) {
    console.error('Error reading corkboard:', error);
    res.status(500).json({ error: 'Failed to read the corkboard' });
  }
});

app.put('/api/novels/:novelId/corkboard', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { mode, order } = req.body ?? {};
    if (!['manuscript', 'custom'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid corkboard mode' });
    }
    if (
      !Array.isArray(order) ||
      order.length > MAX_CHAPTERS_PER_NOVEL ||
      !order.every(isValidId)
    ) {
      return res.status(400).json({ error: 'Invalid corkboard order' });
    }
    const value = JSON.stringify({ mode, order });
    // Deliberately NOT touchNovel(): arranging plans isn't editing prose, and
    // it shouldn't bubble the novel to the top of "recently modified".
    db.prepare('UPDATE novels SET corkboard = ? WHERE id = ?').run(value, req.params.novelId);
    res.json({ mode, order });
  } catch (error) {
    console.error('Error saving corkboard:', error);
    res.status(500).json({ error: 'Failed to save the corkboard' });
  }
});

// ============================================
// CHAPTER SNAPSHOT ENDPOINTS
// ============================================
//
// Scrivener-style point-in-time copies of one chapter's prose. Design notes:
//
//  - The snapshot content is copied from the chapters row, never taken from
//    the request body. The client flushes its autosave first, so "snapshot"
//    always means "what is actually persisted" — the two can't diverge.
//  - Restore is one transaction that FIRST writes an automatic backup snapshot
//    of the current text, THEN overwrites the chapter. Whatever happens on the
//    client afterwards, the pre-restore prose exists in the database.
//  - Restores are never blocked by the per-chapter cap; they prune the oldest
//    automatic backups instead. Manual snapshots are never deleted implicitly.
const MAX_SNAPSHOTS_PER_CHAPTER = 100;
const MAX_SNAPSHOT_NAME_LENGTH = 200;
function formatSnapshot(row, { withContent = false } = {}) {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    novelId: row.novel_id,
    name: row.name,
    kind: row.kind,
    wordCount: row.word_count,
    createdAt: row.created_at,
    ...(withContent ? { content: row.content } : {}),
  };
}
function findSnapshot(chapterId, snapshotId) {
  return db
    .prepare('SELECT * FROM chapter_snapshots WHERE id = ? AND chapter_id = ?')
    .get(snapshotId, chapterId);
}
function countSnapshots(chapterId) {
  return db
    .prepare('SELECT COUNT(*) AS count FROM chapter_snapshots WHERE chapter_id = ?')
    .get(chapterId).count;
}
/** Shared guard for every snapshot route: returns the chapter row or null. */
function requireChapterForSnapshots(req, res) {
  if (!requireNovel(req, res)) return null;
  if (!isValidId(req.params.chapterId)) {
    res.status(400).json({ error: 'Invalid chapter ID format' });
    return null;
  }
  const chapter = findChapter(req.params.novelId, req.params.chapterId);
  if (!chapter) {
    res.status(404).json({ error: 'Chapter not found' });
    return null;
  }
  return chapter;
}
app.get('/api/novels/:novelId/chapters/:chapterId/snapshots', (req, res) => {
  try {
    const chapter = requireChapterForSnapshots(req, res);
    if (!chapter) return;
    const rows = db
      .prepare(
        `SELECT id, chapter_id, novel_id, name, kind, word_count, created_at
           FROM chapter_snapshots WHERE chapter_id = ?
          ORDER BY created_at DESC, rowid DESC`
      )
      .all(chapter.id);
    res.json(rows.map((row) => formatSnapshot(row)));
  } catch (error) {
    console.error('Error listing snapshots:', error);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});
app.post('/api/novels/:novelId/chapters/:chapterId/snapshots', (req, res) => {
  try {
    const chapter = requireChapterForSnapshots(req, res);
    if (!chapter) return;
    const name = sanitizeString(req.body?.name ?? '');
    if (name.length > MAX_SNAPSHOT_NAME_LENGTH) {
      return res.status(400).json({ error: 'Snapshot name too long' });
    }
    if (countSnapshots(chapter.id) >= MAX_SNAPSHOTS_PER_CHAPTER) {
      return res.status(400).json({
        error: `This chapter already has ${MAX_SNAPSHOTS_PER_CHAPTER} snapshots. Delete some before taking more.`,
      });
    }
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO chapter_snapshots (id, chapter_id, novel_id, name, kind, content, word_count, created_at)
       VALUES (?, ?, ?, ?, 'manual', ?, ?, ?)`
    ).run(id, chapter.id, req.params.novelId, name, chapter.content, chapter.word_count, now);
    res.status(201).json(formatSnapshot(findSnapshot(chapter.id, id)));
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});
app.get('/api/novels/:novelId/chapters/:chapterId/snapshots/:snapshotId', (req, res) => {
  try {
    const chapter = requireChapterForSnapshots(req, res);
    if (!chapter) return;
    if (!isValidId(req.params.snapshotId)) {
      return res.status(400).json({ error: 'Invalid snapshot ID format' });
    }
    const snapshot = findSnapshot(chapter.id, req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(formatSnapshot(snapshot, { withContent: true }));
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});
/** Rename only — a snapshot's prose is immutable by design. */
app.put('/api/novels/:novelId/chapters/:chapterId/snapshots/:snapshotId', (req, res) => {
  try {
    const chapter = requireChapterForSnapshots(req, res);
    if (!chapter) return;
    if (!isValidId(req.params.snapshotId)) {
      return res.status(400).json({ error: 'Invalid snapshot ID format' });
    }
    if (!findSnapshot(chapter.id, req.params.snapshotId)) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    const name = sanitizeString(req.body?.name ?? '');
    if (name.length > MAX_SNAPSHOT_NAME_LENGTH) {
      return res.status(400).json({ error: 'Snapshot name too long' });
    }
    db.prepare('UPDATE chapter_snapshots SET name = ? WHERE id = ?').run(
      name,
      req.params.snapshotId
    );
    res.json(formatSnapshot(findSnapshot(chapter.id, req.params.snapshotId)));
  } catch (error) {
    console.error('Error renaming snapshot:', error);
    res.status(500).json({ error: 'Failed to rename snapshot' });
  }
});
app.delete('/api/novels/:novelId/chapters/:chapterId/snapshots/:snapshotId', (req, res) => {
  try {
    const chapter = requireChapterForSnapshots(req, res);
    if (!chapter) return;
    if (!isValidId(req.params.snapshotId)) {
      return res.status(400).json({ error: 'Invalid snapshot ID format' });
    }
    const result = db
      .prepare('DELETE FROM chapter_snapshots WHERE id = ? AND chapter_id = ?')
      .run(req.params.snapshotId, chapter.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Snapshot not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});
/**
 * Atomic: backup of the current text, then the overwrite. If any step throws,
 * SQLite rolls the whole thing back and the chapter is untouched.
 */
const restoreSnapshotTx = db.transaction((novelId, chapter, snapshot, now) => {
  const backupId = randomUUID();
  db.prepare(
    `INSERT INTO chapter_snapshots (id, chapter_id, novel_id, name, kind, content, word_count, created_at)
     VALUES (?, ?, ?, '', 'auto', ?, ?, ?)`
  ).run(backupId, chapter.id, novelId, chapter.content, chapter.word_count, now);
  // Over the cap? Reclaim space from old automatic backups only — deleting an
  // author's deliberate snapshot to make room would defeat the feature.
  const excess = countSnapshots(chapter.id) - MAX_SNAPSHOTS_PER_CHAPTER;
  if (excess > 0) {
    db.prepare(
      `DELETE FROM chapter_snapshots WHERE id IN (
         SELECT id FROM chapter_snapshots
          WHERE chapter_id = ? AND kind = 'auto' AND id != ?
          ORDER BY created_at ASC, rowid ASC LIMIT ?
       )`
    ).run(chapter.id, backupId, excess);
  }
  db.prepare(
    'UPDATE chapters SET content = ?, word_count = ?, last_modified = ? WHERE id = ?'
  ).run(snapshot.content, snapshot.word_count, now, chapter.id);
  touchNovel(novelId, now);
  return backupId;
});
app.post(
  '/api/novels/:novelId/chapters/:chapterId/snapshots/:snapshotId/restore',
  (req, res) => {
    try {
      const chapter = requireChapterForSnapshots(req, res);
      if (!chapter) return;
      if (!isValidId(req.params.snapshotId)) {
        return res.status(400).json({ error: 'Invalid snapshot ID format' });
      }
      const snapshot = findSnapshot(chapter.id, req.params.snapshotId);
      if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
      const backupId = restoreSnapshotTx(
        req.params.novelId,
        chapter,
        snapshot,
        new Date().toISOString()
      );
      res.json({
        chapter: formatChapter(findChapter(req.params.novelId, chapter.id)),
        backup: formatSnapshot(findSnapshot(chapter.id, backupId)),
      });
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      res.status(500).json({ error: 'Failed to restore snapshot' });
    }
  }
);

// ============================================
// CHAT MESSAGE ENDPOINTS (scoped to a NOVEL)
// ============================================
const MAX_CHAT_MESSAGE_LENGTH = 100000;
function isValidRole(role) {
  return role === 'user' || role === 'assistant';
}
function formatMessage(row) {
  let contextEntries = null;
  if (row.context_entries) {
    try {
      contextEntries = JSON.parse(row.context_entries);
    } catch {
      contextEntries = null;
    }
  }
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    contextEntries,
  };
}
app.get('/api/novels/:novelId/messages', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const rows = db.prepare(`
      SELECT id, role, content, created_at, context_entries
      FROM chat_messages WHERE novel_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(req.params.novelId);
    res.json(rows.map(formatMessage));
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});
app.post('/api/novels/:novelId/messages', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { id: rawMessageId, role, content, createdAt } = req.body;
    if (!isValidRole(role)) return res.status(400).json({ error: 'Invalid message role' });
    if (typeof content !== 'string' || content.length > MAX_CHAT_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Invalid message content' });
    }
    const contextResult = validateContextEntries(req.body.contextEntries);
    if (!contextResult.ok) return res.status(400).json({ error: 'Invalid context entries' });
    const messageId = rawMessageId ?? randomUUID();
    if (!isValidId(messageId)) return res.status(400).json({ error: 'Invalid message ID format' });
    const timestamp =
      typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))
        ? new Date(createdAt).toISOString()
        : new Date().toISOString();
    const safeContent = content.replace(/\0/g, '');
    db.prepare(`
      INSERT INTO chat_messages (id, novel_id, role, content, created_at, context_entries)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET content = excluded.content
      WHERE chat_messages.novel_id = excluded.novel_id
    `).run(messageId, req.params.novelId, role, safeContent, timestamp, contextResult.json);
    const row = db.prepare(
      'SELECT id, role, content, created_at, context_entries FROM chat_messages WHERE id = ?'
    ).get(messageId);
    res.status(201).json(formatMessage(row));
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Failed to save chat message' });
  }
});
app.delete('/api/novels/:novelId/messages', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    db.prepare('DELETE FROM chat_messages WHERE novel_id = ?').run(req.params.novelId);
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing chat messages:', error);
    res.status(500).json({ error: 'Failed to clear chat messages' });
  }
});
// ============================================
// CODEX ENDPOINTS (scoped to a NOVEL)
// ============================================
app.get('/api/novels/:novelId/codex', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const rows = db.prepare(`
      SELECT * FROM codex_entries WHERE novel_id = ?
      ORDER BY type ASC, name COLLATE NOCASE ASC
    `).all(req.params.novelId);
    res.json(rows.map(formatCodexEntry));
  } catch (error) {
    console.error('Error fetching codex entries:', error);
    res.status(500).json({ error: 'Failed to fetch codex entries' });
  }
});
app.post('/api/novels/:novelId/codex', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { id: rawEntryId, type, name, fields } = req.body;
    if (!CODEX_ENTRY_TYPES.has(type)) return res.status(400).json({ error: 'Invalid codex entry type' });
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length > MAX_CODEX_NAME_LENGTH) {
      return res.status(400).json({ error: 'Invalid entry name' });
    }
    const fieldsResult = validateCodexFields(fields);
    if (!fieldsResult.ok) return res.status(400).json({ error: 'Invalid entry fields' });
    const count = db
      .prepare('SELECT COUNT(*) AS count FROM codex_entries WHERE novel_id = ?')
      .get(req.params.novelId).count;
    if (count >= MAX_CODEX_ENTRIES_PER_NOVEL) {
      return res.status(400).json({ error: 'Codex entry limit reached for this novel' });
    }
    const entryId = rawEntryId ?? randomUUID();
    if (!isValidId(entryId)) return res.status(400).json({ error: 'Invalid entry ID format' });
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO codex_entries (id, novel_id, type, name, fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, req.params.novelId, type, sanitizedName, fieldsResult.json, now, now);
    res.status(201).json(formatCodexEntry(db.prepare('SELECT * FROM codex_entries WHERE id = ?').get(entryId)));
  } catch (error) {
    console.error('Error creating codex entry:', error);
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Entry with this ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create codex entry' });
  }
});
app.put('/api/novels/:novelId/codex/:entryId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { entryId } = req.params;
    const { type, name, fields } = req.body;
    if (!isValidId(entryId)) return res.status(400).json({ error: 'Invalid ID format' });
    const existing = db
      .prepare('SELECT * FROM codex_entries WHERE id = ? AND novel_id = ?')
      .get(entryId, req.params.novelId);
    if (!existing) return res.status(404).json({ error: 'Codex entry not found' });
    const nextType = type !== undefined ? type : existing.type;
    if (!CODEX_ENTRY_TYPES.has(nextType)) return res.status(400).json({ error: 'Invalid codex entry type' });
    let nextName = existing.name;
    if (name !== undefined) {
      nextName = sanitizeString(name);
      if (!nextName || nextName.length > MAX_CODEX_NAME_LENGTH) {
        return res.status(400).json({ error: 'Invalid entry name' });
      }
    }
    let nextFieldsJson = existing.fields;
    if (fields !== undefined) {
      const fieldsResult = validateCodexFields(fields);
      if (!fieldsResult.ok) return res.status(400).json({ error: 'Invalid entry fields' });
      nextFieldsJson = fieldsResult.json;
    }
    db.prepare(`
      UPDATE codex_entries SET type = ?, name = ?, fields = ?, updated_at = ?
      WHERE id = ? AND novel_id = ?
    `).run(nextType, nextName, nextFieldsJson, new Date().toISOString(), entryId, req.params.novelId);
    res.json(formatCodexEntry(db.prepare('SELECT * FROM codex_entries WHERE id = ?').get(entryId)));
  } catch (error) {
    console.error('Error updating codex entry:', error);
    res.status(500).json({ error: 'Failed to update codex entry' });
  }
});
app.delete('/api/novels/:novelId/codex/:entryId', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    if (!isValidId(req.params.entryId)) return res.status(400).json({ error: 'Invalid ID format' });
    const result = db
      .prepare('DELETE FROM codex_entries WHERE id = ? AND novel_id = ?')
      .run(req.params.entryId, req.params.novelId);
    if (result.changes === 0) return res.status(404).json({ error: 'Codex entry not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting codex entry:', error);
    res.status(500).json({ error: 'Failed to delete codex entry' });
  }
});
// --- Codex suggestion dismissals (scoped to a NOVEL) --------------------
const normalizeSuggestionName = (name) =>
  String(name)
    .replace(/[\u2018\u2019\u02BC\u2032\u00B4]/g, "'") // must match canonicalizeApostrophes()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
app.get('/api/novels/:novelId/codex-dismissals', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const rows = db.prepare(`
      SELECT name_key, name, created_at FROM codex_dismissed_suggestions
      WHERE novel_id = ? ORDER BY name COLLATE NOCASE
    `).all(req.params.novelId);
    res.json(rows.map((row) => ({ nameKey: row.name_key, name: row.name, createdAt: row.created_at })));
  } catch (error) {
    console.error('Failed to list codex dismissals:', error);
    res.status(500).json({ error: 'Failed to list dismissed suggestions' });
  }
});
app.post('/api/novels/:novelId/codex-dismissals', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      return res.status(400).json({ error: 'A non-empty name (≤200 chars) is required' });
    }
    const trimmed = name.trim();
    const nameKey = normalizeSuggestionName(trimmed);
    db.prepare(`
      INSERT INTO codex_dismissed_suggestions (novel_id, name_key, name, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(novel_id, name_key) DO NOTHING
    `).run(req.params.novelId, nameKey, trimmed, new Date().toISOString());
    res.status(201).json({ nameKey, name: trimmed });
  } catch (error) {
    console.error('Failed to dismiss codex suggestion:', error);
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});
app.delete('/api/novels/:novelId/codex-dismissals/:nameKey', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    db.prepare('DELETE FROM codex_dismissed_suggestions WHERE novel_id = ? AND name_key = ?')
      .run(req.params.novelId, normalizeSuggestionName(req.params.nameKey));
    res.status(204).end();
  } catch (error) {
    console.error('Failed to restore codex suggestion:', error);
    res.status(500).json({ error: 'Failed to restore suggestion' });
  }
});
app.delete('/api/novels/:novelId/codex-dismissals', (req, res) => {
  try {
    if (!requireNovel(req, res)) return;
    db.prepare('DELETE FROM codex_dismissed_suggestions WHERE novel_id = ?').run(req.params.novelId);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to restore codex suggestions:', error);
    res.status(500).json({ error: 'Failed to restore suggestions' });
  }
});

// ============================================
// AI ENDPOINTS
// ============================================

/** Route metadata the client is allowed to see (and show to the author). */
function describeRoute(route) {
  return {
    provider: route.provider,
    model: route.model,
    tier: route.tier,
    requestedTier: route.requestedTier,
    substituted: route.substituted,
    reason: route.reason,
    automatic: route.automatic,
  };
}

/** Turn a chat request body into routing signals. */
function chatSignals(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((message) => message.role === 'user');
  return {
    task: 'chat',
    contextChars:
      (typeof body.manuscriptContext === 'string' ? body.manuscriptContext.length : 0) +
      (typeof body.codexContext === 'string' ? body.codexContext.length : 0),
    messageChars: lastUser?.content?.length ?? 0,
    scope: typeof body.contextScope === 'string' ? body.contextScope : null,
    intentText: lastUser?.content ?? '',
    requestedTier: body.tier,
  };
}

// Refine endpoint - for inline text refinement
app.post('/api/refine', async (req, res) => {
  try {
    const { selectedText, instruction, precedingContext } = req.body;

    if (!selectedText || typeof selectedText !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid selectedText' });
    }
    
    if (!instruction || typeof instruction !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid instruction' });
    }
    
    // Limit text sizes to prevent abuse
    if (selectedText.length > 50000) {
      return res.status(400).json({ error: 'Selected text too large' });
    }
    
    if (instruction.length > 1000) {
      return res.status(400).json({ error: 'Instruction too long' });
    }

    const safeContext = typeof precedingContext === 'string'
      ? precedingContext.slice(0, 5000)
      : '[Beginning of the chapter]';

    const userMessage = `PRECEDING CONTEXT (for narrative flow understanding):
"""
${safeContext}
"""

TEXT TO REFINE:
"""
${selectedText}
"""

INSTRUCTION: ${instruction}`;

    const { text, route } = await generateText({
      system: SYSTEM_PROMPTS.refine,
      maxTokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      signals: {
        task: 'refine',
        selectionChars: selectedText.length,
        contextChars: safeContext.length,
        intentText: instruction,
        requestedTier: req.body?.tier,
      },
    });

    res.json({ refinedText: text.trim(), route: describeRoute(route) });
  } catch (error) {
    if (error instanceof AiError) {
      console.error('Refine error:', error.code, error.message);
      return res.status(error.status).json(error.toJSON());
    }
    console.error('Refine error:', error);
    res.status(500).json({ error: 'Failed to refine text', code: 'unknown' });
  }
});

// Chat endpoint - for ideation sidebar
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, manuscriptContext, codexContext } = req.body; // was documentContext
    const invalid = validateChatMessages(messages);
    if (invalid) return res.status(400).json({ error: invalid });
    const { text, route } = await generateText({
      system: buildIdeationSystemPrompt(manuscriptContext, codexContext),
      maxTokens: 4096,
      messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
      signals: chatSignals(req.body),
    });
    res.json({ message: text, route: describeRoute(route) });
  } catch (error) {
    if (error instanceof AiError) {
      console.error('Chat error:', error.code, error.message);
      return res.status(error.status).json(error.toJSON());
    }
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response', code: 'unknown' });
  }
});

// Streaming endpoint for chat
app.post('/api/chat/stream', async (req, res) => {
  const { messages, manuscriptContext, codexContext } = req.body;
  const invalid = validateChatMessages(messages);
  if (invalid) return res.status(400).json({ error: invalid, code: 'invalid_request' });

  let headersSent = false;
  const startStream = () => {
    if (headersSent) return;
    headersSent = true;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  };

  try {
    await streamText({
      system: buildIdeationSystemPrompt(manuscriptContext, codexContext),
      maxTokens: 4096,
      messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
      signals: chatSignals(req.body),
      // Announced before the first token so the UI can say which model is
      // answering while it's still streaming.
      onRoute: (route) => {
        startStream();
        res.write(`data: ${JSON.stringify({ route: describeRoute(route) })}\n\n`);
      },
      onText: (text) => {
        // Headers are deferred until the first token, so a provider that
        // fails up front can still answer with a clean JSON error.
        startStream();
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      },
    });
    startStream();
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const payload =
      error instanceof AiError
        ? error.toJSON()
        : { error: 'Failed to stream response', code: 'unknown' };
    console.error('Stream error:', payload.code, payload.error);

    if (!headersSent) {
      return res.status(error instanceof AiError ? error.status : 500).json(payload);
    }
    // Mid-stream: the client has prose on screen already, so hand it the
    // failure as a final event instead of severing the connection.
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ============================================
// AI SETTINGS ENDPOINTS
// ============================================

/** Never returns the API key itself — only whether one exists, and a hint. */
app.get('/api/settings/ai', (req, res) => {
  try {
    res.json(describeSettings());
  } catch (error) {
    console.error('Settings read error:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

app.put('/api/settings/ai', (req, res) => {
  try {
    const { provider, anthropicTiers, ollamaBaseUrl, ollamaTiers, routing } = req.body ?? {};
    const patch = {};

    const validTierMap = (value) =>
      value &&
      typeof value === 'object' &&
      Object.entries(value).every(
        ([tier, model]) =>
          TIERS.includes(tier) && typeof model === 'string' && model.length <= 200
      );

    if (provider !== undefined) {
      if (!['anthropic', 'ollama'].includes(provider)) {
        return res.status(400).json({ error: 'Unknown provider', code: 'invalid_request' });
      }
      patch.provider = provider;
    }
    if (anthropicTiers !== undefined) {
      if (!validTierMap(anthropicTiers)) {
        return res.status(400).json({ error: 'Invalid tier models', code: 'invalid_request' });
      }
      patch.anthropicTiers = anthropicTiers;
    }
    if (ollamaBaseUrl !== undefined) {
      if (typeof ollamaBaseUrl !== 'string' || ollamaBaseUrl.length > 500) {
        return res.status(400).json({ error: 'Invalid base URL', code: 'invalid_request' });
      }
      patch.ollamaBaseUrl = ollamaBaseUrl.trim();
    }
    if (ollamaTiers !== undefined) {
      if (!validTierMap(ollamaTiers)) {
        return res.status(400).json({ error: 'Invalid tier models', code: 'invalid_request' });
      }
      patch.ollamaTiers = Object.fromEntries(
        Object.entries(ollamaTiers).map(([tier, model]) => [tier, model.trim()])
      );
    }
    if (routing !== undefined) {
      if (
        !routing ||
        typeof routing !== 'object' ||
        !['auto', 'fixed'].includes(routing.mode) ||
        (routing.fixedTier !== undefined && !TIERS.includes(routing.fixedTier))
      ) {
        return res.status(400).json({ error: 'Invalid routing', code: 'invalid_request' });
      }
      patch.routing = routing;
    }

    saveConfig(patch);
    res.json(describeSettings());
  } catch (error) {
    console.error('Settings write error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/** Write-only: the key goes in, a masked description comes back. */
app.put('/api/settings/ai/key', (req, res) => {
  try {
    const { apiKey } = req.body ?? {};
    if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || apiKey.length > 500) {
      return res.status(400).json({ error: 'That does not look like an API key.', code: 'invalid_request' });
    }
    setAnthropicKey(apiKey.trim());
    res.json(describeSettings());
  } catch (error) {
    console.error('Key write error:', error);
    res.status(500).json({ error: 'Failed to store the API key' });
  }
});

app.delete('/api/settings/ai/key', (req, res) => {
  try {
    clearAnthropicKey();
    const { source } = getAnthropicKey();
    res.json({ ...describeSettings(), fellBackToEnv: source === 'env' });
  } catch (error) {
    console.error('Key delete error:', error);
    res.status(500).json({ error: 'Failed to remove the API key' });
  }
});

/** Lists the models a local Ollama has pulled. */
app.get('/api/settings/ai/ollama/models', async (req, res) => {
  try {
    const models = await listOllamaModels(req.query.baseUrl);
    res.json({ models });
  } catch (error) {
    if (error instanceof AiError) return res.status(error.status).json(error.toJSON());
    console.error('Ollama model list error:', error);
    res.status(500).json({ error: 'Failed to list models', code: 'unknown' });
  }
});

/** Dry-run the saved or proposed configuration. */
app.post('/api/settings/ai/test', async (req, res) => {
  try {
    res.json(await testConnection(req.body ?? {}));
  } catch (error) {
    if (error instanceof AiError) return res.status(error.status).json(error.toJSON());
    console.error('Connection test error:', error);
    res.status(500).json({ error: 'Connection test failed', code: 'unknown' });
  }
});

// ============================================
// STATIC UI (desktop / production mode)
// ============================================
//
// When EXLIBRIS_STATIC_DIR points at a Vite build, the API server also serves
// the UI so the desktop window talks to a single same-origin address and no
// CORS or port juggling is needed. `npm run dev` never sets this — Vite serves
// the UI there.
const STATIC_DIR = process.env.EXLIBRIS_STATIC_DIR;
if (STATIC_DIR) {
  // Static mode is where this server faces a full browser engine, so pin down
  // what the page may do. Notes on the allowances:
  //   - style-src 'unsafe-inline': ProseMirror injects <style> elements and
  //     React writes style attributes; scripts stay 'self'-only regardless.
  //   - fonts.googleapis.com / fonts.gstatic.com: the theme fonts
  //     (ThemeProvider injects the <link> stylesheet).
  //   - img/worker blob:/data:: export previews and generated files.
  // Dev is untouched — Vite serves the UI there and this branch never runs.
  const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.static(STATIC_DIR));
  // SPA fallback: anything that isn't an API route gets the app shell.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}
// ============================================
// STARTUP
// ============================================
/**
 * Boot the HTTP listener. Exported so the Electron shell can embed this
 * server, pick a free port, and wait for it to be ready before opening the
 * window. Binds to loopback only: this is a personal, local app.
 */
export function startServer(port = PORT, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const { provider, model, tier } = activeProvider();
      console.log(`Ex Libris API server running on port ${server.address().port}`);
      console.log(
        `[exlibris] AI provider: ${provider} — ${tier} tier resolves to ${model || 'no model assigned'}`
      );
      resolve(server);
    });
    server.on('error', reject);
  });
}
// Auto-start when executed directly (`node server/index.js`, i.e. npm run dev).
// When imported as a module (the Electron shell), the importer calls
// startServer() itself.
const runDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
