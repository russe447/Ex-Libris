import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
// Lives in the per-user app data directory (see server/paths.js), not the repo.
import { DB_PATH } from './paths.js';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
// Foreign keys MUST stay off while we rebuild tables. This is SQLite's
// documented recipe for schema changes: dropping a parent table with
// foreign_keys=ON fires ON DELETE CASCADE on its children, which would
// silently delete every chat message and codex entry during migration.
db.pragma('foreign_keys = OFF');
// ---------------------------------------------------------------------------
// Introspection helpers
// ---------------------------------------------------------------------------
function tableExists(name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
  );
}
function columnNames(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}
// ---------------------------------------------------------------------------
// v2 schema: novels ▸ chapters, with chat + codex hanging off the novel
// ---------------------------------------------------------------------------
const NOVEL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS novels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled Novel',
    created_at TEXT NOT NULL,
    last_modified TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Chapter',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    -- Contiguous 0..n-1 within a novel. Rewritten wholesale on reorder.
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_modified TEXT NOT NULL,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chapters_novel
    ON chapters (novel_id, position);
`;
const CHAT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    context_entries TEXT,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_novel
    ON chat_messages (novel_id, created_at);
`;
const CODEX_SCHEMA = `
  CREATE TABLE IF NOT EXISTS codex_entries (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('person', 'place', 'item', 'event', 'organization', 'other')),
    name TEXT NOT NULL,
    fields TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_codex_entries_novel
    ON codex_entries (novel_id, type, name);
`;
const DISMISSALS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS codex_dismissed_suggestions (
    novel_id TEXT NOT NULL,
    name_key TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (novel_id, name_key),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
`;
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
const SETTINGS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Migration: flat documents → novels ▸ chapters
// ---------------------------------------------------------------------------
const hasLegacyDocuments = tableExists('documents');
if (hasLegacyDocuments) {
  // The v1 migration still has to run first — the copy below reads this column.
  if (tableExists('chat_messages') && !columnNames('chat_messages').includes('context_entries')) {
    db.exec('ALTER TABLE chat_messages ADD COLUMN context_entries TEXT');
  }
}
db.exec(NOVEL_SCHEMA);
/**
 * Rebuild a child table so its FK points at `novels` instead of `documents`.
 * Nothing references these tables, so ALTER TABLE ... RENAME is safe here.
 */
function rebuildChild(table, createSql, copySql) {
  if (!tableExists(table)) {
    db.exec(createSql);
    return;
  }
  db.exec(`ALTER TABLE ${table} RENAME TO ${table}_v1;`);
  db.exec(createSql);
  db.exec(copySql);
  db.exec(`DROP TABLE ${table}_v1;`);
}
const migrateDocumentsToNovels = db.transaction(() => {
  const documents = db.prepare('SELECT * FROM documents ORDER BY created_at ASC').all();
  const insertNovel = db.prepare(
    'INSERT INTO novels (id, title, created_at, last_modified) VALUES (?, ?, ?, ?)'
  );
  const insertChapter = db.prepare(`
    INSERT INTO chapters (id, novel_id, title, content, word_count, position, created_at, last_modified)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `);
  for (const doc of documents) {
    // The novel keeps the document's id, so chat_messages.document_id and
    // codex_entries.document_id migrate with a plain column rename.
    insertNovel.run(doc.id, doc.title || 'Untitled Novel', doc.created_at, doc.last_modified);
    insertChapter.run(
      randomUUID(),
      doc.id,
      'Chapter One',
      doc.content,
      doc.word_count,
      doc.created_at,
      doc.last_modified
    );
  }
  // Children first — while they still reference `documents`, we can't rename it.
  rebuildChild(
    'chat_messages',
    CHAT_SCHEMA,
    `INSERT INTO chat_messages (id, novel_id, role, content, created_at, context_entries)
       SELECT id, document_id, role, content, created_at, context_entries FROM chat_messages_v1;`
  );
  rebuildChild(
    'codex_entries',
    CODEX_SCHEMA,
    `INSERT INTO codex_entries (id, novel_id, type, name, fields, created_at, updated_at)
       SELECT id, document_id, type, name, fields, created_at, updated_at FROM codex_entries_v1;`
  );
  rebuildChild(
    'codex_dismissed_suggestions',
    DISMISSALS_SCHEMA,
    `INSERT INTO codex_dismissed_suggestions (novel_id, name_key, name, created_at)
       SELECT document_id, name_key, name, created_at FROM codex_dismissed_suggestions_v1;`
  );
  // Kept, not dropped. Recovery beats disk. Drop it yourself once you're happy:
  //   sqlite3 server/exlibris.db 'DROP TABLE documents_v1_backup;'
  db.exec('ALTER TABLE documents RENAME TO documents_v1_backup;');
  const violations = db.pragma('foreign_key_check');
  if (violations.length > 0) {
    throw new Error(`Migration produced FK violations: ${JSON.stringify(violations)}`);
  }
});
if (hasLegacyDocuments) {
  migrateDocumentsToNovels();
  console.log(
    '[exlibris] Migrated flat documents → novels ▸ chapters. ' +
      'Original rows preserved in `documents_v1_backup`.'
  );
} else {
  db.exec(CHAT_SCHEMA);
  db.exec(CODEX_SCHEMA);
  db.exec(DISMISSALS_SCHEMA);
}
db.exec(SETTINGS_SCHEMA);
// Added after the novels migration shipped, so unlike the tables above it is
// created unconditionally — IF NOT EXISTS upgrades existing libraries in place.
db.exec(SNAPSHOTS_SCHEMA);

// ---------------------------------------------------------------------------
// In-place column upgrades (idempotent, run on every start)
// ---------------------------------------------------------------------------
// Corkboard: a one-or-two-line synopsis per chapter, shown on its index card.
if (!columnNames('chapters').includes('synopsis')) {
  db.exec("ALTER TABLE chapters ADD COLUMN synopsis TEXT NOT NULL DEFAULT ''");
}
// Chapter metadata: workflow status, POV character, free-form tags (JSON
// array), and an optional card colour for the corkboard. All display/filter
// data — none of it participates in ordering.
if (!columnNames('chapters').includes('status')) {
  db.exec("ALTER TABLE chapters ADD COLUMN status TEXT NOT NULL DEFAULT 'idea'");
}
if (!columnNames('chapters').includes('pov')) {
  db.exec("ALTER TABLE chapters ADD COLUMN pov TEXT NOT NULL DEFAULT ''");
}
if (!columnNames('chapters').includes('tags')) {
  db.exec("ALTER TABLE chapters ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
}
if (!columnNames('chapters').includes('color')) {
  db.exec("ALTER TABLE chapters ADD COLUMN color TEXT NOT NULL DEFAULT ''");
}
// Corkboard arrangement per novel: JSON {"mode":"manuscript"|"custom",
// "order":[chapterIds]}. Kept on the novel (not per-chapter positions) so the
// planning order is one atomic value, separate from chapters.position — the
// manuscript's real order — which it must never silently affect.
if (!columnNames('novels').includes('corkboard')) {
  db.exec("ALTER TABLE novels ADD COLUMN corkboard TEXT NOT NULL DEFAULT '{}'");
}

db.pragma('foreign_keys = ON');
export default db;
