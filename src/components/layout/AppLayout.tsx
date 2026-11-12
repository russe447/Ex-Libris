import { ReactNode, useState, useRef, useEffect } from 'react';
import { BookOpen, Edit2, Check, X, ChevronRight, Search, Download } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ViewSwitcher } from './ViewSwitcher';
import { useEditorStore } from '@/stores/editorStore';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { QuickThemeSwitcher } from '@/components/theme/QuickThemeSwitcher';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Button } from '@/components/ui/Button';
/** The chapter title is the editable one. The novel is renamed in the Library. */
function Breadcrumb() {
  const novels = useLibraryStore((state) => state.novels);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const chapters = useLibraryStore((state) => state.chapters);
  const activeChapterId = useLibraryStore((state) => state.activeChapterId);
  const renameChapter = useLibraryStore((state) => state.renameChapter);
  const novel = novels.find((n) => n.id === activeNovelId);
  const chapter = chapters.find((c) => c.id === activeChapterId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);
  if (!novel) {
    return <span className="text-sm text-academia-text-muted">No novel open</span>;
  }
  const save = () => {
    const trimmed = editValue.trim();
    if (chapter && trimmed && trimmed !== chapter.title) void renameChapter(chapter.id, trimmed);
    setIsEditing(false);
  };
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-sm text-academia-text-muted truncate max-w-[180px]">{novel.title}</span>
      <ChevronRight className="h-3.5 w-3.5 text-academia-text-muted/50 shrink-0" />
      {!chapter ? (
        <span className="text-sm text-academia-text-muted">No chapter</span>
      ) : isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            maxLength={200}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); save(); }
              if (event.key === 'Escape') { event.preventDefault(); setIsEditing(false); }
            }}
            className="h-7 px-2 text-sm min-w-[200px] max-w-[400px]"
          />
          <button onMouseDown={(e) => e.preventDefault()} onClick={save} className="p-1 rounded text-academia-success" title="Save">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => setIsEditing(false)} className="p-1 rounded text-academia-text-muted hover:text-academia-error" title="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setEditValue(chapter.title); setIsEditing(true); }}
          className={cn(
            'flex items-center gap-2 group text-sm text-academia-text-secondary',
            'hover:text-academia-text-primary transition-colors px-2 py-1 rounded hover:bg-academia-bg-tertiary'
          )}
          title="Click to rename this chapter"
        >
          <span className="truncate max-w-[260px]">{chapter.title}</span>
          <Edit2 className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
}
export function AppLayout({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) {
  const chapterWords = useEditorStore((state) => state.wordCount);
  const novelWords = useLibraryStore((state) =>
    state.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  );
  const view = useWorkspaceStore((state) => state.view);
  const setView = useWorkspaceStore((state) => state.setView);
  const cycleView = useWorkspaceStore((state) => state.cycleView);

  // Ctrl/Cmd+\ cycles views; Esc leaves Focus. Both are ignored while you're
  // typing anywhere other than the canvas itself.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target.isContentEditable && !target.classList.contains('tiptap-editor')));

      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        cycleView();
        return;
      }
      // Ctrl/Cmd+F searches the novel, not the rendered page — the page only
      // holds one chapter, so the browser's find would quietly lie.
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        useWorkspaceStore.getState().openSidebarTab('search');
        return;
      }
      if (event.key === 'Escape' && !inField && useWorkspaceStore.getState().view === 'focus') {
        event.preventDefault();
        setView('write');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleView, setView]);

  // Focus: the editor and nothing else. The switcher sits faintly at the foot
  // of the screen and brightens on hover, so there's always a way out that
  // isn't a keyboard shortcut.
  if (view === 'focus') {
    return (
      <div className="relative h-screen flex flex-col bg-academia-bg-primary overflow-hidden">
        <main className="flex-1 overflow-hidden px-6 py-4">{children}</main>
        {/* Bottom-centre so it never collides with the editor toolbar. */}
        <div className="group/chrome absolute bottom-0 left-0 right-0 z-40 flex justify-center pb-3 pt-8 pointer-events-none">
          <div className="pointer-events-auto opacity-20 hover:opacity-100 group-hover/chrome:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center gap-2 px-2 py-1 rounded-lg bg-academia-bg-secondary/95 border border-academia-border shadow-lg">
            <ViewSwitcher />
            <span className="text-[11px] text-academia-text-muted px-1 tabular-nums">
              {chapterWords.toLocaleString()} words
            </span>
            <span className="text-[11px] text-academia-text-muted/60 px-1 hidden sm:inline">Esc to exit</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-academia-bg-primary overflow-hidden">
      <header className="shrink-0 h-14 bg-academia-bg-secondary border-b border-academia-border flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-academia-accent/20">
            <BookOpen className="h-4 w-4 text-academia-accent" />
          </div>
          <span className="font-display text-xl font-semibold text-academia-text-primary">Ex Libris</span>
          <ViewSwitcher />
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <Breadcrumb />
          <span
            className="text-xs text-academia-text-muted px-2 py-1 bg-academia-bg-tertiary rounded shrink-0"
            title={`${novelWords.toLocaleString()} words in this novel`}
          >
            {chapterWords.toLocaleString()} words
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => useWorkspaceStore.getState().openSidebarTab('search')}
            title="Search this novel (Ctrl/Cmd+F)"
          >
            <Search className="h-4 w-4" />
          </Button>
          <ExportDialog>
            <Button variant="ghost" size="icon" title="Export manuscript">
              <Download className="h-4 w-4" />
            </Button>
          </ExportDialog>
          <QuickThemeSwitcher />
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 p-6 overflow-hidden">{children}</main>
        {sidebar}
      </div>
    </div>
  );
}
