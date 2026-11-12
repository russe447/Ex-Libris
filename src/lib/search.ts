import { ManuscriptChapter } from '@/types';
import { htmlToText } from '@/lib/nameSuggestions';

export interface SearchHit {
  chapterId: string;
  chapterTitle: string;
  chapterPosition: number;
  /** Which occurrence this is *within its chapter* — the editor uses it to jump. */
  occurrence: number;
  /** Snippet split around the match so the UI can highlight without regex. */
  before: string;
  match: string;
  after: string;
  /** True when the snippet was cut at the start/end. */
  truncatedStart: boolean;
  truncatedEnd: boolean;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export const MIN_QUERY_LENGTH = 2;
const SNIPPET_PADDING = 60;
const MAX_HITS_PER_CHAPTER = 50;
const MAX_HITS_TOTAL = 300;

function isWordChar(char: string | undefined): boolean {
  return !!char && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Trim a snippet edge to a word boundary so results don't start mid-syllable.
 * Returns the adjusted slice index.
 */
function snapStart(text: string, index: number): number {
  if (index <= 0) return 0;
  const space = text.indexOf(' ', index);
  return space === -1 || space > index + 15 ? index : space + 1;
}

function snapEnd(text: string, index: number): number {
  if (index >= text.length) return text.length;
  const space = text.lastIndexOf(' ', index);
  return space === -1 || space < index - 15 ? index : space;
}

/** All match offsets of `query` in `text`, respecting the options. */
export function findMatches(text: string, query: string, options: SearchOptions = {}): number[] {
  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  if (!needle) return [];

  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    from = index + needle.length;
    if (options.wholeWord) {
      const before = haystack[index - 1];
      const after = haystack[index + needle.length];
      if (isWordChar(before) || isWordChar(after)) continue;
    }
    offsets.push(index);
  }
  return offsets;
}

/**
 * Search every chapter of a manuscript.
 *
 * The prose is flattened to text first (the same way the chat context is), so
 * a phrase that straddles a bold run still matches — searching raw HTML would
 * miss it and would also happily match tag names.
 */
export function searchManuscript(
  chapters: ManuscriptChapter[],
  query: string,
  options: SearchOptions = {}
): SearchHit[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const hits: SearchHit[] = [];
  const ordered = [...chapters].sort((a, b) => a.position - b.position);

  for (const chapter of ordered) {
    const text = htmlToText(chapter.content).replace(/\s+/g, ' ').trim();
    const offsets = findMatches(text, trimmed, options);

    offsets.slice(0, MAX_HITS_PER_CHAPTER).forEach((offset, occurrence) => {
      const end = offset + trimmed.length;
      const rawStart = Math.max(0, offset - SNIPPET_PADDING);
      const rawEnd = Math.min(text.length, end + SNIPPET_PADDING);
      const start = snapStart(text, rawStart);
      const stop = snapEnd(text, rawEnd);

      hits.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterPosition: chapter.position,
        occurrence,
        before: text.slice(start, offset),
        match: text.slice(offset, end),
        after: text.slice(end, stop),
        truncatedStart: start > 0,
        truncatedEnd: stop < text.length,
      });
    });

    if (hits.length >= MAX_HITS_TOTAL) break;
  }

  return hits.slice(0, MAX_HITS_TOTAL);
}
