// src/types/index.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Codex entries that were attached when this message was sent. */
  codexEntries?: CodexEntryRef[];
}

export interface ShadowSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  instruction: string;
  position: {
    from: number;
    to: number;
  };
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Novel {
  id: string;
  title: string;
  createdAt: Date;
  lastModified: Date;
}
/** A novel as it appears in the library list — rolls up its chapters. */
export interface NovelSummary extends Novel {
  chapterCount: number;
  wordCount: number;
}
export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  /** One-or-two-line card text for the Corkboard. Empty until written. */
  synopsis: string;
  wordCount: number;
  /** Contiguous 0..n-1 within the novel. The server owns this. */
  position: number;
  createdAt: Date;
  lastModified: Date;
}
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
/** One chapter's full prose, for context building and codex scanning. */
export interface ManuscriptChapter {
  id: string;
  title: string;
  position: number;
  wordCount: number;
  content: string;
}

export interface RefineRequest {
  selectedText: string;
  instruction: string;
  precedingContext: string;
}

export interface RefineResponse {
  refinedText: string;
  /** Which model the router picked. Absent on older servers. */
  route?: import('@/services/settings').RouteInfo;
}

export type CodexEntryType =
  | 'person'
  | 'place'
  | 'item'
  | 'event'
  | 'organization'
  | 'other';

export interface CodexEntry {
  id: string;
  novelId: string;
  type: CodexEntryType;
  name: string;
  /** Type-specific fields, keyed by the schema in src/lib/codex.ts */
  fields: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

/** Immutable snapshot of an entry attached to a chat message. */
export interface CodexEntryRef {
  id: string;
  name: string;
  type: CodexEntryType;
}

/** A repeated capitalized name detected in the manuscript, not yet in the Codex. */
export interface CodexSuggestion {
  /** Normalized, lowercase — the stable identity used for dismissals. */
  key: string;
  /** Display form (most frequent spelling found in the text). */
  name: string;
  /** Heuristic guess; the user can override before adding. */
  type: CodexEntryType;
  /** How many times the name appears in the document. */
  count: number;
  /** One sentence of surrounding prose, for disambiguation. */
  context: string;
}
/** A suggestion the user explicitly disregarded — never offered again. */
export interface DismissedSuggestion {
  nameKey: string;
  name: string;
  createdAt: string;
}
