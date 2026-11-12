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
/** Same guard for the paragraph pass (a middle this tangled isn't diffable anyway). */
const MAX_PARAGRAPH_LCS_PRODUCT = 1_000_000;

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
