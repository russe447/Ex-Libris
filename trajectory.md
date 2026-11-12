This is a solid feature. Let me study the existing pieces I need to integrate with — editor store autosave mechanics, chapter routes, and the toolbar:


▸
❯ cd /workspace && sed -n 60,138p src/stores/editorStore.ts, cd /workspace && grep -n "chapters" server/index.js | grep … +4
cd /workspace && sed -n 60,138p src/stores/editorStore.ts
IN
cd /workspace && sed -n 60,138p src/stores/editorStore.ts
OUT
      lastSaved: null,
      saveError: null,
      shadowSuggestion: null,
    });
  },
  loadChapter: (chapter) =>
    set({
      chapterId: chapter.id,
      novelId: chapter.novelId,
      content: chapter.content,
      wordCount: chapter.wordCount,
      isLoadingChapter: false,
      hasUnsavedChanges: false,
      lastSaved: chapter.lastModified,
      saveError: null,
      shadowSuggestion: null,
    }),
  closeChapter: () => {
    cancelPendingAutosave();
    set({
      chapterId: null,
      novelId: null,
      content: '',
      wordCount: 0,
      isLoadingChapter: false,
      hasUnsavedChanges: false,
      lastSaved: null,
      saveError: null,
      shadowSuggestion: null,
    });
  },
  // Called synchronously from TipTap's onUpdate. The *store* owns the debounce
  // now, so the buffer is never newer than what flush() can see.
  setContent: (content) => {
    const { chapterId, content: current } = get();
    if (!chapterId || content === current) return;
    set({ content, wordCount: countWords(content), hasUnsavedChanges: true });
    cancelPendingAutosave();
    autosaveTimeout = setTimeout(() => {
      void get().saveNow();
    }, AUTOSAVE_DELAY);
  },
  saveNow: async () => {
    const { chapterId, novelId, content, wordCount, isSaving, hasUnsavedChanges } = get();
    if (!chapterId || !novelId || isSaving || !hasUnsavedChanges) return;
    cancelPendingAutosave();
    set({ isSaving: true, saveError: null });
    try {
      await chaptersService.updateChapter(novelId, chapterId, { content, wordCount });
      // A chapter switch may have landed mid-flight — don't clobber the new buffer.
      if (get().chapterId !== chapterId) {
        set({ isSaving: false });
        return;
      }
      set({ isSaving: false, lastSaved: new Date(), hasUnsavedChanges: false });
    } catch (error) {
      console.error('Failed to save chapter:', error);
      set({ isSaving: false, saveError: 'Could not save this chapter.' });
    }
  },
  flush: async () => {
    cancelPendingAutosave();
    if (get().hasUnsavedChanges) await get().saveNow();
  },
  setShadowSuggestion: (suggestion) => set({ shadowSuggestion: suggestion }),
  acceptSuggestion: () => {
    const { shadowSuggestion } = get();
    if (!shadowSuggestion) return null;
    const result = {
      from: shadowSuggestion.position.from,
      to: shadowSuggestion.position.to,
      text: shadowSuggestion.suggestedText,
    };
    set({ shadowSuggestion: null });
    return result;
  },
  rejectSuggestion: () => set({ shadowSuggestion: null }),
  setIsRefining: (isRefining) => set({ isRefining }),
}));
1794k tokens left
cd /workspace && grep -n "chapters" server/index.js | grep -n "app\.\(get\|post\|put\|delete\)" | head; grep -n "app\." server/index.js | sed -n 1,40p
IN
cd /workspace && grep -n "chapters" server/index.js | grep -n "app\.\(get\|post\|put\|delete\)" | head; grep -n "app\." server/index.js | sed -n 1,40p
OUT
16:402:app.get('/api/novels/:novelId/chapters', (req, res) => {
22:426:app.put('/api/novels/:novelId/chapters/order', (req, res) => {
28:458:app.get('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
30:479:app.post('/api/novels/:novelId/chapters', (req, res) => {
32:517:app.put('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
37:564:app.delete('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
191:app.use(cors(corsOptions));
192:app.use(express.json({ limit: '10mb' }));
196:app.use(['/api/chat', '/api/refine', '/api/settings/ai/test'], rateLimit);
253:app.get('/api/novels', (req, res) => {
271:app.get('/api/novels/:novelId', (req, res) => {
294:app.get('/api/novels/:novelId/manuscript', (req, res) => {
324:app.post('/api/novels', (req, res) => {
358:app.put('/api/novels/:novelId', (req, res) => {
386:app.delete('/api/novels/:novelId', (req, res) => {
402:app.get('/api/novels/:novelId/chapters', (req, res) => {
426:app.put('/api/novels/:novelId/chapters/order', (req, res) => {
458:app.get('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
479:app.post('/api/novels/:novelId/chapters', (req, res) => {
517:app.put('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
564:app.delete('/api/novels/:novelId/chapters/:chapterId', (req, res) => {
604:app.get('/api/novels/:novelId/messages', (req, res) => {
618:app.post('/api/novels/:novelId/messages', (req, res) => {
650:app.delete('/api/novels/:novelId/messages', (req, res) => {
663:app.get('/api/novels/:novelId/codex', (req, res) => {
676:app.post('/api/novels/:novelId/codex', (req, res) => {
709:app.put('/api/novels/:novelId/codex/:entryId', (req, res) => {
744:app.delete('/api/novels/:novelId/codex/:entryId', (req, res) => {
765:app.get('/api/novels/:novelId/codex-dismissals', (req, res) => {
778:app.post('/api/novels/:novelId/codex-dismissals', (req, res) => {
798:app.delete('/api/novels/:novelId/codex-dismissals/:nameKey', (req, res) => {
809:app.delete('/api/novels/:novelId/codex-dismissals', (req, res) => {
854:app.post('/api/refine', async (req, res) => {
916:app.post('/api/chat', async (req, res) => {
939:app.post('/api/chat/stream', async (req, res) => {
999:app.get('/api/settings/ai', (req, res) => {
1008:app.put('/api/settings/ai', (req, res) => {
1068:app.put('/api/settings/ai/key', (req, res) => {
1082:app.delete('/api/settings/ai/key', (req, res) => {
1094:app.get('/api/settings/ai/ollama/models', async (req, res) => {
1106:app.post('/api/settings/ai/test', async (req, res) => {
1147:  app.use((req, res, next) => {
1152:  app.use(express.static(STATIC_DIR));
1154:  app.get(/^\/(?!api\/).*/, (req, res) => {
1166: * window. Binds to loopback only: this is a personal, local app.
1170:    const server = app.listen(port, host, () => {
1792k tokens left
cd /workspace && sed -n 458,605p server/index.js
IN
cd /workspace && sed -n 458,605p server/index.js
OUT
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
    const { title, content, wordCount } = req.body ?? {};
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
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE chapters SET title = ?, content = ?, word_count = ?, last_modified = ?
      WHERE id = ? AND novel_id = ?
    `).run(nextTitle, nextContent, nextWordCount, now, req.params.chapterId, req.params.novelId);
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
1790k tokens left
cd /workspace && grep -n "findChapter" server/index.js | head -2 && sed -n /dev/null; grep -n "function findChapter" -A 5 server/index.js; sed -n 1,60p src/components/editor/EditorToolbar.tsx; sed -n 1,45p src/services/chapters.ts
IN
cd /workspace && grep -n "findChapter" server/index.js | head -2 && sed -n /dev/null; grep -n "function findChapter" -A 5 server/index.js; sed -n 1,60p src/components/editor/EditorToolbar.tsx; sed -n 1,45p src/services/chapters.ts
OUT
399:function findChapter(novelId, chapterId) {
464:    const chapter = findChapter(req.params.novelId, req.params.chapterId);
399:function findChapter(novelId, chapterId) {
400-  return db.prepare('SELECT * FROM chapters WHERE id = ? AND novel_id = ?').get(chapterId, novelId);
401-}
402-app.get('/api/novels/:novelId/chapters', (req, res) => {
403-  try {
404-    if (!requireNovel(req, res)) return;
// src/components/editor/EditorToolbar.tsx
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolItem {
  type?: 'separator';
  icon?: React.ComponentType<{ className?: string }>;
  action?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label?: string;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const tools: ToolItem[] = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: 'Italic',
    },
    {
      icon: Underline,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      label: 'Underline',
    },
    { type: 'separator' },
    {
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      label: 'Heading 1',
import { Chapter, ChapterSummary } from '@/types';
import { toChapterSummary } from '@/services/novels';
import { API_URL } from '@/services/apiBase';
interface ApiChapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  wordCount: number;
  position: number;
  createdAt: string;
  lastModified: string;
}
function toChapter(chapter: ApiChapter): Chapter {
  return {
    ...chapter,
    createdAt: new Date(chapter.createdAt),
    lastModified: new Date(chapter.lastModified),
  };
}
export async function fetchChapter(novelId: string, chapterId: string): Promise<Chapter> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters/${chapterId}`);
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Chapter not found' : 'Failed to fetch chapter');
  }
  return toChapter(await response.json());
}
export async function createChapter(
  novelId: string,
  chapter: { id: string; title?: string; content?: string; wordCount?: number }
): Promise<Chapter> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chapter),
  });
  if (!response.ok) throw new Error('Failed to create chapter');
  return toChapter(await response.json());
}
/**
 * Partial update. Renaming sends only `{ title }` — no content round-trip,
 * which is what the old all-or-nothing document PUT forced on us.
 */
export async function updateChapter(
  novelId: string,
sed: -e expression #1, char 7: extra characters after command
1788k tokens left
cd /workspace && sed -n 100,160p src/components/editor/EditorToolbar.tsx; grep -n "lastSaved\|isSaving\|Saved" src/components/editor/EditorToolbar.tsx | head
IN
cd /workspace && sed -n 100,160p src/components/editor/EditorToolbar.tsx; grep -n "lastSaved\|isSaving\|Saved" src/components/editor/EditorToolbar.tsx | head
OUT
    {
      icon: Undo,
      action: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().undo(),
      label: 'Undo',
    },
    {
      icon: Redo,
      action: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().redo(),
      label: 'Redo',
    },
  ];

  return (
    <div className="flex items-center gap-1 p-2 bg-academia-bg-secondary border-b border-academia-border rounded-t-lg">
      {tools.map((tool, index) => {
        if (tool.type === 'separator') {
          return (
            <div
              key={index}
              className="w-px h-6 bg-academia-border mx-1"
            />
          );
        }

        const Icon = tool.icon!;
        return (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              tool.action?.();
            }}
            disabled={tool.disabled}
            className={cn(
              'h-8 w-8',
              tool.isActive && 'bg-academia-bg-elevated text-academia-accent'
            )}
            title={tool.label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
1787k tokens left
cd /workspace && grep -n "interface Chapter\b" -A 12 src/types/index.ts; grep -n "formatDistanceToNow\|toLocaleString\|date-fns" src -r | head -3; grep -n "export function cn\|generateId\|countWords" src/lib/utils.ts
IN
cd /workspace && grep -n "interface Chapter\b" -A 12 src/types/index.ts; grep -n "formatDistanceToNow\|toLocaleString\|date-fns" src -r | head -3; grep -n "export function cn\|generateId\|countWords" src/lib/utils.ts
OUT
34:export interface Chapter {
35-  id: string;
36-  novelId: string;
37-  title: string;
38-  content: string;
39-  wordCount: number;
40-  /** Contiguous 0..n-1 within the novel. The server owns this. */
41-  position: number;
42-  createdAt: Date;
43-  lastModified: Date;
44-}
45-/** Everything but the prose. What the sidebar lists. */
46-export type ChapterSummary = Omit<Chapter, 'content'>;
src/components/export/ExportDialog.tsx:88:                  ? `“${novel.title}” — ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}, ${totalWords.toLocaleString()} words, in order.`
src/components/layout/AppLayout.tsx:134:              {chapterWords.toLocaleString()} words
src/components/layout/AppLayout.tsx:157:            title={`${novelWords.toLocaleString()} words in this novel`}
5:export function cn(...inputs: ClassValue[]) {
13:export function generateId(): string {
34:export function countWords(text: string): number {
1787k tokens left
I have the full picture. The design, in brief:

DB: new chapter_snapshots table (cascades with its chapter), storing full content + word count + kind (manual / auto).
API: novel-scoped CRUD plus POST .../restore. The server snapshots from its own persisted copy (the client flushes first), and restore is a single transaction that first writes an automatic backup snapshot of the current text, then replaces the chapter — so a restore can never destroy work even if the client crashes mid-way.
Editor integration: snapshots never touch the autosave path; restore goes through a new replaceChapterContent store action that cancels any pending autosave and remounts TipTap via a version-keyed mount (same mechanism as chapter switching, so undo history can't bleed across the restore).
UI: a Snapshots dialog off a new toolbar button — list, rename, compare (word-level diff vs the live buffer), restore with inline confirm; plus Novel-menu items on desktop.
Starting with the schema:


▸
edit database.js 2×
+24 −0
edit
database.js
+21 −0
/workspace/server/database.js
// Point-in-time copies of a chapter's prose (Scrivener-style snapshots).
// `kind` separates the author's deliberate snapshots ('manual') from the
// safety copies a restore writes automatically ('auto'). Full content is
// stored each time — prose is small, and independence from the live row is
// the whole point.
const SNAPSHOTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS chapter_snapshots (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    novel_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'auto')),
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chapter_snapshots_chapter
    ON chapter_snapshots (chapter_id, created_at);
`;
// App-level settings (AI provider choice, encrypted API keys, …). Not scoped
// to a novel, so it sits outside the cascade-delete graph entirely.
1781k tokens left
edit
database.js
+3 −0
/workspace/server/database.js
db.exec(SETTINGS_SCHEMA);
// Added after the novels migration shipped, so unlike the tables above it is
// created unconditionally — IF NOT EXISTS upgrades existing libraries in place.
db.exec(SNAPSHOTS_SCHEMA);
db.pragma('foreign_keys = ON');
1780k tokens left
Now the server routes, placed right after the chapter endpoints:


▸
edit index.js · ❯ cd /workspace && node --check server/index.js && node --che…
+219 −0
edit
index.js
+219 −0
/workspace/server/index.js
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
1776k tokens left
cd /workspace && node --check server/index.js && node --check server/database.js && rm -rf /tmp/snaptest && EXLIBRIS_DATA_DIR=/tmp/snaptest node -e "
IN
cd /workspace && node --check server/index.js && node --check server/database.js && rm -rf /tmp/snaptest && EXLIBRIS_DATA_DIR=/tmp/snaptest node -e "
import('/workspace/server/index.js').then(async ({ startServer }) => {
  const assert = (await import('node:assert')).default;
  const server = await startServer(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  const j = (r) => r.json();
  const api = (p, opts) => fetch(base + '/api' + p, { headers: { 'Content-Type': 'application/json' }, ...opts });

  // setup: novel + chapter
  const novel = await j(await api('/novels', { method: 'POST', body: JSON.stringify({ title: 'Snap Test' }) }));
  const ch = await j(await api(\`/novels/\${novel.id}/chapters\`, { method: 'POST', body: JSON.stringify({ content: '<p>draft one</p>', wordCount: 2 }) }));

  // create snapshot (server copies persisted content; body content is ignored by design)
  const s1 = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`, { method: 'POST', body: JSON.stringify({ name: 'Before big edit', content: '<p>EVIL INJECTED</p>' }) }));
  assert.equal(s1.kind, 'manual');
  assert.equal(s1.wordCount, 2);
  const full1 = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${s1.id}\`));
  assert.equal(full1.content, '<p>draft one</p>', 'snapshot copies the DB, not the request');

  // edit the chapter (simulating autosave), then restore the snapshot
  await api(\`/novels/\${novel.id}/chapters/\${ch.id}\`, { method: 'PUT', body: JSON.stringify({ content: '<p>draft two rewritten badly</p>', wordCount: 4 }) });
  const restored = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${s1.id}/restore\`, { method: 'POST' }));
  assert.equal(restored.chapter.content, '<p>draft one</p>', 'chapter restored');
  assert.equal(restored.chapter.wordCount, 2);
  assert.equal(restored.backup.kind, 'auto', 'automatic backup written');
  const backupFull = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${restored.backup.id}\`));
  assert.equal(backupFull.content, '<p>draft two rewritten badly</p>', 'backup holds the pre-restore text');

  // list: newest first, no content field
  const list = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`));
  assert.equal(list.length, 2);
  assert.ok(!('content' in list[0]), 'list omits content');

  // rename + delete
  const renamed = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${s1.id}\`, { method: 'PUT', body: JSON.stringify({ name: 'Keeper' }) }));
  assert.equal(renamed.name, 'Keeper');
  assert.equal((await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${restored.backup.id}\`, { method: 'DELETE' })).status, 204);

  // validation
  assert.equal((await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/not-a-valid-id!!/restore\`, { method: 'POST' })).status, 400);
  assert.equal((await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${'x'.repeat(20)}\`, { method: 'DELETE' })).status, 404);
  assert.equal((await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`, { method: 'POST', body: JSON.stringify({ name: 'n'.repeat(300) }) })).status, 400, 'name cap');

  // cap: fill to 100, 101st manual rejected, restore still works and prunes autos
  for (let i = 0; i < 99; i++) {
    const r = await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`, { method: 'POST', body: JSON.stringify({ name: 'bulk ' + i }) });
    assert.equal(r.status, 201);
  }
  assert.equal((await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`, { method: 'POST', body: '{}' })).status, 400, 'manual create blocked at cap');
  const r2 = await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots/\${s1.id}/restore\`, { method: 'POST' });
  assert.equal(r2.status, 200, 'restore never blocked by cap');
  const after = await j(await api(\`/novels/\${novel.id}/chapters/\${ch.id}/snapshots\`));
  assert.ok(after.length <= 101, 'cap respected via auto-prune (manuals kept): ' + after.length);
  assert.equal(after.filter((s) => s.kind === 'manual').length, 100, 'no manual snapshot was pruned');

  // cascade: deleting the chapter removes its snapshots
  await api(\`/novels/\${novel.id}/chapters/\${ch.id}\`, { method: 'DELETE' });
  const db = (await import('/workspace/server/database.js')).default;
  assert.equal(db.prepare('SELECT COUNT(*) c FROM chapter_snapshots WHERE chapter_id = ?').get(ch.id).c, 0, 'cascade delete');

  console.log('ALL SNAPSHOT API TESTS PASSED');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
"
OUT
[exlibris] Copied your library from /workspace/server/exlibris.db to /tmp/snaptest/exlibris.db. The repo copy is no longer used; delete it when you are confident.
Ex Libris API server running on port 46057
[exlibris] AI provider: anthropic — default tier resolves to claude-sonnet-4-5-20250929
ALL SNAPSHOT API TESTS PASSED
1774k tokens left
Server side verified — including the cap-with-restore edge case (restore never blocked, manual snapshots never pruned). Now the client. Types and service first:


▸
❯ cd /workspace && sed -n 44,50p src/types/index.ts +1 · edit index.ts · write snapshots.ts
+138 −0
cd /workspace && sed -n 44,50p src/types/index.ts
IN
cd /workspace && sed -n 44,50p src/types/index.ts
OUT
}
/** Everything but the prose. What the sidebar lists. */
export type ChapterSummary = Omit<Chapter, 'content'>;
/** One chapter's full prose, for context building and codex scanning. */
export interface ManuscriptChapter {
  id: string;
  title: string;
1773k tokens left
edit
index.ts
+13 −0
/workspace/src/types/index.ts
/** Everything but the prose. What the sidebar lists. */
export type ChapterSummary = Omit<Chapter, 'content'>;
/**
 * A point-in-time copy of one chapter's prose (Scrivener-style snapshot).
 * 'manual' = taken deliberately; 'auto' = the safety backup a restore writes.
 */
export interface ChapterSnapshot {
  id: string;
  chapterId: string;
  novelId: string;
  name: string;
  kind: 'manual' | 'auto';
  wordCount: number;
  createdAt: Date;
}
1773k tokens left
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('src/services/chapters.ts').read()
old = "function toChapter(chapter: ApiChapter): Chapter {"
new = "export function toChapter(chapter: ApiChapter): Chapter {"
assert old in s
s = s.replace(old, new, 1)
s = s.replace("interface ApiChapter {", "export interface ApiChapter {", 1)
open('src/services/chapters.ts','w').write(s)
print('exported toChapter/ApiChapter')
PY
OUT
exported toChapter/ApiChapter
1773k tokens left
write
snapshots.ts
// src/services/snapshots.ts
//
// API client for chapter snapshots. One deliberate asymmetry: creating a
// snapshot sends no content — the server copies the chapter's *persisted*
// prose, so callers must flush the editor first (snapshotStore does).

import { Chapter, ChapterSnapshot } from '@/types';
import { ApiChapter, toChapter } from '@/services/chapters';
import { API_URL } from '@/services/apiBase';

interface ApiSnapshot {
  id: string;
  chapterId: string;
  novelId: string;
  name: string;
  kind: 'manual' | 'auto';
  wordCount: number;
  createdAt: string;
  content?: string;
}

export interface ChapterSnapshotWithContent extends ChapterSnapshot {
  content: string;
}

function toSnapshot(snapshot: ApiSnapshot): ChapterSnapshot {
  return {
    id: snapshot.id,
    chapterId: snapshot.chapterId,
    novelId: snapshot.novelId,
    name: snapshot.name,
    kind: snapshot.kind,
    wordCount: snapshot.wordCount,
    createdAt: new Date(snapshot.createdAt),
  };
}

async function readError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') message = body.error;
  } catch {
    /* non-JSON error body */
  }
  throw new Error(message);
}

function snapshotsUrl(novelId: string, chapterId: string, suffix = ''): string {
  return `${API_URL}/api/novels/${novelId}/chapters/${chapterId}/snapshots${suffix}`;
}

export async function fetchSnapshots(
  novelId: string,
  chapterId: string
): Promise<ChapterSnapshot[]> {
  const response = await fetch(snapshotsUrl(novelId, chapterId));
  if (!response.ok) await readError(response, 'Failed to load snapshots');
  return ((await response.json()) as ApiSnapshot[]).map(toSnapshot);
}

export async function createSnapshot(
  novelId: string,
  chapterId: string,
  name = ''
): Promise<ChapterSnapshot> {
  const response = await fetch(snapshotsUrl(novelId, chapterId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) await readError(response, 'Failed to create snapshot');
  return toSnapshot(await response.json());
}

export async function fetchSnapshotContent(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<ChapterSnapshotWithContent> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`));
  if (!response.ok) await readError(response, 'Failed to load the snapshot');
  const body = (await response.json()) as ApiSnapshot;
  return { ...toSnapshot(body), content: body.content ?? '' };
}

export async function renameSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string,
  name: string
): Promise<ChapterSnapshot> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) await readError(response, 'Failed to rename the snapshot');
  return toSnapshot(await response.json());
}

export async function deleteSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<void> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}`), {
    method: 'DELETE',
  });
  if (!response.ok) await readError(response, 'Failed to delete the snapshot');
}

/** The server backs up the current text before overwriting — see the routes. */
export async function restoreSnapshot(
  novelId: string,
  chapterId: string,
  snapshotId: string
): Promise<{ chapter: Chapter; backup: ChapterSnapshot }> {
  const response = await fetch(snapshotsUrl(novelId, chapterId, `/${snapshotId}/restore`), {
    method: 'POST',
  });
  if (!response.ok) await readError(response, 'Failed to restore the snapshot');
  const body = (await response.json()) as { chapter: ApiChapter; backup: ApiSnapshot };
  return { chapter: toChapter(body.chapter), backup: toSnapshot(body.backup) };
}
125 lines
1771k tokens left
Now the editor-store hook for safe content replacement:


▸
❯ cd /workspace && python3 - <<'PY' s = open('src/stores/edit…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('src/stores/editorStore.ts').read()

old = """interface EditorState {
  /** null while loading, or when no chapter is open. Also the editor's remount key. */
  chapterId: string | null;"""
new = """interface EditorState {
  /** null while loading, or when no chapter is open. Also the editor's remount key. */
  chapterId: string | null;
  /**
   * Bumped whenever the buffer is replaced from outside the editor (snapshot
   * restore). Part of the TipTap mount key, so a replace remounts the editor
   * exactly like a chapter switch does — same path, same undo-history reset.
   */
  loadVersion: number;"""
assert old in s; s = s.replace(old, new)

old = """  setShadowSuggestion: (suggestion: ShadowSuggestion | null) => void;"""
new = """  /**
   * Swap the open chapter's buffer for server-authoritative content (snapshot
   * restore). Cancels any pending autosave first so a stale timer can never
   * write the old prose back over the restored text.
   */
  replaceChapterContent: (chapter: Chapter) => void;
  setShadowSuggestion: (suggestion: ShadowSuggestion | null) => void;"""
assert old in s; s = s.replace(old, new)

old = """export const useEditorStore = create<EditorState>((set, get) => ({
  chapterId: null,"""
new = """export const useEditorStore = create<EditorState>((set, get) => ({
  chapterId: null,
  loadVersion: 0,"""
assert old in s; s = s.replace(old, new)

old = """  setShadowSuggestion: (suggestion) => set({ shadowSuggestion: suggestion }),"""
new = """  replaceChapterContent: (chapter) => {
    // Only meaningful for the chapter that's actually open — the caller may
    // have raced a chapter switch.
    if (get().chapterId !== chapter.id) return;
    cancelPendingAutosave();
    set((state) => ({
      content: chapter.content,
      wordCount: chapter.wordCount,
      hasUnsavedChanges: false,
      lastSaved: chapter.lastModified,
      saveError: null,
      shadowSuggestion: null,
      loadVersion: state.loadVersion + 1,
    }));
  },
  setShadowSuggestion: (suggestion) => set({ shadowSuggestion: suggestion }),"""
assert old in s; s = s.replace(old, new)

open('src/stores/editorStore.ts','w').write(s)
print('ok')
PY
OUT
ok
1770k tokens left
Wire the mount key in Editor.tsx:


▸
edit Editor.tsx 2×
+4 −1
edit
Editor.tsx
+3 −0
/workspace/src/components/editor/Editor.tsx
export function Editor() {
  const chapterId = useEditorStore((state) => state.chapterId);
  // Part of the mount key: a snapshot restore replaces the buffer and bumps
  // this, remounting TipTap exactly like a chapter switch (fresh undo stack).
  const loadVersion = useEditorStore((state) => state.loadVersion);
  const isLoadingChapter = useEditorStore((state) => state.isLoadingChapter);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
1769k tokens left
edit
Editor.tsx
+1 −1
/workspace/src/components/editor/Editor.tsx
      <ChapterEditor key={chapterId} />
      <ChapterEditor key={`${chapterId}:${loadVersion}`} />
1769k tokens left
Now the snapshot store, which owns the flush-first discipline and the safe restore sequence:


▸
write snapshotStore.ts
+218 −0
write
snapshotStore.ts
// src/stores/snapshotStore.ts
//
// Chapter snapshots (Scrivener-style). Two invariants this store enforces:
//
//  1. "Snapshot" means "what is persisted". Before creating or restoring, the
//     editor is flushed; if that flush fails, the operation is aborted rather
//     than capture (or overwrite) something that doesn't match the screen.
//  2. Restoring can't destroy work. The server writes an automatic backup of
//     the current text in the same transaction as the overwrite, and the
//     buffer swap goes through editorStore.replaceChapterContent, which
//     cancels any pending autosave before replacing the content.
//
// The list is loaded lazily (when the dialog opens or the menu asks), never on
// chapter switch — snapshots cost nothing until you look at them.

import { create } from 'zustand';
import { ChapterSnapshot } from '@/types';
import * as snapshotsService from '@/services/snapshots';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { invalidateSearchCache } from '@/stores/searchStore';

interface SnapshotState {
  /** The chapter the current list belongs to. */
  chapterId: string | null;
  novelId: string | null;
  snapshots: ChapterSnapshot[];
  isLoading: boolean;
  /** A create/rename/delete/restore is in flight. */
  isWorking: boolean;
  error: string | null;
  /** Feedback for the quick "Take Snapshot" action (menu or button). */
  lastTakenAt: Date | null;

  /** Load the list for the currently open chapter. */
  openForCurrentChapter: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Flushes the editor, then snapshots the persisted chapter. */
  create: (name?: string) => Promise<ChapterSnapshot | null>;
  rename: (snapshotId: string, name: string) => Promise<void>;
  remove: (snapshotId: string) => Promise<void>;
  /** Returns true on success. The pre-restore text is backed up server-side. */
  restore: (snapshotId: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Persist the open chapter and report whether the database now matches the
 * buffer. Both create and restore refuse to proceed on a failed save.
 */
async function flushEditor(): Promise<boolean> {
  await useEditorStore.getState().flush();
  return !useEditorStore.getState().hasUnsavedChanges;
}

function currentChapter(): { novelId: string; chapterId: string } | null {
  const { novelId, chapterId } = useEditorStore.getState();
  return novelId && chapterId ? { novelId, chapterId } : null;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  chapterId: null,
  novelId: null,
  snapshots: [],
  isLoading: false,
  isWorking: false,
  error: null,
  lastTakenAt: null,

  openForCurrentChapter: async () => {
    const target = currentChapter();
    if (!target) return;
    set({
      chapterId: target.chapterId,
      novelId: target.novelId,
      isLoading: true,
      error: null,
      // Showing another chapter's list, even briefly, would be worse than a
      // spinner.
      snapshots: get().chapterId === target.chapterId ? get().snapshots : [],
    });
    try {
      const snapshots = await snapshotsService.fetchSnapshots(target.novelId, target.chapterId);
      if (get().chapterId !== target.chapterId) return; // switched mid-flight
      set({ snapshots, isLoading: false });
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      set({ isLoading: false, error: 'Could not load snapshots.' });
    }
  },

  refresh: async () => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    try {
      const snapshots = await snapshotsService.fetchSnapshots(novelId, chapterId);
      if (get().chapterId !== chapterId) return;
      set({ snapshots });
    } catch (error) {
      console.error('Failed to refresh snapshots:', error);
    }
  },

  create: async (name = '') => {
    const target = currentChapter();
    if (!target || get().isWorking) return null;
    set({ isWorking: true, error: null });
    try {
      if (!(await flushEditor())) {
        set({
          isWorking: false,
          error: 'Could not save the chapter first — snapshot not taken.',
        });
        return null;
      }
      const snapshot = await snapshotsService.createSnapshot(
        target.novelId,
        target.chapterId,
        name
      );
      set((state) => ({
        isWorking: false,
        lastTakenAt: new Date(),
        // Prepend only if the list on screen is this chapter's.
        snapshots:
          state.chapterId === target.chapterId
            ? [snapshot, ...state.snapshots]
            : state.snapshots,
      }));
      return snapshot;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      set({
        isWorking: false,
        error: error instanceof Error ? error.message : 'Could not take the snapshot.',
      });
      return null;
    }
  },

  rename: async (snapshotId, name) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    const previous = get().snapshots;
    set({
      snapshots: previous.map((s) => (s.id === snapshotId ? { ...s, name } : s)),
      error: null,
    });
    try {
      await snapshotsService.renameSnapshot(novelId, chapterId, snapshotId, name);
    } catch (error) {
      console.error('Failed to rename snapshot:', error);
      set({ snapshots: previous, error: 'Could not rename the snapshot.' });
    }
  },

  remove: async (snapshotId) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId) return;
    const previous = get().snapshots;
    set({ snapshots: previous.filter((s) => s.id !== snapshotId), error: null });
    try {
      await snapshotsService.deleteSnapshot(novelId, chapterId, snapshotId);
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      set({ snapshots: previous, error: 'Could not delete the snapshot.' });
    }
  },

  restore: async (snapshotId) => {
    const { novelId, chapterId } = get();
    if (!novelId || !chapterId || get().isWorking) return false;
    // The restore targets the chapter this list belongs to; if the author has
    // since opened a different chapter, bail out rather than surprise them.
    const open = currentChapter();
    if (!open || open.chapterId !== chapterId) {
      set({ error: 'This chapter is no longer open — restore cancelled.' });
      return false;
    }
    set({ isWorking: true, error: null });
    try {
      // Persist the text on screen first: the server's automatic backup can
      // only protect what has reached the database.
      if (!(await flushEditor())) {
        set({
          isWorking: false,
          error: 'Could not save your current text — restore cancelled, nothing changed.',
        });
        return false;
      }
      const { chapter } = await snapshotsService.restoreSnapshot(novelId, chapterId, snapshotId);
      // Swap the buffer (no-ops safely if a chapter switch raced us; the
      // restored text is persisted either way and will load on next open).
      useEditorStore.getState().replaceChapterContent(chapter);
      // Keep the sidebar's word count and ordering honest.
      useLibraryStore.setState((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === chapter.id
            ? { ...c, wordCount: chapter.wordCount, lastModified: chapter.lastModified }
            : c
        ),
      }));
      invalidateSearchCache();
      set({ isWorking: false });
      await get().refresh(); // picks up the automatic backup
      return true;
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      set({
        isWorking: false,
        error: error instanceof Error ? error.message : 'Could not restore the snapshot.',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
218 lines
1766k tokens left
Now the diff engine — paragraph-level LCS with word-level refinement of changed pairs, and size guards so huge chapters can't freeze the UI:


▸
write diff.ts
+165 −0
write
diff.ts
// src/lib/diff.ts
//
// A small, dependency-free text diff for the snapshot compare view.
//
// Strategy: diff *paragraphs* first (cheap — a chapter is a few hundred
// paragraphs at most), then refine each changed paragraph pair with a
// word-level diff. Both passes are plain LCS; the word pass is skipped for
// pathologically large pairs so a 200k-word paste can never freeze the UI —
// the pair is then shown as a whole-paragraph replace, which is still correct,
// just coarser.
//
// Input is the editor's HTML; we compare extracted text. Formatting-only
// changes therefore don't show up — for prose snapshots that's the right
// trade: the question is "what did the words do", not "what did the markup do".

export interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

export interface DiffParagraph {
  /** 'same' | 'added' | 'removed' | 'changed' (word-level segments inside). */
  type: 'same' | 'added' | 'removed' | 'changed';
  segments: DiffSegment[];
}

/** Above this (len(a) × len(b)) the word-level pass falls back to replace. */
const MAX_WORD_LCS_PRODUCT = 250_000;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Editor HTML → plain-text paragraphs, in document order. */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\/(p|h[1-6]|li|blockquote|div|pre)>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

/**
 * Longest common subsequence over token arrays. O(n·m) time and memory —
 * callers are responsible for keeping n·m sane (see MAX_WORD_LCS_PRODUCT).
 * Returns pairs of matching indices [indexInA, indexInB].
 */
function lcsPairs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  // dp[(i)*(m+1)+j] = LCS length of a[i:], b[j:]
  const dp = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] =
        a[i] === b[j]
          ? dp[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** Merge consecutive segments of the same type (purely cosmetic). */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) last.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

/** Word-level diff of one paragraph pair. `old` → removed, `next` → added. */
export function diffWords(oldText: string, nextText: string): DiffSegment[] {
  const a = oldText.split(/\s+/).filter(Boolean);
  const b = nextText.split(/\s+/).filter(Boolean);
  if (a.length * b.length > MAX_WORD_LCS_PRODUCT) {
    return [
      { type: 'removed', text: oldText },
      { type: 'added', text: nextText },
    ];
  }
  const pairs = lcsPairs(a, b);
  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  const push = (type: DiffSegment['type'], words: string[]) => {
    if (words.length) segments.push({ type, text: words.join(' ') + ' ' });
  };
  for (const [pi, pj] of pairs) {
    push('removed', a.slice(i, pi));
    push('added', b.slice(j, pj));
    push('same', [a[pi]]);
    i = pi + 1;
    j = pj + 1;
  }
  push('removed', a.slice(i));
  push('added', b.slice(j));
  return mergeSegments(segments);
}

/**
 * Full compare: snapshot text vs current text, as renderable paragraphs.
 * Reads as "what happened to the snapshot to produce the current text":
 * removed = was in the snapshot, gone now; added = new since the snapshot.
 */
export function diffHtml(oldHtml: string, newHtml: string): DiffParagraph[] {
  const a = htmlToParagraphs(oldHtml);
  const b = htmlToParagraphs(newHtml);
  const pairs = lcsPairs(a, b);
  const result: DiffParagraph[] = [];
  let i = 0;
  let j = 0;

  const emitGap = (removedEnd: number, addedEnd: number) => {
    const removed = a.slice(i, removedEnd);
    const added = b.slice(j, addedEnd);
    // Pair off removed/added paragraphs for word-level detail; leftovers are
    // whole-paragraph adds or removes.
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) {
      result.push({ type: 'changed', segments: diffWords(removed[k], added[k]) });
    }
    for (let k = paired; k < removed.length; k++) {
      result.push({ type: 'removed', segments: [{ type: 'removed', text: removed[k] }] });
    }
    for (let k = paired; k < added.length; k++) {
      result.push({ type: 'added', segments: [{ type: 'added', text: added[k] }] });
    }
  };

  for (const [pi, pj] of pairs) {
    emitGap(pi, pj);
    result.push({ type: 'same', segments: [{ type: 'same', text: a[pi] }] });
    i = pi + 1;
    j = pj + 1;
  }
  emitGap(a.length, b.length);
  return result;
}
165 lines
1763k tokens left
Let me harden the paragraph pass too — common prefix/suffix trimming plus a product cap, so even absurd inputs stay cheap:


▸
edit diff.ts
+33 −1
edit
diff.ts
+33 −1
/workspace/src/lib/diff.ts
export function diffHtml(oldHtml: string, newHtml: string): DiffParagraph[] {
  const a = htmlToParagraphs(oldHtml);
  const b = htmlToParagraphs(newHtml);
  const pairs = lcsPairs(a, b);
  // Trim the common head and tail before the O(n·m) pass — the usual edit
  // touches a few paragraphs in the middle of an otherwise identical chapter.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  // Degenerate middles (huge mutual rewrites) skip the LCS: pair paragraphs
  // off in order. Coarser, never wrong, never slow.
  const pairsMiddle: Array<[number, number]> =
    middleA.length * middleB.length > MAX_PARAGRAPH_LCS_PRODUCT
      ? []
      : lcsPairs(middleA, middleB);
  const same = (text: string): DiffParagraph => ({
    type: 'same',
    segments: [{ type: 'same', text }],
  });
  const head = a.slice(0, start).map(same);
  const tail = a.slice(endA).map(same);
  const pairs = pairsMiddle;
  // Re-point the gap walker at the trimmed middle.
  const aFull = a;
  const bFull = b;
  void aFull;
  void bFull;
1762k tokens left
That edit got tangled — let me rewrite diffHtml cleanly as a whole:


▸
❯ cd /workspace && python3 - <<'PY' s = open('src/lib/diff.ts…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('src/lib/diff.ts').read()
start = s.index("/**\n * Full compare:")
new_tail = '''/**
 * Full compare: snapshot text vs current text, as renderable paragraphs.
 * Reads as "what happened to the snapshot to produce the current text":
 * removed = was in the snapshot, gone now; added = new since the snapshot.
 */
export function diffHtml(oldHtml: string, newHtml: string): DiffParagraph[] {
  const a = htmlToParagraphs(oldHtml);
  const b = htmlToParagraphs(newHtml);

  // Trim the common head and tail before the O(n\u00b7m) pass \u2014 the usual edit
  // touches a few paragraphs in the middle of an otherwise identical chapter.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);

  // A degenerate middle (huge mutual rewrite) skips the LCS entirely: pairs
  // stay empty and the gap walker pairs paragraphs off in order. Coarser,
  // never wrong, never slow.
  const pairs =
    middleA.length * middleB.length > MAX_PARAGRAPH_LCS_PRODUCT
      ? []
      : lcsPairs(middleA, middleB);

  const same = (text: string): DiffParagraph => ({
    type: 'same',
    segments: [{ type: 'same', text }],
  });

  const result: DiffParagraph[] = a.slice(0, start).map(same);
  let i = 0;
  let j = 0;
  const emitGap = (removedEnd: number, addedEnd: number) => {
    const removed = middleA.slice(i, removedEnd);
    const added = middleB.slice(j, addedEnd);
    // Pair off removed/added paragraphs for word-level detail; leftovers are
    // whole-paragraph adds or removes.
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) {
      result.push({ type: 'changed', segments: diffWords(removed[k], added[k]) });
    }
    for (let k = paired; k < removed.length; k++) {
      result.push({ type: 'removed', segments: [{ type: 'removed', text: removed[k] }] });
    }
    for (let k = paired; k < added.length; k++) {
      result.push({ type: 'added', segments: [{ type: 'added', text: added[k] }] });
    }
  };
  for (const [pi, pj] of pairs) {
    emitGap(pi, pj);
    result.push(same(middleA[pi]));
    i = pi + 1;
    j = pj + 1;
  }
  emitGap(middleA.length, middleB.length);
  result.push(...a.slice(endA).map(same));
  return result;
}
'''
s = s[:start] + new_tail
s = s.replace(
  "/** Above this (len(a) \u00d7 len(b)) the word-level pass falls back to replace. */\nconst MAX_WORD_LCS_PRODUCT = 250_000;",
  "/** Above this (len(a) \u00d7 len(b)) the word-level pass falls back to replace. */\nconst MAX_WORD_LCS_PRODUCT = 250_000;\n/** Same guard for the paragraph pass (a middle this tangled isn't diffable anyway). */\nconst MAX_PARAGRAPH_LCS_PRODUCT = 1_000_000;"
)
open('src/lib/diff.ts','w').write(s)
print('rewritten')
PY
npx tsc --noEmit --strict --module esnext --target es2020 --moduleResolution bundler src/lib/diff.ts 2>&1 | head -3; echo "tsc spot-check done"
OUT
rewritten
tsc spot-check done
1760k tokens left
Quick correctness test of the diff before building UI on it:


▸
❯ cd /workspace && node -e " require('esbuild').build({ entry…
cd /workspace && node -e "
IN
cd /workspace && node -e "
require('esbuild').build({ entryPoints: ['src/lib/diff.ts'], bundle: true, format: 'cjs', outfile: '/tmp/diff.cjs', platform: 'node' }).then(() => {
  const assert = require('assert');
  const { diffHtml, diffWords, htmlToParagraphs } = require('/tmp/diff.cjs');

  assert.deepEqual(htmlToParagraphs('<p>One <strong>two</strong></p><h2>Head &amp; tail</h2><p></p>'), ['One two', 'Head & tail']);

  // identical
  assert.ok(diffHtml('<p>same text</p>', '<p>same text</p>').every((p) => p.type === 'same'));

  // word change in the middle
  let d = diffHtml('<p>the quick brown fox</p><p>second para</p>', '<p>the quick red fox</p><p>second para</p>');
  assert.equal(d[0].type, 'changed');
  assert.deepEqual(d[0].segments.map((s) => s.type + ':' + s.text.trim()),
    ['same:the quick', 'removed:brown', 'added:red', 'same:fox']);
  assert.equal(d[1].type, 'same');

  // added + removed paragraphs
  d = diffHtml('<p>keep</p><p>gone now</p>', '<p>keep</p><p>brand new</p><p>another</p>');
  assert.deepEqual(d.map((p) => p.type), ['same', 'changed', 'added']);
  d = diffHtml('<p>a</p><p>b</p><p>c</p>', '<p>a</p><p>c</p>');
  assert.deepEqual(d.map((p) => p.type), ['same', 'removed', 'same']);

  // big-but-normal chapter stays fast (common head/tail trimming)
  const paras = Array.from({ length: 3000 }, (_, i) => '<p>paragraph number ' + i + ' with some words</p>').join('');
  const edited = paras.replace('number 1500 with', 'number 1500 now has different');
  const t0 = Date.now();
  d = diffHtml(paras, edited);
  const ms = Date.now() - t0;
  assert.equal(d.filter((p) => p.type !== 'same').length, 1);
  assert.ok(ms < 500, 'fast: ' + ms + 'ms');

  // degenerate mutual rewrite doesn't explode
  const big1 = Array.from({ length: 2000 }, (_, i) => '<p>alpha ' + (i * 7 % 13) + ' ' + i + '</p>').join('');
  const big2 = Array.from({ length: 2000 }, (_, i) => '<p>omega ' + (i * 11 % 17) + ' ' + i + '</p>').join('');
  const t1 = Date.now();
  d = diffHtml(big1, big2);
  assert.ok(Date.now() - t1 < 2000, 'degenerate case bounded');
  assert.ok(d.length > 0);

  // word-level cap falls back to replace, not hang
  const words1 = Array.from({ length: 3000 }, (_, i) => 'w' + (i % 7)).join(' ');
  const words2 = Array.from({ length: 3000 }, (_, i) => 'v' + (i % 5)).join(' ');
  const seg = diffWords(words1, words2);
  assert.deepEqual(seg.map((s) => s.type), ['removed', 'added']);

  console.log('ALL DIFF TESTS PASSED (mid-edit diff of 3000 paragraphs in ' + ms + 'ms)');
});
"
OUT
ALL DIFF TESTS PASSED (mid-edit diff of 3000 paragraphs in 49ms)
1759k tokens left
Now the dialog. Let me check the ExportDialog's markup conventions to match the app's look:


▸
❯ cd /workspace && sed -n 70,140p src/components/export/Expor… · write SnapshotsDialog.tsx
+30 −0
cd /workspace && sed -n 70,140p src/components/export/ExportDialog.tsx
IN
cd /workspace && sed -n 70,140p src/components/export/ExportDialog.tsx
OUT
        setIsOpen(next);
        if (!next) {
          setError(null);
          setDoneFormat(null);
        }
      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-academia-border bg-academia-bg-secondary shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between p-5 border-b border-academia-border">
            <div>
              <Dialog.Title className="font-display text-lg text-academia-text-primary">
                Export manuscript
              </Dialog.Title>
              <Dialog.Description className="text-xs text-academia-text-muted mt-1">
                {novel
                  ? `“${novel.title}” — ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}, ${totalWords.toLocaleString()} words, in order.`
                  : 'Open a novel first.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-1 rounded text-academia-text-muted hover:text-academia-text-primary" title="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-2">
            {EXPORT_FORMATS.map((entry) => {
              const isSelected = entry.id === format;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setFormat(entry.id);
                    setDoneFormat(null);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'border-academia-accent/50 bg-academia-bg-tertiary'
                      : 'border-academia-border hover:bg-academia-bg-tertiary/60'
                  )}
                >
                  <FileText
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isSelected ? 'text-academia-accent' : 'text-academia-text-muted'
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'block text-sm',
                        isSelected ? 'text-academia-accent' : 'text-academia-text-primary'
                      )}
                    >
                      {entry.label}{' '}
                      <span className="text-academia-text-muted">.{entry.extension}</span>
                    </span>
                    <span className="block text-[11px] text-academia-text-muted">
                      {entry.description}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-academia-accent shrink-0" />}
                </button>
              );
            })}
1758k tokens left
write
SnapshotsDialog.tsx
// src/components/editor/SnapshotsDialog.tsx
//
// Scrivener-style snapshots for the open chapter: take a named snapshot before
// a big edit, browse old versions, compare one against the current text, and
// restore — which always backs the current text up first (the server does
// this in the same transaction as the overwrite).
//
// Layout: snapshot list on the left, preview/compare pane on the right.
// Everything renders extracted *text*, never raw HTML — the diff is textual
// anyway, and it keeps the dialog inert by construction.

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Camera,
  Check,
  Clock,
  Loader2,
  Pencil,
  RotegCcw as _unused, // eslint placeholder, removed below
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useEditorStore } from '@/stores/editorStore';
import { ChapterSnapshot } from '@/types';
import * as snapshotsService from '@/services/snapshots';
import { diffHtml, htmlToParagraphs } from '@/lib/diff';
import { onUiCommand } from '@/lib/uiBus';
import { cn } from '@/lib/utils';
30 lines
1757k tokens left
Let me write that file properly in one piece:


▸
write SnapshotsDialog.tsx · ❯ cd /workspace && grep -n "size:\|variant:\|sm\b" src/compon…
+447 −0
write
SnapshotsDialog.tsx
// src/components/editor/SnapshotsDialog.tsx
//
// Scrivener-style snapshots for the open chapter: take a named snapshot before
// a big edit, browse old versions, compare one against the current text, and
// restore — which always backs the current text up first (the server does
// this in the same transaction as the overwrite).
//
// Layout: snapshot list on the left, preview/compare pane on the right.
// Everything renders extracted *text*, never raw HTML — the diff is textual
// anyway, and it keeps the dialog inert by construction.

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Camera, Check, History, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useEditorStore } from '@/stores/editorStore';
import { ChapterSnapshot } from '@/types';
import * as snapshotsService from '@/services/snapshots';
import { diffHtml, htmlToParagraphs, DiffParagraph } from '@/lib/diff';
import { onUiCommand } from '@/lib/uiBus';
import { cn } from '@/lib/utils';

function snapshotLabel(snapshot: ChapterSnapshot): string {
  if (snapshot.name) return snapshot.name;
  return snapshot.kind === 'auto' ? 'Backup (before restore)' : 'Untitled snapshot';
}

function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SnapshotsDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'preview' | 'compare'>('compare');
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirming, setConfirming] = useState<'restore' | 'delete' | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const snapshots = useSnapshotStore((state) => state.snapshots);
  const isLoading = useSnapshotStore((state) => state.isLoading);
  const isWorking = useSnapshotStore((state) => state.isWorking);
  const error = useSnapshotStore((state) => state.error);
  const storeChapterId = useSnapshotStore((state) => state.chapterId);
  const storeNovelId = useSnapshotStore((state) => state.novelId);

  const chapterId = useEditorStore((state) => state.chapterId);
  // Subscribed so an open Compare pane tracks live typing.
  const currentContent = useEditorStore((state) => state.content);

  // Desktop menu Novel ▸ Snapshots… opens this same dialog.
  useEffect(() => onUiCommand('open-snapshots', () => setIsOpen(true)), []);

  // (Re)load the list every time the dialog opens — cheap, metadata only.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setSelectedContent(null);
    setConfirming(null);
    setRestoredId(null);
    setRenamingId(null);
    setNewName('');
    useSnapshotStore.getState().clearError();
    void useSnapshotStore.getState().openForCurrentChapter();
  }, [isOpen]);

  // Fetch the selected snapshot's prose for preview/compare.
  useEffect(() => {
    if (!isOpen || !selectedId || !storeNovelId || !storeChapterId) return;
    let cancelled = false;
    setIsLoadingContent(true);
    setSelectedContent(null);
    snapshotsService
      .fetchSnapshotContent(storeNovelId, storeChapterId, selectedId)
      .then((snapshot) => {
        if (!cancelled) setSelectedContent(snapshot.content);
      })
      .catch((fetchError) => {
        console.error('Failed to load snapshot content:', fetchError);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedId, storeNovelId, storeChapterId]);

  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) ?? null;

  // The diff is recomputed when the snapshot or the live buffer changes.
  const diff: DiffParagraph[] | null = useMemo(() => {
    if (mode !== 'compare' || selectedContent == null) return null;
    return diffHtml(selectedContent, currentContent);
  }, [mode, selectedContent, currentContent]);

  const previewParagraphs = useMemo(
    () => (mode === 'preview' && selectedContent != null ? htmlToParagraphs(selectedContent) : null),
    [mode, selectedContent]
  );

  const changedCount = diff ? diff.filter((paragraph) => paragraph.type !== 'same').length : 0;

  const handleTake = async () => {
    const snapshot = await useSnapshotStore.getState().create(newName.trim());
    if (snapshot) {
      setNewName('');
      setSelectedId(snapshot.id);
    }
  };

  const handleRestore = async () => {
    if (!selected) return;
    const ok = await useSnapshotStore.getState().restore(selected.id);
    setConfirming(null);
    if (ok) setRestoredId(selected.id);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await useSnapshotStore.getState().remove(selected.id);
    setConfirming(null);
    setSelectedId(null);
    setSelectedContent(null);
  };

  const commitRename = async () => {
    if (renamingId) {
      await useSnapshotStore.getState().rename(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[min(56rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-4rem))] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-xl border border-academia-border bg-academia-bg-secondary shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between p-5 border-b border-academia-border shrink-0">
            <div>
              <Dialog.Title className="font-display text-lg text-academia-text-primary">
                Snapshots
              </Dialog.Title>
              <Dialog.Description className="text-xs text-academia-text-muted mt-1">
                Saved versions of this chapter. Take one before a big edit; restoring always
                backs up the current text first.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded text-academia-text-muted hover:text-academia-text-primary"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {!chapterId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-academia-text-muted">
              Open a chapter to use snapshots.
            </div>
          ) : (
            <div className="flex-1 flex min-h-0">
              {/* ---- Left: take + list ---- */}
              <div className="w-72 shrink-0 border-r border-academia-border flex flex-col min-h-0">
                <div className="p-3 border-b border-academia-border space-y-2">
                  <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleTake();
                    }}
                    placeholder="Name (optional) — e.g. “Before rewrite”"
                    maxLength={200}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isWorking}
                    onClick={() => void handleTake()}
                  >
                    {isWorking ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Take snapshot
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {isLoading && (
                    <p className="text-xs text-academia-text-muted px-2 py-3">Loading…</p>
                  )}
                  {!isLoading && snapshots.length === 0 && (
                    <p className="text-xs text-academia-text-muted px-2 py-3 leading-relaxed">
                      No snapshots yet. Take one now and this version of the chapter is kept
                      until you delete it.
                    </p>
                  )}
                  {snapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(snapshot.id);
                        setConfirming(null);
                        setRestoredId(null);
                      }}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        snapshot.id === selectedId
                          ? 'border-academia-accent/50 bg-academia-bg-tertiary'
                          : 'border-transparent hover:bg-academia-bg-tertiary/60'
                      )}
                    >
                      {renamingId === snapshot.id ? (
                        <Input
                          autoFocus
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => void commitRename()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commitRename();
                            if (event.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          maxLength={200}
                          className="h-6 text-xs mb-1"
                        />
                      ) : (
                        <span
                          className={cn(
                            'block text-xs truncate',
                            snapshot.kind === 'auto'
                              ? 'text-academia-text-secondary italic'
                              : 'text-academia-text-primary'
                          )}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setRenamingId(snapshot.id);
                            setRenameDraft(snapshot.name);
                          }}
                          title="Double-click to rename"
                        >
                          {snapshotLabel(snapshot)}
                        </span>
                      )}
                      <span className="block text-[11px] text-academia-text-muted mt-0.5">
                        {formatWhen(snapshot.createdAt)} · {snapshot.wordCount.toLocaleString()}{' '}
                        words
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ---- Right: preview / compare / actions ---- */}
              <div className="flex-1 flex flex-col min-h-0">
                {!selected ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
                    <History className="h-8 w-8 text-academia-accent/30" />
                    <p className="text-sm text-academia-text-muted max-w-xs leading-relaxed">
                      Select a snapshot to read it or compare it with the current text.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-academia-border shrink-0">
                      <div className="flex rounded-md border border-academia-border overflow-hidden">
                        {(['compare', 'preview'] as const).map((candidate) => (
                          <button
                            key={candidate}
                            type="button"
                            onClick={() => setMode(candidate)}
                            className={cn(
                              'px-3 py-1 text-xs transition-colors',
                              mode === candidate
                                ? 'bg-academia-bg-tertiary text-academia-accent'
                                : 'text-academia-text-muted hover:text-academia-text-primary'
                            )}
                          >
                            {candidate === 'compare' ? 'Compare with current' : 'Read snapshot'}
                          </button>
                        ))}
                      </div>
                      {mode === 'compare' && diff && (
                        <span className="text-[11px] text-academia-text-muted">
                          {changedCount === 0
                            ? 'Identical to the current text.'
                            : `${changedCount} changed paragraph${changedCount === 1 ? '' : 's'}`}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1.5">
                        {restoredId === selected.id ? (
                          <span className="flex items-center gap-1 text-xs text-academia-accent">
                            <Check className="h-3.5 w-3.5" /> Restored — previous text backed up
                          </span>
                        ) : confirming === 'restore' ? (
                          <>
                            <span className="text-[11px] text-academia-text-muted">
                              Replace current text? A backup is taken first.
                            </span>
                            <Button
                              size="sm"
                              disabled={isWorking}
                              onClick={() => void handleRestore()}
                            >
                              {isWorking && (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              )}
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirming(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : confirming === 'delete' ? (
                          <>
                            <span className="text-[11px] text-academia-text-muted">
                              Delete this snapshot permanently?
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              disabled={isWorking}
                              onClick={() => void handleDelete()}
                            >
                              Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isWorking}
                              onClick={() => setConfirming('restore')}
                              title="Replace the current text with this snapshot (a backup of the current text is taken first)"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Restore…
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-academia-text-muted"
                              disabled={isWorking}
                              onClick={() => setConfirming('delete')}
                              title="Delete this snapshot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      {isLoadingContent && (
                        <p className="text-xs text-academia-text-muted">Loading snapshot…</p>
                      )}
                      {!isLoadingContent && mode === 'preview' && previewParagraphs && (
                        <div className="space-y-3 max-w-prose">
                          {previewParagraphs.length === 0 && (
                            <p className="text-xs text-academia-text-muted">
                              This snapshot is empty.
                            </p>
                          )}
                          {previewParagraphs.map((paragraph, index) => (
                            <p
                              key={index}
                              className="text-sm leading-relaxed text-academia-text-primary"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                      {!isLoadingContent && mode === 'compare' && diff && (
                        <div className="space-y-3 max-w-prose">
                          {diff.map((paragraph, index) => (
                            <p
                              key={index}
                              className={cn(
                                'text-sm leading-relaxed',
                                paragraph.type === 'same'
                                  ? 'text-academia-text-muted'
                                  : 'text-academia-text-primary'
                              )}
                            >
                              {paragraph.segments.map((segment, segmentIndex) => (
                                <span
                                  key={segmentIndex}
                                  className={cn(
                                    segment.type === 'added' &&
                                      'bg-emerald-500/15 text-emerald-300 rounded-sm px-0.5',
                                    segment.type === 'removed' &&
                                      'bg-red-500/15 text-red-300 line-through decoration-red-400/60 rounded-sm px-0.5'
                                  )}
                                >
                                  {segment.text}
                                </span>
                              ))}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {error && (
                  <div className="px-4 py-2 border-t border-academia-border text-xs text-red-400 shrink-0">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
447 lines
1750k tokens left
cd /workspace && grep -n "size:\|variant:\|sm\b" src/components/ui/Button.tsx | head; grep -rn 'size="sm"' src/components | head -3
IN
cd /workspace && grep -n "size:\|variant:\|sm\b" src/components/ui/Button.tsx | head; grep -rn 'size="sm"' src/components | head -3
OUT
7:  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-academia-accent focus-visible:ring-offset-2 focus-visible:ring-offset-academia-bg-primary disabled:pointer-events-none disabled:opacity-50',
10:      variant: {
24:      size: {
26:        sm: 'h-8 px-3 text-xs',
32:      variant: 'default',
33:      size: 'default',
src/components/editor/ShadowSuggestion.tsx:60:          size="sm"
src/components/editor/ShadowSuggestion.tsx:69:          size="sm"
src/components/editor/SnapshotsDialog.tsx:192:                    size="sm"
1750k tokens left
Good. Now the toolbar button:


▸
❯ cd /workspace && python3 - <<'PY' s = open('src/components/…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('src/components/editor/EditorToolbar.tsx').read()

old = """import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';"""
new = """import { Button } from '@/components/ui/Button';
import { SnapshotsDialog } from './SnapshotsDialog';
import { cn } from '@/lib/utils';"""
assert old in s; s = s.replace(old, new)

# add History icon import
old = """  Undo,
  Redo,
} from 'lucide-react';"""
new = """  Undo,
  Redo,
  History,
} from 'lucide-react';"""
assert old in s; s = s.replace(old, new)

old = """          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}"""
new = """          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
      {/* Right-aligned: chapter-level tools rather than text formatting. */}
      <div className="ml-auto flex items-center gap-1">
        <SnapshotsDialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Snapshots — saved versions of this chapter"
          >
            <History className="h-4 w-4" />
          </Button>
        </SnapshotsDialog>
      </div>
    </div>
  );
}"""
assert old in s; s = s.replace(old, new)
open('src/components/editor/EditorToolbar.tsx','w').write(s)
print('toolbar ok')
PY
OUT
toolbar ok
1749k tokens left
Now desktop menu integration — uiBus type, bridge actions/state, and the menu items:


▸
❯ cd /workspace && python3 - <<'PY' # 1. uiBus command s = op…, cd /workspace && python3 - <<'PY' s = open('electron/menu.c… +1
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
# 1. uiBus command
s = open('src/lib/uiBus.ts').read()
old = """export type UiCommand =
  | 'open-export'
  | 'open-ai-settings'
  | 'ai-test-connection'
  | 'editor-undo'
  | 'editor-redo';"""
new = """export type UiCommand =
  | 'open-export'
  | 'open-ai-settings'
  | 'ai-test-connection'
  | 'open-snapshots'
  | 'editor-undo'
  | 'editor-redo';"""
assert old in s
open('src/lib/uiBus.ts','w').write(s.replace(old, new))

# 2. desktopMenu.ts
s = open('src/lib/desktopMenu.ts').read()
old = """import { useThemeStore } from '@/stores/themeStore';"""
new = """import { useThemeStore } from '@/stores/themeStore';
import { useSnapshotStore } from '@/stores/snapshotStore';"""
assert old in s; s = s.replace(old, new)

old = """    case 'novel:codex':
      workspace.openSidebarTab('codex');
      return;"""
new = """    case 'novel:codex':
      workspace.openSidebarTab('codex');
      return;
    // Flushes the editor, then snapshots the persisted chapter. Silent on
    // success by design — the dialog lists it; failure surfaces there too.
    case 'novel:take-snapshot':
      void useSnapshotStore.getState().create();
      return;
    case 'novel:snapshots':
      // The dialog lives in the editor toolbar, which only Manuscript view
      // mounts; the sticky uiBus delivery covers the mount delay.
      if (workspace.view !== 'write') workspace.setView('write');
      emitUiCommand('open-snapshots');
      return;"""
assert old in s; s = s.replace(old, new)

old = """    hasNovel: Boolean(activeNovelId),
    hasPrevChapter: index > 0,"""
new = """    hasNovel: Boolean(activeNovelId),
    hasChapter: Boolean(activeChapterId),
    hasPrevChapter: index > 0,"""
assert old in s; s = s.replace(old, new)
open('src/lib/desktopMenu.ts','w').write(s)
print('bridge ok')
PY
OUT
bridge ok
1748k tokens left
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('electron/menu.cjs').read()

old = """  hasNovel: false,
  hasPrevChapter: false,
  hasNextChapter: false,"""
new = """  hasNovel: false,
  hasChapter: false,
  hasPrevChapter: false,
  hasNextChapter: false,"""
assert old in s; s = s.replace(old, new)

old = "  for (const key of ['sidebarOpen', 'hasNovel', 'hasPrevChapter', 'hasNextChapter', 'busy']) {"
new = "  for (const key of ['sidebarOpen', 'hasNovel', 'hasChapter', 'hasPrevChapter', 'hasNextChapter', 'busy']) {"
assert old in s; s = s.replace(old, new)

old = """        { type: 'separator' },
        {
          label: 'Codex',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => send('novel:codex'),
        },"""
new = """        { type: 'separator' },
        // Snapshot first, then edit bravely. Mod+Shift+T is unclaimed by the
        // editor keymap and the page (see the accelerator policy above).
        {
          label: 'Take Snapshot',
          accelerator: 'CmdOrCtrl+Shift+T',
          enabled: state.hasChapter && !state.busy,
          click: () => send('novel:take-snapshot'),
        },
        {
          label: 'Snapshots…',
          enabled: state.hasChapter,
          click: () => send('novel:snapshots'),
        },
        { type: 'separator' },
        {
          label: 'Codex',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => send('novel:codex'),
        },"""
assert old in s; s = s.replace(old, new)

old = """    `${isMac ? '\u2318+Alt+\u2190 / \u2192' : 'Ctrl+PgUp / PgDn'}\\tPrevious / next chapter`,
    `${mod}+Shift+K\\tCodex`,"""
new = """    `${isMac ? '\u2318+Alt+\u2190 / \u2192' : 'Ctrl+PgUp / PgDn'}\\tPrevious / next chapter`,
    `${mod}+Shift+T\\tTake snapshot of the chapter`,
    `${mod}+Shift+K\\tCodex`,"""
assert old in s; s = s.replace(old, new)

open('electron/menu.cjs','w').write(s)
print('menu ok')
PY
node --check electron/menu.cjs && npm run build 2>&1 | tail -3
OUT
menu ok
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 37.12s
1747k tokens left
cd /workspace && npm run lint 2>&1 | tail -3
IN
cd /workspace && npm run lint 2>&1 | tail -3
OUT
> ex-libris@0.1.0 lint
> eslint .
1747k tokens left
Build and lint clean. Now the tests. First, extend the menu and bridge suites:


▸
❯ cd /workspace && python3 - <<'PY' # main-process menu test …
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
# main-process menu test
s = open('/tmp/menu-test.cjs').read()
old = """// Busy state holds the create actions (and nothing else)"""
new = """// Snapshot items gate on hasChapter (list state still has hasNovel from above)
assert.equal(find('Novel', 'Take Snapshot').enabled, false, 'no chapter -> no snapshot');
assert.equal(find('Novel', 'Snapshots\\u2026').enabled, false);
ipcHandlers['exlibris:menu-state']({ sender: goodWC }, { hasChapter: true });
assert.equal(find('Novel', 'Take Snapshot').enabled, true);
assert.equal(find('Novel', 'Snapshots\\u2026').enabled, true);
assert.equal(find('Novel', 'Take Snapshot').accelerator, 'CmdOrCtrl+Shift+T');
find('Novel', 'Take Snapshot').click();
find('Novel', 'Snapshots\\u2026').click();
assert.deepEqual(sentActions.slice(-2), ['novel:take-snapshot', 'novel:snapshots']);

// Busy state holds the create actions (and nothing else)"""
assert old in s; s = s.replace(old, new)
old = """ipcHandlers['exlibris:menu-state']({ sender: goodWC }, { busy: true });
assert.equal(find('File', 'New Novel').enabled, false, 'busy disables New Novel');"""
new = """ipcHandlers['exlibris:menu-state']({ sender: goodWC }, { busy: true });
assert.equal(find('Novel', 'Take Snapshot').enabled, false, 'busy holds snapshots too');
assert.equal(find('File', 'New Novel').enabled, false, 'busy disables New Novel');"""
assert old in s; s = s.replace(old, new)
open('/tmp/menu-test.cjs','w').write(s)

# renderer bridge test
s = open('/tmp/rtest/entry.mjs').read()
old = "const { useWorkspaceStore, useLibraryStore, useThemeStore, onUiCommand } = await import('/tmp/rtest/bundle.mjs');"
new = "const { useWorkspaceStore, useLibraryStore, useThemeStore, useSnapshotStore, onUiCommand } = await import('/tmp/rtest/bundle.mjs');"
assert old in s; s = s.replace(old, new)
old = """// In-flight mutation: snapshot reports busy and the handlers refuse to re-fire"""
new = """// hasChapter is pushed (a chapter is active from the block above)
assert.equal(pushes.at(-1).hasChapter, true, 'hasChapter pushed');

// Menu snapshot actions
const snapCalls = [];
useSnapshotStore.setState({ create: async (name = '') => { snapCalls.push(name); return null; } });
menuHandler('novel:take-snapshot');
assert.deepEqual(snapCalls, [''], 'take-snapshot calls store.create');
useWorkspaceStore.getState().setView('outline');
let snapshotsOpened = 0;
menuHandler('novel:snapshots');
assert.equal(useWorkspaceStore.getState().view, 'write', 'left outline so the dialog can mount');
const offSnap = onUiCommand('open-snapshots', () => { snapshotsOpened += 1; });
await new Promise((r) => setTimeout(r, 10));
assert.equal(snapshotsOpened, 1, 'open-snapshots delivered (sticky)');
offSnap();

// In-flight mutation: snapshot reports busy and the handlers refuse to re-fire"""
assert old in s; s = s.replace(old, new)
open('/tmp/rtest/entry.mjs','w').write(s)

# bundle entry
s = open('/tmp/rtest/bundle-entry.ts').read()
s += "export { useSnapshotStore } from '@/stores/snapshotStore';\n"
open('/tmp/rtest/bundle-entry.ts','w').write(s)
print('patched')
PY
node /tmp/menu-test.cjs && node /tmp/menu-mac-test.cjs
node -e "
require('esbuild').build({
  entryPoints: ['/tmp/rtest/bundle-entry.ts'], bundle: true, format: 'esm',
  outfile: '/tmp/rtest/bundle.mjs', platform: 'browser',
  alias: { '@': '/workspace/src' },
  define: { 'import.meta.env': JSON.stringify({DEV:true}) },
}).then(() => console.log('bundled'));
"
node /tmp/rtest/entry.mjs && node /tmp/rtest/browser.mjs
OUT
patched
ALL MENU TESTS PASSED
MAC TEMPLATE OK
bundled
ALL RENDERER BRIDGE TESTS PASSED
BROWSER NO-OP OK
1744k tokens left
Now the most important test: the real snapshotStore + editorStore driven against the live server — exercising the flush-first discipline, the abort-on-failed-save guard, and the restore sequence end to end:


▸
❯ mkdir -p /tmp/snapstore && cat > /tmp/snapstore/bundle-entr…
mkdir -p /tmp/snapstore && cat > /tmp/snapstore/bundle-entry.ts <<'EOF'
IN
mkdir -p /tmp/snapstore && cat > /tmp/snapstore/bundle-entry.ts <<'EOF'
export { useSnapshotStore } from '@/stores/snapshotStore';
export { useEditorStore } from '@/stores/editorStore';
export { useLibraryStore } from '@/stores/libraryStore';
export * as novelsService from '@/services/novels';
export * as chaptersService from '@/services/chapters';
EOF
cd /workspace && node -e "
require('esbuild').build({
  entryPoints: ['/tmp/snapstore/bundle-entry.ts'], bundle: true, format: 'esm',
  outfile: '/tmp/snapstore/bundle.mjs', platform: 'neutral', mainFields: ['module','main'],
  alias: { '@': '/workspace/src' },
  define: { 'import.meta.env': 'globalThis.__ENV' },
}).then(() => console.log('bundled'));
"
cat > /tmp/snapstore/test.mjs <<'EOF'
import assert from 'node:assert';

// ---- boot a real server on a clean data dir ----
process.env.EXLIBRIS_DATA_DIR = '/tmp/snapstore/data';
const { startServer } = await import('/workspace/server/index.js');
const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;

// ---- browser shims + point the client at the test server ----
globalThis.__ENV = { DEV: false, VITE_API_URL: base };
globalThis.window = new EventTarget();
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k,v) => store.set(k,v), removeItem: (k) => store.delete(k) };

const { useSnapshotStore, useEditorStore, useLibraryStore, novelsService, chaptersService } =
  await import('/tmp/snapstore/bundle.mjs');

const api = (p, o) => fetch(base + '/api' + p, { headers: { 'Content-Type': 'application/json' }, ...o });
const serverChapter = async (nid, cid) => (await api(`/novels/${nid}/chapters/${cid}`)).json();

// ---- setup: novel + chapter, opened in the editor ----
const novel = await novelsService.createNovel({ id: 'novel-' + 'a'.repeat(8), title: 'Snapshot E2E' });
const chapter = await chaptersService.createChapter(novel.id, { id: 'chapter-' + 'b'.repeat(8), content: '<p>first draft of the scene</p>', wordCount: 5 });
useLibraryStore.setState({ activeNovelId: novel.id, chapters: [{ id: chapter.id, novelId: novel.id, title: chapter.title, wordCount: 5, position: 0, createdAt: chapter.createdAt, lastModified: chapter.lastModified }], activeChapterId: chapter.id });
useEditorStore.getState().loadChapter(chapter);
const editor = () => useEditorStore.getState();
const snaps = () => useSnapshotStore.getState();

// 1. Type (debounced autosave pending), then snapshot — flush-first means the
//    snapshot must contain the *typed* text even though autosave hadn't fired.
editor().setContent('<p>first draft of the scene, now improved</p>');
assert.equal(editor().hasUnsavedChanges, true, 'autosave pending');
const s1 = await snaps().create('Before the rewrite');
assert.ok(s1, 'snapshot created');
assert.equal(editor().hasUnsavedChanges, false, 'flushed before snapshotting');
const s1Full = await (await api(`/novels/${novel.id}/chapters/${chapter.id}/snapshots/${s1.id}`)).json();
assert.equal(s1Full.content, '<p>first draft of the scene, now improved</p>', 'snapshot captured the live buffer');
assert.equal(snaps().snapshots[0].id, s1.id, 'list updated');

// 2. Big rewrite, then restore. The rewrite must survive as an auto backup,
//    the buffer must swap, and the remount signal must fire.
editor().setContent('<p>a terrible experimental rewrite</p>');
const versionBefore = editor().loadVersion;
const ok = await snaps().restore(s1.id);
assert.equal(ok, true, 'restore succeeded');
assert.equal(editor().content, '<p>first draft of the scene, now improved</p>', 'buffer swapped to snapshot');
assert.equal(editor().hasUnsavedChanges, false);
assert.equal(editor().loadVersion, versionBefore + 1, 'TipTap remount signalled');
const onServer = await serverChapter(novel.id, chapter.id);
assert.equal(onServer.content, '<p>first draft of the scene, now improved</p>', 'persisted');
const auto = snaps().snapshots.find((s) => s.kind === 'auto');
assert.ok(auto, 'automatic backup in refreshed list');
const autoFull = await (await api(`/novels/${novel.id}/chapters/${chapter.id}/snapshots/${auto.id}`)).json();
assert.equal(autoFull.content, '<p>a terrible experimental rewrite</p>', 'rewrite preserved in backup');

// 3. A pending autosave timer from before the restore must NOT clobber it.
await new Promise((r) => setTimeout(r, 2300)); // > AUTOSAVE_DELAY
assert.equal((await serverChapter(novel.id, chapter.id)).content, '<p>first draft of the scene, now improved</p>', 'no stale autosave fired');

// 4. If the current text cannot be saved, create and restore both refuse.
const realChapterId = editor().chapterId;
useEditorStore.setState({ novelId: 'novel-' + 'z'.repeat(8) }); // saves will 404
editor().setContent('<p>unsaveable keystrokes</p>');
assert.equal(await snaps().create('doomed'), null, 'create aborted');
assert.match(snaps().error, /not taken/i);
assert.equal(await snaps().restore(s1.id), false, 'restore aborted');
assert.match(snaps().error, /nothing changed/i);
assert.equal((await serverChapter(novel.id, realChapterId)).content, '<p>first draft of the scene, now improved</p>', 'chapter untouched by refused restore');
useEditorStore.setState({ novelId: novel.id, hasUnsavedChanges: false, content: '<p>first draft of the scene, now improved</p>' });

// 5. Restore refuses when the author has switched chapters since opening the list.
const other = await chaptersService.createChapter(novel.id, { id: 'chapter-' + 'c'.repeat(8), content: '<p>other</p>', wordCount: 1 });
useEditorStore.getState().loadChapter(other);
assert.equal(await snaps().restore(s1.id), false, 'restore refused for a non-open chapter');
assert.match(snaps().error, /no longer open/i);

// 6. Library summary tracked the restore (word count + lastModified).
const summary = useLibraryStore.getState().chapters.find((c) => c.id === chapter.id);
assert.equal(summary.wordCount, 7, 'sidebar word count updated by restore');

console.log('ALL SNAPSHOT STORE E2E TESTS PASSED');
process.exit(0);
EOF
rm -rf /tmp/snapstore/data && node /tmp/snapstore/test.mjs
OUT
bundled
[exlibris] Copied your library from /workspace/server/exlibris.db to /tmp/snapstore/data/exlibris.db. The repo copy is no longer used; delete it when you are confident.
Ex Libris API server running on port 42091
[exlibris] AI provider: anthropic — default tier resolves to claude-sonnet-4-5-20250929
file:///tmp/snapstore/test.mjs:38
assert.equal(snaps().snapshots[0].id, s1.id, 'list updated');
                                 ^

TypeError: Cannot read properties of undefined (reading 'id')
    at file:///tmp/snapstore/test.mjs:38:34
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)

Node.js v22.21.0
1741k tokens left
The list only updates when it's been opened for the chapter (the dialog does that; the quick menu action doesn't need to). The test should mirror the dialog flow:


▸
❯ cd /workspace && python3 - <<'PY' s = open('/tmp/snapstore/…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('/tmp/snapstore/test.mjs').read()
old = """editor().setContent('<p>first draft of the scene, now improved</p>');
assert.equal(editor().hasUnsavedChanges, true, 'autosave pending');"""
new = """await snaps().openForCurrentChapter(); // what the dialog does on open
assert.deepEqual(snaps().snapshots, [], 'starts empty');
editor().setContent('<p>first draft of the scene, now improved</p>');
assert.equal(editor().hasUnsavedChanges, true, 'autosave pending');"""
assert old in s
open('/tmp/snapstore/test.mjs','w').write(s.replace(old, new))
print('patched')
PY
rm -rf /tmp/snapstore/data && node /tmp/snapstore/test.mjs
OUT
patched
[exlibris] Copied your library from /workspace/server/exlibris.db to /tmp/snapstore/data/exlibris.db. The repo copy is no longer used; delete it when you are confident.
Ex Libris API server running on port 40681
[exlibris] AI provider: anthropic — default tier resolves to claude-sonnet-4-5-20250929
Failed to save chapter: Error: Failed to update chapter
    at updateChapter (file:///tmp/snapstore/bundle.mjs:2356:27)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.saveNow (file:///tmp/snapstore/bundle.mjs:2536:7)
    at async Object.flush (file:///tmp/snapstore/bundle.mjs:2549:34)
    at async flushEditor (file:///tmp/snapstore/bundle.mjs:4537:3)
    at async Object.create (file:///tmp/snapstore/bundle.mjs:4589:12)
    at async file:///tmp/snapstore/test.mjs:66:14
Failed to save chapter: Error: Failed to update chapter
    at updateChapter (file:///tmp/snapstore/bundle.mjs:2356:27)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async Object.saveNow (file:///tmp/snapstore/bundle.mjs:2536:7)
    at async Object.flush (file:///tmp/snapstore/bundle.mjs:2549:34)
    at async flushEditor (file:///tmp/snapstore/bundle.mjs:4537:3)
    at async Object.restore (file:///tmp/snapstore/bundle.mjs:4654:12)
    at async file:///tmp/snapstore/test.mjs:68:14
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: sidebar word count updated by restore
    at file:///tmp/snapstore/test.mjs:81:8
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 2,
  expected: 7,
  operator: '==',
  diff: 'simple'
}

Node.js v22.21.0
1739k tokens left
Steps 1–5 passed (the two save-failure logs are the expected step‑4 failures). Step 6's word count is off — let me check countWords:


▸
❯ cd /workspace && sed -n 30,45p src/lib/utils.ts
cd /workspace && sed -n 30,45p src/lib/utils.ts
IN
cd /workspace && sed -n 30,45p src/lib/utils.ts
OUT

/**
 * Count words in text, stripping HTML tags.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  
  const strippedText = text.replace(/<[^>]*>/g, ' ');
  const words = strippedText.trim().split(/\s+/);
  
  return words.filter(word => word.length > 0).length;
}

/**
 * Extract preceding context from text for AI refinement.
 */
1738k tokens left
Let me debug step 6 directly:


▸
❯ cd /workspace && python3 - <<'PY' s = open('/tmp/snapstore/…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('/tmp/snapstore/test.mjs').read()
old = "const summary = useLibraryStore.getState().chapters.find((c) => c.id === chapter.id);"
new = """console.log('DEBUG s1.wordCount =', s1.wordCount);
console.log('DEBUG chapters =', JSON.stringify(useLibraryStore.getState().chapters.map(c => ({id: c.id.slice(0,9), wc: c.wordCount}))));
console.log('DEBUG server chapter wc =', (await serverChapter(novel.id, chapter.id)).wordCount);
const summary = useLibraryStore.getState().chapters.find((c) => c.id === chapter.id);"""
assert old in s
open('/tmp/snapstore/test.mjs','w').write(s.replace(old, new))
PY
rm -rf /tmp/snapstore/data && node /tmp/snapstore/test.mjs 2>&1 | grep -E "DEBUG|PASSED|AssertionError|actual|expected"
OUT
DEBUG s1.wordCount = 7
DEBUG chapters = [{"id":"chapter-b","wc":2}]
DEBUG server chapter wc = 7
AssertionError [ERR_ASSERTION]: sidebar word count updated by restore
  actual: 2,
  expected: 7,
1735k tokens left
The restore itself worked (server=7); something else wrote 2 into the summary. Let me check how libraryStore syncs word counts:


▸
❯ cd /workspace && sed -n 280,306p src/stores/libraryStore.ts
cd /workspace && sed -n 280,306p src/stores/libraryStore.ts
IN
cd /workspace && sed -n 280,306p src/stores/libraryStore.ts
OUT
      if (get().activeNovelId !== activeNovelId) return;
      set({ chapters: previous, error: 'Could not save the new chapter order.' });
    }
  },
}));
/**
 * Keep the sidebar's word counts live while typing.
 *
 * This runs the dependency the "wrong" way on purpose: `editorStore` never
 * imports `libraryStore`, so there's no cycle. The library observes the editor,
 * not the other way round.
 */
useEditorStore.subscribe((state, previous) => {
  if (state.wordCount === previous.wordCount || !state.chapterId) return;
  useLibraryStore.setState((library) => {
    const chapters = library.chapters.map((chapter) =>
      chapter.id === state.chapterId ? { ...chapter, wordCount: state.wordCount } : chapter
    );
    const total = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    return {
      chapters,
      novels: library.novels.map((novel) =>
        novel.id === library.activeNovelId ? { ...novel, wordCount: total } : novel
      ),
    };
  });
});
1735k tokens left
Found it — and it's good news: the app already has a libraryStore subscription that mirrors the editor's live word count into the sidebar. My store was duplicating that; the test's manual setState just bypassed the subscription's input. I'll let the existing subscription own word counts and have the restore path only update lastModified:


▸
edit snapshotStore.ts · ❯ cd /workspace && python3 - <<'PY' s = open('/tmp/snapstore/…
+3 −4
edit
snapshotStore.ts
+3 −4
/workspace/src/stores/snapshotStore.ts
      // Swap the buffer (no-ops safely if a chapter switch raced us; the
      // restored text is persisted either way and will load on next open).
      // Word counts propagate to the sidebar by themselves — libraryStore
      // already observes editorStore.wordCount; only lastModified is ours.
      useEditorStore.getState().replaceChapterContent(chapter);
      // Keep the sidebar's word count and ordering honest.
      useLibraryStore.setState((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === chapter.id
            ? { ...c, wordCount: chapter.wordCount, lastModified: chapter.lastModified }
            : c
          c.id === chapter.id ? { ...c, lastModified: chapter.lastModified } : c
        ),
      }));
1733k tokens left
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('/tmp/snapstore/test.mjs').read()
# Make the step-4 cleanup realistic (include wordCount, as a real buffer would have)
old = "useEditorStore.setState({ novelId: novel.id, hasUnsavedChanges: false, content: '<p>first draft of the scene, now improved</p>' });"
new = "useEditorStore.setState({ novelId: novel.id, hasUnsavedChanges: false, content: '<p>first draft of the scene, now improved</p>', wordCount: 7 });"
assert old in s; s = s.replace(old, new)
# Step 2 additions: the library subscription should mirror the restore's word count
old = "const onServer = await serverChapter(novel.id, chapter.id);"
new = """assert.equal(useLibraryStore.getState().chapters.find((c) => c.id === chapter.id).wordCount, 7,
  'sidebar word count mirrors the restored buffer (via the existing editor->library subscription)');
const onServer = await serverChapter(novel.id, chapter.id);"""
assert old in s; s = s.replace(old, new)
# Drop debug prints, fix step-6 to check lastModified tracking instead
old = """console.log('DEBUG s1.wordCount =', s1.wordCount);
console.log('DEBUG chapters =', JSON.stringify(useLibraryStore.getState().chapters.map(c => ({id: c.id.slice(0,9), wc: c.wordCount}))));
console.log('DEBUG server chapter wc =', (await serverChapter(novel.id, chapter.id)).wordCount);
const summary = useLibraryStore.getState().chapters.find((c) => c.id === chapter.id);
assert.equal(summary.wordCount, 7, 'sidebar word count updated by restore');"""
new = """const summary = useLibraryStore.getState().chapters.find((c) => c.id === chapter.id);
assert.ok(summary.lastModified > chapter.lastModified, 'sidebar lastModified advanced by restore');"""
assert old in s; s = s.replace(old, new)
open('/tmp/snapstore/test.mjs','w').write(s)
print('patched')
PY
node -e "
require('esbuild').build({
  entryPoints: ['/tmp/snapstore/bundle-entry.ts'], bundle: true, format: 'esm',
  outfile: '/tmp/snapstore/bundle.mjs', platform: 'neutral', mainFields: ['module','main'],
  alias: { '@': '/workspace/src' },
  define: { 'import.meta.env': 'globalThis.__ENV' },
}).then(() => console.log('bundled'));
"
rm -rf /tmp/snapstore/data && node /tmp/snapstore/test.mjs 2>&1 | grep -vE "^\[exlibris\]|running on port|Failed to save chapter|at "
OUT
patched
bundled
ALL SNAPSHOT STORE E2E TESTS PASSED
1732k tokens left
All E2E tests pass. Final verification sweep plus README documentation:


▸
❯ cd /workspace && python3 - <<'PY' s = open('README.md').rea…, cd /workspace && (npm run dev > /tmp/dev6.log 2>&1 &); slee…
cd /workspace && python3 - <<'PY'
IN
cd /workspace && python3 - <<'PY'
s = open('README.md').read()
old = """### 📖 Story Codex"""
new = """### 📸 Chapter Snapshots
- **Take a snapshot** of a chapter before a big edit (toolbar button, or `Ctrl/Cmd+Shift+T` in the desktop app) — optionally named, e.g. "Before rewrite"
- **Browse and read** previous versions at any time; rename or delete them freely
- **Compare**: word-level diff of any snapshot against the current text, live while you type
- **Restore safely**: restoring first writes an automatic backup of the current text *in the same database transaction*, so no restore can destroy work; the editor buffer is flushed before either operation so snapshots always match what's on screen
- Snapshots live outside the autosave path entirely and are removed with their chapter

### 📖 Story Codex"""
assert old in s
open('README.md','w').write(s.replace(old, new))
print('readme ok')
PY
npm run build 2>&1 | tail -2 && npm run lint 2>&1 | tail -2
node /tmp/menu-test.cjs && node /tmp/menu-mac-test.cjs && node /tmp/rtest/entry.mjs && node /tmp/rtest/browser.mjs
rm -rf /tmp/eltest/userData && node /tmp/eltest/harness.cjs 2>&1 | tail -1
OUT
readme ok
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 25.24s
> eslint .

ALL MENU TESTS PASSED
MAC TEMPLATE OK
ALL RENDERER BRIDGE TESTS PASSED
BROWSER NO-OP OK
ALL LIFECYCLE CHECKS PASSED (url was http://127.0.0.1:42851)
1731k tokens left
cd /workspace && (npm run dev > /tmp/dev6.log 2>&1 &); sleep 8; curl -s -o /dev/null -w "vite %{http_code} " http://localhost:5173/ && curl -s -o /dev/null -w "api %{http_code} " http://localhost:3001/api/novels && N=$(curl -s http://localhost:3001/api/novels | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])") && C=$(curl -s http://localhost:3001/api/novels/$N | python3 -c "import json,sys;print(json.load(sys.stdin)['chapters'][0]['id'])") && curl -s -o /dev/null -w "snapshots %{http_code}\n" http://localhost:3001/api/novels/$N/chapters/$C/snapshots; pkill -f "node server/index.js"; pkill -f vite; sleep 1; echo done
IN
cd /workspace && (npm run dev > /tmp/dev6.log 2>&1 &); sleep 8; curl -s -o /dev/null -w "vite %{http_code} " http://localhost:5173/ && curl -s -o /dev/null -w "api %{http_code} " http://localhost:3001/api/novels && N=$(curl -s http://localhost:3001/api/novels | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])") && C=$(curl -s http://localhost:3001/api/novels/$N | python3 -c "import json,sys;print(json.load(sys.stdin)['chapters'][0]['id'])") && curl -s -o /dev/null -w "snapshots %{http_code}\n" http://localhost:3001/api/novels/$N/chapters/$C/snapshots; pkill -f "node server/index.js"; pkill -f vite; sleep 1; echo done
OUT
vite 200 api 200 snapshots 200
done