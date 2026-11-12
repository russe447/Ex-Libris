/**
 * A tiny, renderer-agnostic view of TipTap's HTML.
 *
 * Every exporter (Markdown, DOCX, PDF, …) needs the same thing: blocks in
 * order, each with inline runs that may be bold/italic. Parsing the HTML once
 * into this shape keeps the format-specific code to pure rendering.
 */

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'blockquote'
  | 'bullet'
  | 'ordered'
  | 'rule';

export interface Block {
  type: BlockType;
  runs: InlineRun[];
  /** 1-based index within its list. Only set for `ordered`. */
  index?: number;
}

export function blockText(block: Block): string {
  return block.runs.map((run) => run.text).join('');
}

const HEADING_TYPES: Record<string, BlockType> = {
  H1: 'heading1',
  H2: 'heading2',
  H3: 'heading3',
  H4: 'heading3',
  H5: 'heading3',
  H6: 'heading3',
};

/** Collapse runs that carry identical marks, and drop empty ones. */
function normalizeRuns(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = out[out.length - 1];
    if (
      previous &&
      !!previous.bold === !!run.bold &&
      !!previous.italic === !!run.italic &&
      !!previous.underline === !!run.underline
    ) {
      previous.text += run.text;
    } else {
      out.push({ ...run });
    }
  }
  return out;
}

function collectRuns(node: Node, marks: Omit<InlineRun, 'text'>, out: InlineRun[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // Collapse HTML whitespace the way a browser would.
    const text = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (text) out.push({ text, ...marks });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as HTMLElement;
  if (element.tagName === 'BR') {
    out.push({ text: '\n', ...marks });
    return;
  }
  const next = {
    bold: marks.bold || element.tagName === 'STRONG' || element.tagName === 'B',
    italic: marks.italic || element.tagName === 'EM' || element.tagName === 'I',
    underline: marks.underline || element.tagName === 'U',
  };
  element.childNodes.forEach((child) => collectRuns(child, next, out));
}

function runsOf(element: HTMLElement): InlineRun[] {
  const runs: InlineRun[] = [];
  collectRuns(element, {}, runs);
  return normalizeRuns(runs);
}

function walk(element: HTMLElement, blocks: Block[]): void {
  for (const child of Array.from(element.children) as HTMLElement[]) {
    const tag = child.tagName;

    if (HEADING_TYPES[tag]) {
      blocks.push({ type: HEADING_TYPES[tag], runs: runsOf(child) });
    } else if (tag === 'P') {
      blocks.push({ type: 'paragraph', runs: runsOf(child) });
    } else if (tag === 'BLOCKQUOTE') {
      // A blockquote holds paragraphs; flatten each into its own quote line.
      const inner: Block[] = [];
      walk(child, inner);
      if (inner.length === 0) inner.push({ type: 'paragraph', runs: runsOf(child) });
      for (const block of inner) blocks.push({ ...block, type: 'blockquote' });
    } else if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL';
      Array.from(child.children).forEach((item, index) => {
        blocks.push({
          type: ordered ? 'ordered' : 'bullet',
          runs: runsOf(item as HTMLElement),
          ...(ordered ? { index: index + 1 } : {}),
        });
      });
    } else if (tag === 'HR') {
      blocks.push({ type: 'rule', runs: [] });
    } else if (tag === 'PRE' || tag === 'DIV') {
      walk(child, blocks);
    } else {
      const runs = runsOf(child);
      if (runs.length) blocks.push({ type: 'paragraph', runs });
    }
  }
}

/** Parse chapter HTML into blocks. Empty blocks are preserved as blank lines. */
export function parseHtmlBlocks(html: string): Block[] {
  if (!html || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks: Block[] = [];
  walk(doc.body, blocks);
  return blocks;
}
