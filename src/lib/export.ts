import { ManuscriptChapter } from '@/types';
import { Block, blockText, InlineRun, parseHtmlBlocks } from '@/lib/richText';

export type ExportFormat = 'pdf' | 'docx' | 'md' | 'txt' | 'html';

export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  description: string;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { id: 'pdf', label: 'PDF', extension: 'pdf', description: 'Print-ready, one chapter per page' },
  { id: 'docx', label: 'Word', extension: 'docx', description: 'Editable .docx with chapter headings' },
  { id: 'md', label: 'Markdown', extension: 'md', description: 'Plain text with formatting preserved' },
  { id: 'txt', label: 'Plain text', extension: 'txt', description: 'No formatting, just the prose' },
  { id: 'html', label: 'HTML', extension: 'html', description: 'Single styled web page' },
];

export interface ManuscriptExport {
  novelTitle: string;
  chapters: ManuscriptChapter[];
  /**
   * The live editor buffer for the chapter that's currently open. The server's
   * copy can be up to one autosave behind, and exporting stale prose is the
   * kind of bug you only notice after you've emailed the file.
   */
  liveChapter?: { id: string; content: string };
}

interface PreparedChapter {
  title: string;
  blocks: Block[];
}

function prepare({ chapters, liveChapter }: ManuscriptExport): PreparedChapter[] {
  return chapters.map((chapter) => ({
    title: chapter.title,
    blocks: parseHtmlBlocks(
      liveChapter && liveChapter.id === chapter.id ? liveChapter.content : chapter.content
    ),
  }));
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'manuscript';
}

export function exportFilename(novelTitle: string, format: ExportFormat): string {
  const info = EXPORT_FORMATS.find((entry) => entry.id === format)!;
  return `${slugify(novelTitle)}.${info.extension}`;
}

/* ------------------------------------------------------------------ text */

function prefixFor(block: Block, flavour: 'md' | 'txt'): string {
  switch (block.type) {
    case 'heading1':
      return flavour === 'md' ? '## ' : '';
    case 'heading2':
      return flavour === 'md' ? '### ' : '';
    case 'heading3':
      return flavour === 'md' ? '#### ' : '';
    case 'blockquote':
      return flavour === 'md' ? '> ' : '    ';
    case 'bullet':
      return flavour === 'md' ? '- ' : '• ';
    case 'ordered':
      return `${block.index ?? 1}. `;
    default:
      return '';
  }
}

function markdownRun(run: InlineRun): string {
  // Escape the characters that would otherwise become markup.
  let text = run.text.replace(/([\\`*_[\]])/g, '\\$1');
  if (run.bold) text = `**${text}**`;
  if (run.italic) text = `*${text}*`;
  if (run.underline && !run.bold && !run.italic) text = `_${text}_`;
  return text;
}

function renderText(data: ManuscriptExport, flavour: 'md' | 'txt'): string {
  const chapters = prepare(data);
  const lines: string[] = [];

  if (flavour === 'md') lines.push(`# ${data.novelTitle}`, '');
  else lines.push(data.novelTitle.toUpperCase(), '');

  chapters.forEach((chapter, index) => {
    if (index > 0) lines.push('', flavour === 'md' ? '---' : '* * *', '');
    lines.push(flavour === 'md' ? `## ${chapter.title}` : chapter.title.toUpperCase(), '');

    for (const block of chapter.blocks) {
      if (block.type === 'rule') {
        lines.push(flavour === 'md' ? '---' : '* * *', '');
        continue;
      }
      const body =
        flavour === 'md' ? block.runs.map(markdownRun).join('') : blockText(block);
      lines.push(`${prefixFor(block, flavour)}${body}`.trimEnd());
      // Lists read better tight; everything else gets a blank line.
      if (block.type !== 'bullet' && block.type !== 'ordered') lines.push('');
    }
  });

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/* ------------------------------------------------------------------ html */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlRun(run: InlineRun): string {
  let text = escapeHtml(run.text).replace(/\n/g, '<br />');
  if (run.bold) text = `<strong>${text}</strong>`;
  if (run.italic) text = `<em>${text}</em>`;
  if (run.underline) text = `<u>${text}</u>`;
  return text;
}

function renderHtml(data: ManuscriptExport): string {
  const chapters = prepare(data);
  const body = chapters
    .map((chapter) => {
      const blocks: string[] = [`<h2>${escapeHtml(chapter.title)}</h2>`];
      let listBuffer: { ordered: boolean; items: string[] } | null = null;

      const flushList = () => {
        if (!listBuffer) return;
        const tag = listBuffer.ordered ? 'ol' : 'ul';
        blocks.push(`<${tag}>${listBuffer.items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`);
        listBuffer = null;
      };

      for (const block of chapter.blocks) {
        const inner = block.runs.map(htmlRun).join('');
        if (block.type === 'bullet' || block.type === 'ordered') {
          const ordered = block.type === 'ordered';
          if (!listBuffer || listBuffer.ordered !== ordered) {
            flushList();
            listBuffer = { ordered, items: [] };
          }
          listBuffer.items.push(inner);
          continue;
        }
        flushList();
        if (block.type === 'rule') blocks.push('<hr />');
        else if (block.type === 'heading1') blocks.push(`<h3>${inner}</h3>`);
        else if (block.type === 'heading2') blocks.push(`<h4>${inner}</h4>`);
        else if (block.type === 'heading3') blocks.push(`<h5>${inner}</h5>`);
        else if (block.type === 'blockquote') blocks.push(`<blockquote><p>${inner}</p></blockquote>`);
        else blocks.push(`<p>${inner || '&nbsp;'}</p>`);
      }
      flushList();
      return `<section class="chapter">${blocks.join('\n')}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.novelTitle)}</title>
<style>
  body { margin: 0 auto; max-width: 38em; padding: 4em 1.5em; background: #fdfcf9; color: #23201c;
         font-family: Georgia, "Iowan Old Style", serif; line-height: 1.7; }
  h1 { text-align: center; font-size: 2.2em; margin-bottom: 2em; }
  h2 { margin-top: 0; font-size: 1.5em; }
  .chapter { page-break-before: always; margin-bottom: 4em; }
  .chapter:first-of-type { page-break-before: auto; }
  p { margin: 0 0 1em; text-align: justify; }
  blockquote { margin: 1em 0 1em 1.5em; font-style: italic; color: #4a443c; }
  hr { border: none; text-align: center; margin: 2em 0; }
  hr::before { content: "* * *"; letter-spacing: 0.5em; }
</style>
</head>
<body>
<h1>${escapeHtml(data.novelTitle)}</h1>
${body}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ docx */

async function renderDocx(data: ManuscriptExport): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  const chapters = prepare(data);

  const toRuns = (block: Block) => {
    // Word's numbering definitions are more trouble than they're worth here;
    // ordered items carry their own visible number instead.
    const runs =
      block.type === 'ordered'
        ? [{ text: `${block.index ?? 1}. ` }, ...block.runs]
        : block.runs;
    return runs.length
      ? runs.map(
          (run) =>
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              underline: run.underline ? {} : undefined,
            })
        )
      : [new TextRun({ text: '' })];
  };

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({
      text: data.novelTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  ];

  chapters.forEach((chapter, chapterIndex) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: chapterIndex > 0,
        children: [new TextRun({ text: chapter.title })],
      })
    );

    for (const block of chapter.blocks) {
      if (block.type === 'rule') {
        children.push(new Paragraph({ text: '* * *', alignment: AlignmentType.CENTER }));
        continue;
      }
      const heading =
        block.type === 'heading1'
          ? HeadingLevel.HEADING_2
          : block.type === 'heading2'
            ? HeadingLevel.HEADING_3
            : block.type === 'heading3'
              ? HeadingLevel.HEADING_4
              : undefined;

      children.push(
        new Paragraph({
          children: toRuns(block),
          heading,
          bullet: block.type === 'bullet' ? { level: 0 } : undefined,
          ...(block.type === 'blockquote' ? { indent: { left: 720 } } : {}),
        })
      );
    }
  });

  const doc = new Document({
    creator: 'Ex Libris',
    title: data.novelTitle,
    styles: {
      default: {
        document: { run: { font: 'Georgia', size: 24 } },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

/* ------------------------------------------------------------------- pdf */

async function renderPdf(data: ManuscriptExport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const chapters = prepare(data);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 72;
  const maxWidth = pageWidth - margin * 2;
  const bottom = pageHeight - margin;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const write = (
    text: string,
    { size = 11, style = 'normal', align = 'left', indent = 0, spacing = 6 } = {}
  ) => {
    doc.setFont('times', style);
    doc.setFontSize(size);
    const lineHeight = size * 1.45;
    const lines: string[] = text ? doc.splitTextToSize(text, maxWidth - indent) : [''];
    for (const line of lines) {
      if (y + lineHeight > bottom) newPage();
      const x = align === 'center' ? pageWidth / 2 : margin + indent;
      doc.text(line, x, y, align === 'center' ? { align: 'center' } : undefined);
      y += lineHeight;
    }
    y += spacing;
  };

  // Title page.
  y = pageHeight / 3;
  write(data.novelTitle, { size: 26, style: 'bold', align: 'center', spacing: 18 });

  chapters.forEach((chapter) => {
    newPage();
    write(chapter.title, { size: 17, style: 'bold', spacing: 16 });

    for (const block of chapter.blocks) {
      const text = blockText(block);
      switch (block.type) {
        case 'rule':
          write('* * *', { align: 'center', spacing: 10 });
          break;
        case 'heading1':
          write(text, { size: 14, style: 'bold', spacing: 8 });
          break;
        case 'heading2':
        case 'heading3':
          write(text, { size: 12, style: 'bold', spacing: 8 });
          break;
        case 'blockquote':
          write(text, { style: 'italic', indent: 28 });
          break;
        case 'bullet':
          write(`•  ${text}`, { indent: 18, spacing: 2 });
          break;
        case 'ordered':
          write(`${block.index ?? 1}.  ${text}`, { indent: 18, spacing: 2 });
          break;
        default:
          write(text);
      }
    }
  });

  // Page numbers, skipping the title page.
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(String(page - 1), pageWidth / 2, pageHeight - margin / 2, { align: 'center' });
  }

  return doc.output('blob');
}

/* ---------------------------------------------------------------- driver */

export async function buildExport(
  data: ManuscriptExport,
  format: ExportFormat
): Promise<Blob> {
  switch (format) {
    case 'txt':
      return new Blob([renderText(data, 'txt')], { type: 'text/plain;charset=utf-8' });
    case 'md':
      return new Blob([renderText(data, 'md')], { type: 'text/markdown;charset=utf-8' });
    case 'html':
      return new Blob([renderHtml(data)], { type: 'text/html;charset=utf-8' });
    case 'docx':
      return renderDocx(data);
    case 'pdf':
      return renderPdf(data);
    default:
      throw new Error(`Unsupported export format: ${format as string}`);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
