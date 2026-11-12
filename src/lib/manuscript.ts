import { ManuscriptChapter } from '@/types';
import { htmlToText } from '@/lib/nameSuggestions';
/** Server hard-caps at 120k; leave headroom for the outline and framing. */
const MAX_MANUSCRIPT_CONTEXT_CHARS = 110_000;
function formatOutlineRow(chapter: ManuscriptChapter, index: number, active: boolean, included: boolean) {
  const marker = active ? '  ← the author is writing here' : '';
  const omitted = included ? '' : '  (full text omitted for length)';
  return `${index + 1}. ${chapter.title} — ${chapter.wordCount.toLocaleString()} words${omitted}${marker}`;
}
/**
 * Pick which chapters fit in the budget.
 *
 * The active chapter is mandatory. After that we walk *backwards* — what
 * precedes the current scene matters far more for continuity than what follows
 * it (which may not be written yet). Only then do we walk forwards.
 */
function selectChapters(chapters: ManuscriptChapter[], activeIndex: number, texts: string[]): Set<number> {
  const chosen = new Set<number>();
  let budget = MAX_MANUSCRIPT_CONTEXT_CHARS;
  if (activeIndex >= 0) {
    chosen.add(activeIndex);
    budget -= texts[activeIndex].length;
  }
  let back = activeIndex - 1;
  let forward = activeIndex + 1;
  while (back >= 0 || forward < chapters.length) {
    if (back >= 0) {
      if (texts[back].length <= budget) {
        chosen.add(back);
        budget -= texts[back].length;
      }
      back -= 1;
    }
    if (forward < chapters.length) {
      if (texts[forward].length <= budget) {
        chosen.add(forward);
        budget -= texts[forward].length;
      }
      forward += 1;
    }
    if (budget <= 0) break;
  }
  return chosen;
}
/**
 * Build the novel-scoped chat context.
 *
 * Always includes an outline of every chapter (cheap, and it tells the model
 * what exists even when the prose didn't fit). Prose is converted to plain
 * text — the old code shipped raw TipTap HTML to Claude, which roughly doubled
 * the token cost for zero benefit.
 */
export function buildManuscriptContext(
  novelTitle: string,
  chapters: ManuscriptChapter[],
  activeChapterId: string | null,
  /** The live editor buffer, which may be newer than the server's copy. */
  liveChapterHtml?: string
): string {
  if (chapters.length === 0) return '';
  const ordered = [...chapters].sort((a, b) => a.position - b.position);
  const activeIndex = ordered.findIndex((chapter) => chapter.id === activeChapterId);
  const texts = ordered.map((chapter, index) => {
    const html = index === activeIndex && liveChapterHtml !== undefined ? liveChapterHtml : chapter.content;
    return htmlToText(html);
  });
  const chosen = selectChapters(ordered, activeIndex, texts);
  const outline = ordered
    .map((chapter, index) => formatOutlineRow(chapter, index, index === activeIndex, chosen.has(index)))
    .join('\n');
  const prose = ordered
    .map((chapter, index) =>
      chosen.has(index) && texts[index].trim()
        ? `## Chapter ${index + 1}: ${chapter.title}\n\n${texts[index]}`
        : null
    )
    .filter(Boolean)
    .join('\n\n');
  return [
    `NOVEL: ${novelTitle}`,
    '',
    'CHAPTER OUTLINE:',
    outline,
    '',
    'MANUSCRIPT:',
    prose || '(no prose written yet)',
  ].join('\n');
}
/* ------------------------------------------------------ context scopes */

/**
 * How much of the novel the assistant is told about.
 *
 * Defaults to `chapter`: most questions are about the scene in front of you,
 * and shipping the whole novel every time is slow, expensive, and dilutes the
 * part that actually matters.
 */
export type ChatContextScope = 'none' | 'chapter' | 'outline' | 'novel';

export const CHAT_CONTEXT_SCOPES: {
  id: ChatContextScope;
  label: string;
  description: string;
}[] = [
  { id: 'chapter', label: 'This chapter', description: 'Only the chapter you have open' },
  { id: 'outline', label: 'Outline only', description: 'Chapter titles and lengths, no prose' },
  { id: 'novel', label: 'Full novel', description: 'Every chapter, as far as the limit allows' },
  { id: 'none', label: 'No manuscript', description: 'Just the conversation and any codex entries' },
];

export function isChatContextScope(value: unknown): value is ChatContextScope {
  return typeof value === 'string' && CHAT_CONTEXT_SCOPES.some((scope) => scope.id === value);
}

/** The outline alone — cheap orientation without any prose. */
export function buildOutlineContext(
  novelTitle: string,
  chapters: ManuscriptChapter[],
  activeChapterId: string | null
): string {
  if (chapters.length === 0) return '';
  const ordered = [...chapters].sort((a, b) => a.position - b.position);
  const outline = ordered
    .map(
      (chapter, index) =>
        `${index + 1}. ${chapter.title} — ${chapter.wordCount.toLocaleString()} words${
          chapter.id === activeChapterId ? '  ← the author is writing here' : ''
        }`
    )
    .join('\n');

  return [
    `NOVEL: ${novelTitle}`,
    '',
    'CHAPTER OUTLINE (prose withheld at the author’s request):',
    outline,
  ].join('\n');
}

/**
 * One chapter's prose, framed by where it sits in the novel so the model
 * doesn't assume chapter 7 is the opening.
 */
export function buildChapterContext(
  novelTitle: string,
  chapters: ManuscriptChapter[],
  activeChapterId: string | null,
  liveChapterHtml?: string
): string {
  if (!activeChapterId) return '';
  const ordered = [...chapters].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((chapter) => chapter.id === activeChapterId);
  if (index === -1) return '';

  const chapter = ordered[index];
  const text = htmlToText(liveChapterHtml !== undefined ? liveChapterHtml : chapter.content).slice(
    0,
    MAX_MANUSCRIPT_CONTEXT_CHARS
  );

  return [
    `NOVEL: ${novelTitle}`,
    `SCOPE: chapter ${index + 1} of ${ordered.length} only — the rest of the manuscript was not shared.`,
    '',
    `## Chapter ${index + 1}: ${chapter.title}`,
    '',
    text.trim() || '(this chapter is empty so far)',
  ].join('\n');
}

/** Dispatch to the builder for a scope. Returns undefined when nothing applies. */
export function buildScopedContext(
  scope: ChatContextScope,
  novelTitle: string,
  chapters: ManuscriptChapter[],
  activeChapterId: string | null,
  liveChapterHtml?: string
): string | undefined {
  switch (scope) {
    case 'none':
      return undefined;
    case 'outline':
      return buildOutlineContext(novelTitle, chapters, activeChapterId) || undefined;
    case 'chapter':
      return (
        buildChapterContext(novelTitle, chapters, activeChapterId, liveChapterHtml) || undefined
      );
    case 'novel':
      return buildManuscriptContext(novelTitle, chapters, activeChapterId, liveChapterHtml) || undefined;
    default:
      return undefined;
  }
}
