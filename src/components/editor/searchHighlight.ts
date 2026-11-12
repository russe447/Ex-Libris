import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { findMatches, SearchOptions } from '@/lib/search';

export const searchHighlightKey = new PluginKey<DecorationSet>('exlibrisSearchHighlight');

/**
 * Flattens the document to the same shape `searchManuscript` sees (single
 * spaces, no block markup) while remembering the ProseMirror position of every
 * surviving character. That mapping is what lets a hit found in plain text be
 * turned back into a selection.
 */
export function flattenDoc(doc: ProseMirrorNode): { text: string; positions: number[] } {
  const chars: string[] = [];
  const positions: number[] = [];

  const push = (char: string, pos: number) => {
    const isSpace = /\s/.test(char);
    if (isSpace) {
      // Collapse whitespace runs, and never start the text with one.
      if (chars.length === 0 || /\s/.test(chars[chars.length - 1])) return;
      chars.push(' ');
      positions.push(pos);
      return;
    }
    chars.push(char);
    positions.push(pos);
  };

  doc.descendants((node, pos) => {
    if (node.isText) {
      const text = node.text ?? '';
      for (let i = 0; i < text.length; i += 1) push(text[i], pos + i);
      return false;
    }
    if (node.isBlock && chars.length > 0) {
      // Block boundary reads as a space, matching htmlToText's newline.
      push(' ', pos);
    }
    return true;
  });

  // Drop a trailing space so offsets line up with the trimmed search text.
  while (chars.length && /\s/.test(chars[chars.length - 1])) {
    chars.pop();
    positions.pop();
  }

  return { text: chars.join(''), positions };
}

/**
 * Resolve the `occurrence`-th match of `query` to a document range.
 * Falls back to the last available occurrence if the document drifted since
 * the search ran (an edit elsewhere can remove an earlier match).
 */
export function findMatchRange(
  doc: ProseMirrorNode,
  query: string,
  occurrence: number,
  options: SearchOptions = {}
): { from: number; to: number } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const { text, positions } = flattenDoc(doc);
  const offsets = findMatches(text, trimmed, options);
  if (offsets.length === 0) return null;

  const offset = offsets[Math.min(occurrence, offsets.length - 1)];
  const start = positions[offset];
  const lastCharPos = positions[offset + trimmed.length - 1];
  if (start === undefined || lastCharPos === undefined) return null;

  return { from: start, to: lastCharPos + 1 };
}

interface HighlightMeta {
  from: number;
  to: number;
}

/**
 * Paints a transient highlight over a range. It's a decoration rather than a
 * mark so it never touches the document — nothing to undo, nothing to save.
 */
export const SearchHighlight = Extension.create({
  name: 'exlibrisSearchHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: searchHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(searchHighlightKey) as HighlightMeta | null | undefined;
            if (meta === null) return DecorationSet.empty;
            if (meta) {
              return DecorationSet.create(tr.doc, [
                Decoration.inline(meta.from, meta.to, { class: 'search-match-highlight' }),
              ]);
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return searchHighlightKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
