import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Loader2, X, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLibraryStore } from '@/stores/libraryStore';
import { useEditorStore } from '@/stores/editorStore';
import {
  EXPORT_FORMATS,
  ExportFormat,
  buildExport,
  downloadBlob,
  exportFilename,
} from '@/lib/export';
import * as novelsService from '@/services/novels';
import { cn } from '@/lib/utils';
import { onUiCommand } from '@/lib/uiBus';

export function ExportDialog({ children }: { children: React.ReactNode }) {
  const novels = useLibraryStore((state) => state.novels);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const chapters = useLibraryStore((state) => state.chapters);
  const novel = novels.find((candidate) => candidate.id === activeNovelId);

  const [isOpen, setIsOpen] = useState(false);

  // Desktop menu File ▸ Export Manuscript… opens this same dialog.
  useEffect(() => onUiCommand('open-export', () => setIsOpen(true)), []);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneFormat, setDoneFormat] = useState<ExportFormat | null>(null);

  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  const handleExport = async () => {
    if (!activeNovelId || !novel) return;
    setIsExporting(true);
    setError(null);
    setDoneFormat(null);
    try {
      // Persist the open chapter first — exporting prose you just typed but
      // haven't autosaved yet is the whole point of flushing here.
      await useEditorStore.getState().flush();
      const manuscript = await novelsService.fetchManuscript(activeNovelId);
      const editor = useEditorStore.getState();
      const blob = await buildExport(
        {
          novelTitle: novel.title,
          chapters: manuscript,
          liveChapter: editor.chapterId
            ? { id: editor.chapterId, content: editor.content }
            : undefined,
        },
        format
      );
      downloadBlob(blob, exportFilename(novel.title, format));
      setDoneFormat(format);
    } catch (exportError) {
      console.error('Export failed:', exportError);
      setError('Could not build that file. Try again, or pick another format.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(next) => {
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
          </div>

          <div className="flex items-center justify-between gap-3 px-5 pb-5">
            <p className="text-[11px] min-w-0 flex-1">
              {error ? (
                <span className="text-academia-error">{error}</span>
              ) : doneFormat ? (
                <span className="text-academia-success">
                  Saved {exportFilename(novel?.title ?? '', doneFormat)}
                </span>
              ) : (
                <span className="text-academia-text-muted truncate block">
                  {novel ? exportFilename(novel.title, format) : ''}
                </span>
              )}
            </p>
            <Button
              onClick={() => void handleExport()}
              disabled={!novel || isExporting || chapters.length === 0}
              className="gap-2 shrink-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{isExporting ? 'Building…' : 'Export'}</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
