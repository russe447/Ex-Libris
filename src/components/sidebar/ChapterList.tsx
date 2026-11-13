import { useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, Loader2, Check, X, Edit2, FileText, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLibraryStore } from '@/stores/libraryStore';
import { useEditorStore } from '@/stores/editorStore';
import { useChapterFilterStore } from '@/stores/chapterFilterStore';
import { ChapterFilterBar } from '@/components/chapters/ChapterFilterBar';
import { cardColorHex, isFilterActive, matchesChapterFilter, statusInfo } from '@/lib/chapterMeta';
import { cn } from '@/lib/utils';
/** Move `from` to `to` in a copy of the array. */
function reindex<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
export function ChapterList() {
  const chapters = useLibraryStore((state) => state.chapters);
  const activeChapterId = useLibraryStore((state) => state.activeChapterId);
  const isLoadingChapters = useLibraryStore((state) => state.isLoadingChapters);
  const isMutating = useLibraryStore((state) => state.isMutating);
  const { openChapter, createChapter, renameChapter, deleteChapter, reorderChapters } =
    useLibraryStore();
  const isSaving = useEditorStore((state) => state.isSaving);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Visibility only, never order: the visible rows keep their manuscript
  // order, so clicking through a filtered POV reads that thread in sequence.
  const filter = useChapterFilterStore();
  const isFiltering = isFilterActive(filter);
  const visible = isFiltering
    ? chapters.filter((chapter) => matchesChapterFilter(chapter, filter))
    : chapters;
  // Reordering a partial view would corrupt what it can't see.
  const canReorder = !isFiltering;
  // HTML5 DnD drags whatever element carries `draggable`. To restrict the drag
  // to the grip, we arm a flag on pointerdown and veto any dragstart without it.
  const handleArmed = useRef(false);
  const commitDrop = () => {
    if (!canReorder || !draggingId || dropIndex === null) return;
    const from = chapters.findIndex((chapter) => chapter.id === draggingId);
    // Removing the dragged row shifts every later index down by one.
    const to = dropIndex > from ? dropIndex - 1 : dropIndex;
    if (from !== -1 && from !== to) {
      void reorderChapters(reindex(chapters, from, to).map((chapter) => chapter.id));
    }
    setDraggingId(null);
    setDropIndex(null);
    handleArmed.current = false;
  };
  const moveByKeyboard = (index: number, delta: number) => {
    if (!canReorder) return;
    const target = index + delta;
    if (target < 0 || target >= chapters.length) return;
    void reorderChapters(reindex(chapters, index, target).map((chapter) => chapter.id));
  };
  const startRename = (chapterId: string, title: string) => {
    setRenamingId(chapterId);
    setDraftTitle(title);
  };
  const commitRename = (chapterId: string) => {
    const trimmed = draftTitle.trim();
    const current = chapters.find((chapter) => chapter.id === chapterId);
    if (trimmed && current && trimmed !== current.title) {
      void renameChapter(chapterId, trimmed);
    }
    setRenamingId(null);
    setDraftTitle('');
  };
  const handleDelete = (chapterId: string, title: string) => {
    if (chapters.length === 1) {
      window.alert('A novel needs at least one chapter.');
      return;
    }
    if (window.confirm(`Delete "${title}"? Its prose cannot be recovered.`)) {
      void deleteChapter(chapterId);
    }
  };
  if (isLoadingChapters) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-academia-border-subtle">
        <span className="text-xs uppercase tracking-wide text-academia-text-muted">
          Chapters{' '}
          <span className="opacity-60">
            {isFiltering ? `(${visible.length} of ${chapters.length})` : `(${chapters.length})`}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-academia-text-muted" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterOpen((open) => !open)}
            className={cn('h-7 w-7 p-0', (isFilterOpen || isFiltering) && 'text-academia-accent')}
            title="Filter chapters by status, POV, or tag"
          >
            <ListFilter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void createChapter()}
            disabled={isMutating}
            className="h-7 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </Button>
        </div>
      </div>
      {(isFilterOpen || isFiltering) && (
        <div className="border-b border-academia-border-subtle">
          <ChapterFilterBar compact shown={visible.length} total={chapters.length} />
        </div>
      )}
      <ul
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
        // Allow dropping past the last row.
        onDragOver={(event) => {
          if (!draggingId) return;
          event.preventDefault();
          setDropIndex(chapters.length);
        }}
        onDrop={(event) => {
          event.preventDefault();
          commitDrop();
        }}
      >
        {isFiltering && visible.length === 0 && (
          <li className="px-2 py-4 text-center text-xs text-academia-text-muted">
            No chapters match this filter.
          </li>
        )}
        {visible.map((chapter) => {
          // Indexes must refer to the FULL list — drops and keyboard moves
          // operate on the real order (and only exist when unfiltered anyway).
          const index = chapters.indexOf(chapter);
          const isActive = chapter.id === activeChapterId;
          const isRenaming = renamingId === chapter.id;
          const isDragging = draggingId === chapter.id;
          return (
            <li key={chapter.id}>
              {dropIndex === index && draggingId && (
                <div className="h-0.5 -mb-0.5 rounded bg-academia-accent" aria-hidden />
              )}
              <div
                draggable={!isRenaming && canReorder}
                onDragStart={(event) => {
                  if (!canReorder) {
                    event.preventDefault();
                    return;
                  }
                  if (!handleArmed.current) {
                    event.preventDefault();
                    return;
                  }
                  setDraggingId(chapter.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', chapter.id); // Firefox needs this
                }}
                onDragEnd={() => {
                  handleArmed.current = false;
                  setDraggingId(null);
                  setDropIndex(null);
                }}
                onDragOver={(event) => {
                  if (!draggingId) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = 'move';
                  const rect = event.currentTarget.getBoundingClientRect();
                  const below = event.clientY > rect.top + rect.height / 2;
                  setDropIndex(index + (below ? 1 : 0));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  commitDrop();
                }}
                className={cn(
                  'group flex items-center gap-1 rounded-lg px-1 py-1.5 transition-colors',
                  !isActive && 'hover:bg-academia-bg-tertiary',
                  isActive && 'bg-academia-bg-tertiary border border-academia-accent/30',
                  isDragging && 'opacity-40'
                )}
              >
                <button
                  type="button"
                  onPointerDown={() => {
                    handleArmed.current = true;
                  }}
                  onPointerUp={() => {
                    handleArmed.current = false;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      moveByKeyboard(index, -1);
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      moveByKeyboard(index, 1);
                    }
                  }}
                  disabled={!canReorder}
                  className={cn(
                    'p-1 rounded text-academia-text-muted/50 focus-visible:opacity-100',
                    canReorder
                      ? 'cursor-grab active:cursor-grabbing hover:text-academia-text-secondary'
                      : 'opacity-30 cursor-default'
                  )}
                  title={
                    canReorder
                      ? 'Drag to reorder — or focus and press ↑ / ↓'
                      : 'Clear the filter to reorder chapters'
                  }
                  aria-label={`Reorder ${chapter.title}. Currently chapter ${index + 1} of ${chapters.length}.`}
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <span className="w-5 shrink-0 text-[10px] tabular-nums text-academia-text-muted/70 text-right">
                  {index + 1}
                </span>
                <span
                  data-testid="chapter-dot"
                  className="shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      cardColorHex(chapter.color) ??
                      `color-mix(in srgb, ${statusInfo(chapter.status).hex} 55%, transparent)`,
                  }}
                  title={`${statusInfo(chapter.status).label}${chapter.pov ? ` · POV: ${chapter.pov}` : ''}${chapter.tags.length ? ` · #${chapter.tags.join(' #')}` : ''}`}
                />
                {isRenaming ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                      autoFocus
                      value={draftTitle}
                      maxLength={200}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onBlur={() => commitRename(chapter.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRename(chapter.id);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setRenamingId(null);
                        }
                      }}
                      className="h-7 px-2 text-sm flex-1"
                    />
                    <button
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => commitRename(chapter.id)}
                      className="p-1 rounded text-academia-success hover:bg-academia-bg-elevated"
                      title="Save"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setRenamingId(null)}
                      className="p-1 rounded text-academia-text-muted hover:text-academia-error"
                      title="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void openChapter(chapter.id)}
                      onDoubleClick={() => startRename(chapter.id, chapter.title)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span
                        className={cn(
                          'block truncate text-sm',
                          isActive ? 'text-academia-accent' : 'text-academia-text-primary'
                        )}
                      >
                        {chapter.title}
                      </span>
                      <span className="block text-[10px] text-academia-text-muted">
                        {chapter.wordCount.toLocaleString()} words
                      </span>
                    </button>
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => startRename(chapter.id, chapter.title)}
                        className="p-1 rounded text-academia-text-muted hover:text-academia-accent"
                        title="Rename chapter"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(chapter.id, chapter.title)}
                        className="p-1 rounded text-academia-text-muted hover:text-academia-error"
                        title="Delete chapter"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {dropIndex === chapters.length && draggingId && (
          <div className="h-0.5 rounded bg-academia-accent" aria-hidden />
        )}
        {chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <FileText className="h-8 w-8 text-academia-text-muted/50 mb-2" />
            <p className="text-sm text-academia-text-muted">No chapters yet</p>
          </div>
        )}
      </ul>
    </div>
  );
}
