import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting state (simple in-memory implementation)
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

// Configure CORS with specific options
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);

// Clean up rate limit map periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

Your role is to:
- Generate creative ideas while respecting the author's vision
- Offer suggestions for plot development, character arcs, themes, and world-building
- Provide thoughtful analysis when asked
- Be encouraging but honest
- Ask clarifying questions when helpful

You have a warm, collegial tone - like a well-read friend who happens to be excellent at brainstorming. You're enthusiastic about good ideas and gentle with critiques.

When the author shares context about their story, remember it and build upon it in future responses.`
};

// ============================================
// DOCUMENT ENDPOINTS
// ============================================

// Get all documents (metadata only for list view)
app.get('/api/documents', (req, res) => {
  try {
    const documents = db.prepare(`
      SELECT id, title, word_count, created_at, last_modified 
      FROM documents 
      ORDER BY last_modified DESC
    `).all();
    
    const formatted = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      wordCount: doc.word_count,
      createdAt: doc.created_at,
      lastModified: doc.last_modified,
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document with content
app.get('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    
    const document = db.prepare(`
      SELECT * FROM documents WHERE id = ?
    `).get(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Create new document
app.post('/api/documents', (req, res) => {
  try {
    const { id, title, content, wordCount } = req.body;
    
    // Validate inputs
    if (!id || !isValidId(id)) {
      return res.status(400).json({ error: 'Invalid or missing document ID' });
    }
    
    const sanitizedTitle = sanitizeString(title) || 'Untitled';
    if (!isValidTitle(sanitizedTitle)) {
      return res.status(400).json({ error: 'Title too long' });
    }
    
    const sanitizedContent = content || '';
    if (!isValidContent(sanitizedContent)) {
      return res.status(400).json({ error: 'Content too large' });
    }
    
    const validWordCount = typeof wordCount === 'number' && wordCount >= 0 
      ? Math.floor(wordCount) 
      : 0;
    
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO documents (id, title, content, word_count, created_at, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, sanitizedTitle, sanitizedContent, validWordCount, now, now);
    
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    
    res.status(201).json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error creating document:', error);
    
    // Check for duplicate ID
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Document with this ID already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document
app.put('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, wordCount } = req.body;
    
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const sanitizedTitle = sanitizeString(title);
    if (!isValidTitle(sanitizedTitle)) {
      return res.status(400).json({ error: 'Title too long' });
    }
    
    if (!isValidContent(content)) {
      return res.status(400).json({ error: 'Content too large' });
    }
    
    const validWordCount = typeof wordCount === 'number' && wordCount >= 0 
      ? Math.floor(wordCount) 
      : 0;
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE documents 
      SET title = ?, content = ?, word_count = ?, last_modified = ?
      WHERE id = ?
    `).run(sanitizedTitle, content, validWordCount, now, id);
    
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
app.delete('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ============================================
// AI ENDPOINTS
// ============================================

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
      : '[Beginning of document]';

    const userMessage = `PRECEDING CONTEXT (for narrative flow understanding):
"""
${safeContext}
"""

TEXT TO REFINE:
"""
${selectedText}
"""

INSTRUCTION: ${instruction}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.refine,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const refinedText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    res.json({ refinedText });
  } catch (error) {
    console.error('Refine error:', error);
    res.status(500).json({ error: 'Failed to refine text' });
  }
});

// Chat endpoint - for ideation sidebar
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, documentContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    
    // Validate message structure
    if (messages.length > 50) {
      return res.status(400).json({ error: 'Too many messages in conversation' });
    }
    
    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
      if (typeof msg.content !== 'string' || msg.content.length > 100000) {
        return res.status(400).json({ error: 'Invalid message content' });
      }
    }

    let systemPrompt = SYSTEM_PROMPTS.ideation;
    if (documentContext && typeof documentContext === 'string') {
      // Limit context size
      const truncatedContext = documentContext.slice(0, 50000);
      systemPrompt += `\n\nCURRENT DOCUMENT CONTEXT:\n"""${truncatedContext}"""`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Streaming endpoint for chat
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, documentContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    
    // Validate message structure
    if (messages.length > 50) {
      return res.status(400).json({ error: 'Too many messages in conversation' });
    }
    
    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
      if (typeof msg.content !== 'string' || msg.content.length > 100000) {
        return res.status(400).json({ error: 'Invalid message content' });
      }
    }

    let systemPrompt = SYSTEM_PROMPTS.ideation;
    if (documentContext && typeof documentContext === 'string') {
      const truncatedContext = documentContext.slice(0, 50000);
      systemPrompt += `\n\nCURRENT DOCUMENT CONTEXT:\n"""${truncatedContext}"""`;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    // If headers already sent, just end the response
    if (res.headersSent) {
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to stream response' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Ex Libris API server running on port ${PORT}`);
});
