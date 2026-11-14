import { useState } from 'react';
import { BookOpen, FileText, Loader2, Plus, Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLibraryStore } from '@/stores/libraryStore';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn, reindex } from '@/lib/utils';

/** Plain-text preview of a chapter's opening line, for the outline cards. */
function excerpt(html: string, limit = 220): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}


/**
 * The Outline workspace: the chapter list as the main surface.
 *
 * Opening a chapter here is the hand-off to the Write view — the selection and
 * the view change are both persisted, so a reload lands you right back.
 */
export function OutlineView() {
  const novels = useLibraryStore((state) => state.novels);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const chapters = useLibraryStore((state) => state.chapters);
  const activeChapterId = useLibraryStore((state) => state.activeChapterId);
  const isLoadingChapters = useLibraryStore((state) => state.isLoadingChapters);
  const isMutating = useLibraryStore((state) => state.isMutating);
  const { openChapter, createChapter, renameChapter, deleteChapter, reorderChapters } =
    useLibraryStore();

  // The open chapter's live buffer beats the (stale) server copy for previews.
  const liveChapterId = useEditorStore((state) => state.chapterId);
  const liveContent = useEditorStore((state) => state.content);

  const setView = useWorkspaceStore((state) => state.setView);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const novel = novels.find((n) => n.id === activeNovelId);
  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  const open = (chapterId: string) => {
    void openChapter(chapterId);
    setView('write');
  };

  const handleCreate = async () => {
    const id = await createChapter();
    if (id) setView('write');
  };

  const commitRename = (chapterId: string) => {
    const trimmed = draftTitle.trim();
    const current = chapters.find((chapter) => chapter.id === chapterId);
    if (trimmed && current && trimmed !== current.title) void renameChapter(chapterId, trimmed);
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

  const commitDrop = () => {
    if (!draggingId || dropIndex === null) return;
    const from = chapters.findIndex((chapter) => chapter.id === draggingId);
    const to = dropIndex > from ? dropIndex - 1 : dropIndex;
    if (from !== -1 && from !== to) {
      void reorderChapters(reindex(chapters, from, to).map((chapter) => chapter.id));
    }
    setDraggingId(null);
    setDropIndex(null);
  };

  if (!activeNovelId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-8 bg-academia-bg-secondary rounded-lg border border-academia-border">
        <BookOpen className="h-12 w-12 text-academia-accent/30 mb-4" />
        <p className="text-academia-text-muted text-sm max-w-sm leading-relaxed">
          Open a novel from the Library to see its outline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-academia-bg-secondary rounded-lg border border-academia-border overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-academia-border">
        <div className="min-w-0">
          <h1 className="font-display text-xl text-academia-text-primary truncate">
            {novel?.title ?? 'Outline'}
          </h1>
          <p className="text-xs text-academia-text-muted mt-0.5">
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} ·{' '}
            {totalWords.toLocaleString()} words
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void handleCreate()} disabled={isMutating} className="gap-1 shrink-0">
          {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>New chapter</span>
        </Button>
      </div>

      {isLoadingChapters ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
        </div>
      ) : chapters.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <FileText className="h-10 w-10 text-academia-text-muted/40 mb-3" />
          <p className="text-sm text-academia-text-muted">This novel has no chapters yet.</p>
        </div>
      ) : (
        <ul
          className="flex-1 overflow-y-auto p-4 space-y-2"
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
          {chapters.map((chapter, index) => {
            const isActive = chapter.id === activeChapterId;
            const isRenaming = renamingId === chapter.id;
            // Summaries carry no prose, so only the open chapter can show one.
            const preview = chapter.id === liveChapterId ? excerpt(liveContent) : '';
            return (
              <li key={chapter.id}>
                {dropIndex === index && draggingId && (
                  <div className="h-0.5 mb-1 rounded bg-academia-accent" aria-hidden />
                )}
                <div
                  draggable={!isRenaming}
                  onDragStart={(event) => {
                    setDraggingId(chapter.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', chapter.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropIndex(null);
                  }}
                  onDragOver={(event) => {
                    if (!draggingId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = 'move';
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDropIndex(index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    commitDrop();
                  }}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                    isActive
                      ? 'border-academia-accent/40 bg-academia-bg-tertiary'
                      : 'border-academia-border-subtle hover:bg-academia-bg-tertiary',
                    draggingId === chapter.id && 'opacity-40'
                  )}
                >
                  <div className="flex items-center gap-2 pt-0.5 shrink-0">
                    <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing text-academia-text-muted/40 group-hover:text-academia-text-secondary" />
                    <span className="w-6 text-right text-xs tabular-nums text-academia-text-muted/70">
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
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
                              event.stopPropagation();
                              setRenamingId(null);
                            }
                          }}
                          className="h-8 px-2 text-sm flex-1"
                        />
                        <button
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => commitRename(chapter.id)}
                          className="p-1 rounded text-academia-success"
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setRenamingId(null)}
                          className="p-1 rounded text-academia-text-muted hover:text-academia-error"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => open(chapter.id)}
                        onDoubleClick={() => {
                          setRenamingId(chapter.id);
                          setDraftTitle(chapter.title);
                        }}
                        className="block w-full text-left"
                        title="Open in the Write view"
                      >
                        <span
                          className={cn(
                            'block truncate font-display text-base',
                            isActive ? 'text-academia-accent' : 'text-academia-text-primary'
                          )}
                        >
                          {chapter.title}
                        </span>
                        <span className="block text-[11px] text-academia-text-muted mt-0.5">
                          {chapter.wordCount.toLocaleString()} words
                        </span>
                        {preview && (
                          <p className="mt-1.5 text-xs leading-relaxed text-academia-text-secondary/80 line-clamp-2">
                            {preview}
                          </p>
                        )}
                      </button>
                    )}
                  </div>

                  {!isRenaming && (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setRenamingId(chapter.id);
                          setDraftTitle(chapter.title);
                        }}
                        className="p-1.5 rounded text-academia-text-muted hover:text-academia-accent"
                        title="Rename chapter"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(chapter.id, chapter.title)}
                        className="p-1.5 rounded text-academia-text-muted hover:text-academia-error"
                        title="Delete chapter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {dropIndex === chapters.length && draggingId && (
            <div className="h-0.5 rounded bg-academia-accent" aria-hidden />
          )}
        </ul>
      )}
    </div>
  );
}
