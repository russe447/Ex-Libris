// src/lib/chapterMeta.ts
//
// Chapter metadata vocabulary (statuses, card colours) and the filter
// predicate shared by the Corkboard and the sidebar chapter list.
//
// Filtering is faceted: within one dimension selections are OR'd (status
// Draft OR Revised), across dimensions they're AND'd (…AND pov Mara AND tag
// "heist"). It only ever decides VISIBILITY — nothing here knows about order.

export type ChapterStatus = 'idea' | 'draft' | 'revised' | 'complete';

interface ChapterMetaLike {
  status: ChapterStatus;
  pov: string;
  tags: string[];
}

export const CHAPTER_STATUSES: Array<{
  id: ChapterStatus;
  label: string;
  /** Badge colour — picked to read on every theme. */
  hex: string;
}> = [
  { id: 'idea', label: 'Idea', hex: '#8a8a8a' },
  { id: 'draft', label: 'Draft', hex: '#6b8cae' },
  { id: 'revised', label: 'Revised', hex: '#cd8a4e' },
  { id: 'complete', label: 'Complete', hex: '#7cb97c' },
];

export function statusInfo(id: string) {
  return CHAPTER_STATUSES.find((status) => status.id === id) ?? CHAPTER_STATUSES[0];
}

/** Card colours, Scrivener-label style. Muted hues that sit well on the
 *  parchment themes; ids mirror the server's whitelist. */
export const CARD_COLORS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'red', label: 'Red', hex: '#c75d5d' },
  { id: 'orange', label: 'Orange', hex: '#cd8a4e' },
  { id: 'yellow', label: 'Yellow', hex: '#c9a227' },
  { id: 'green', label: 'Green', hex: '#7cb97c' },
  { id: 'teal', label: 'Teal', hex: '#5da8a3' },
  { id: 'blue', label: 'Blue', hex: '#6b8cae' },
  { id: 'purple', label: 'Purple', hex: '#9a7fb8' },
  { id: 'pink', label: 'Pink', hex: '#bd7d99' },
];

export function cardColorHex(id: string): string | null {
  return CARD_COLORS.find((color) => color.id === id)?.hex ?? null;
}

export interface ChapterFilter {
  statuses: ChapterStatus[];
  /** Exact POV name, or null for all. */
  pov: string | null;
  tags: string[];
}

export const EMPTY_FILTER: ChapterFilter = { statuses: [], pov: null, tags: [] };

export function isFilterActive(filter: ChapterFilter): boolean {
  return filter.statuses.length > 0 || filter.pov !== null || filter.tags.length > 0;
}

export function matchesChapterFilter(chapter: ChapterMetaLike, filter: ChapterFilter): boolean {
  if (filter.statuses.length > 0 && !filter.statuses.includes(chapter.status)) return false;
  if (filter.pov !== null && chapter.pov !== filter.pov) return false;
  if (filter.tags.length > 0) {
    const have = new Set(chapter.tags.map((tag) => tag.toLowerCase()));
    // OR within the dimension: any selected tag qualifies.
    if (!filter.tags.some((tag) => have.has(tag.toLowerCase()))) return false;
  }
  return true;
}

/** Visibility only — input order is preserved, never rearranged. */
export function filterChapters<T extends ChapterMetaLike>(
  chapters: T[],
  filter: ChapterFilter
): T[] {
  if (!isFilterActive(filter)) return chapters;
  return chapters.filter((chapter) => matchesChapterFilter(chapter, filter));
}

/** Distinct POV names in manuscript order of first appearance. */
export function distinctPovs(chapters: Array<{ pov: string }>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const chapter of chapters) {
    if (chapter.pov && !seen.has(chapter.pov)) {
      seen.add(chapter.pov);
      result.push(chapter.pov);
    }
  }
  return result;
}

/** Distinct tags, case-insensitively deduped, in order of first appearance. */
export function distinctTags(chapters: Array<{ tags: string[] }>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const chapter of chapters) {
    for (const tag of chapter.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(tag);
      }
    }
  }
  return result;
}
