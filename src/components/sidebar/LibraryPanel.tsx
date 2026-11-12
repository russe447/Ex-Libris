import { useState } from 'react';
import { Plus, Trash2, Loader2, ChevronLeft, BookOpen, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLibraryStore } from '@/stores/libraryStore';
import { ChapterList } from './ChapterList';
import { cn } from '@/lib/utils';
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
function NovelList() {
  const novels = useLibraryStore((state) => state.novels);
  const isLoadingNovels = useLibraryStore((state) => state.isLoadingNovels);
  const isMutating = useLibraryStore((state) => state.isMutating);
  const { openNovel, createNovel, deleteNovel } = useLibraryStore();
  const handleDelete = (event: React.MouseEvent, id: string, title: string) => {
    event.stopPropagation();
    if (window.confirm(`Delete "${title}"? Every chapter, its chat history, and its codex go with it.`)) {
      void deleteNovel(id);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-academia-border">
        <h2 className="font-display text-lg text-academia-text-primary">Library</h2>
        <Button variant="ghost" size="sm" onClick={() => void createNovel()} disabled={isMutating} className="h-8 gap-1">
          {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>New novel</span>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoadingNovels ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
          </div>
        ) : novels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
            <BookOpen className="h-8 w-8 text-academia-text-muted/50 mb-2" />
            <p className="text-sm text-academia-text-muted">No novels yet</p>
            <p className="text-xs text-academia-text-muted mt-1">
              Every novel gets its own chapters, chat, and codex.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {novels.map((novel) => (
              <div
                key={novel.id}
                role="button"
                tabIndex={0}
                onClick={() => void openNovel(novel.id)}
                onKeyDown={(event) => event.key === 'Enter' && void openNovel(novel.id)}
                className="group w-full text-left p-3 rounded-lg cursor-pointer transition-colors hover:bg-academia-bg-tertiary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate text-academia-text-primary">{novel.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-academia-text-muted">
                      <span>{novel.chapterCount} {novel.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                      <span>•</span>
                      <span>{novel.wordCount.toLocaleString()} words</span>
                      <span>•</span>
                      <span>{formatRelativeTime(novel.lastModified)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => handleDelete(event, novel.id, novel.title)}
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-academia-text-muted hover:text-academia-error"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export function LibraryPanel() {
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const novels = useLibraryStore((state) => state.novels);
  const error = useLibraryStore((state) => state.error);
  const { closeNovel, renameNovel } = useLibraryStore();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const activeNovel = novels.find((novel) => novel.id === activeNovelId);
  if (!activeNovelId || !activeNovel) return <NovelList />;
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== activeNovel.title) void renameNovel(activeNovel.id, trimmed);
    setRenaming(false);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-academia-border">
        <button
          onClick={closeNovel}
          className="flex items-center gap-1 text-xs text-academia-text-muted hover:text-academia-accent transition-colors mb-2"
        >
          <ChevronLeft className="h-3 w-3" />
          All novels
        </button>
        {renaming ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') setRenaming(false);
              }}
              className="h-8 text-sm"
            />
            <button onMouseDown={(e) => e.preventDefault()} onClick={commit} className="p-1 text-academia-success">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setRenaming(false)} className="p-1 text-academia-text-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(activeNovel.title);
              setRenaming(true);
            }}
            className="group flex items-center gap-2 w-full text-left"
            title="Click to rename"
          >
            <h2 className="font-display text-lg text-academia-text-primary truncate">{activeNovel.title}</h2>
            <Edit2 className="h-3 w-3 shrink-0 text-academia-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <p className="text-xs text-academia-text-muted">{activeNovel.wordCount.toLocaleString()} words</p>
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-academia-error border-b border-academia-border">{error}</div>
      )}
      <div className={cn('flex-1 overflow-hidden')}>
        <ChapterList />
      </div>
    </div>
  );
}
