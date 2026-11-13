// src/components/corkboard/CorkboardView.tsx
//
// The Corkboard workspace: every chapter as an index card — title, position,
// and an editable synopsis — rearrangeable by drag and drop.
//
// Two arrangement modes (the author's explicit choice, shown in the header):
//   Manuscript  cards mirror the real chapter order; dropping a card reorders
//               the actual manuscript (same path as the Outline).
//   Planning    a corkboard-only order, persisted per novel, that never
//               touches the manuscript until "Apply to manuscript".
//
// During a drag the reorder is previewed locally and committed once on drop,
// so live mode never fires a server reorder per dragged-over card.

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, LayoutGrid, Loader2, StickyNote, Tags } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLibraryStore } from '@/stores/libraryStore';
import { useCorkboardStore, arrangeChapters } from '@/stores/corkboardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useChapterFilterStore } from '@/stores/chapterFilterStore';
import { ChapterFilterBar } from '@/components/chapters/ChapterFilterBar';
import { ChapterMetaEditor } from '@/components/chapters/ChapterMetaEditor';
import { cardColorHex, isFilterActive, matchesChapterFilter, statusInfo } from '@/lib/chapterMeta';
import { ChapterSummary } from '@/types';
import { cn } from '@/lib/utils';

const SYNOPSIS_LIMIT = 4000;

function IndexCard({
  chapter,
  position,
  isDragging,
  isActive,
  canDrag,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  onOpen,
}: {
  chapter: ChapterSummary;
  position: number;
  isDragging: boolean;
  isActive: boolean;
  /** False while a filter is active — reordering a partial view is forbidden. */
  canDrag: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const beginEdit = () => {
    setDraft(chapter.synopsis);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== chapter.synopsis) {
      void useLibraryStore.getState().updateSynopsis(chapter.id, trimmed);
    }
  };

  const colorHex = cardColorHex(chapter.color);
  const status = statusInfo(chapter.status);

  return (
    <div
      data-testid="corkboard-card"
      data-chapter-id={chapter.id}
      draggable={!isEditing && canDrag}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        // Some browsers need data set for the drag to start.
        event.dataTransfer.setData('text/plain', chapter.id);
        onDragStart();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation(); // the grid's own onDrop would double-commit
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex flex-col rounded-lg border bg-academia-bg-elevated shadow-md transition-all duration-150',
        'hover:shadow-lg hover:-translate-y-0.5',
        isEditing || !canDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 rotate-1 scale-[0.98]',
        isActive
          ? 'border-academia-accent/60 ring-1 ring-academia-accent/30'
          : 'border-academia-border'
      )}
      style={
        colorHex
          ? { backgroundColor: `color-mix(in srgb, ${colorHex} 8%, var(--color-bg-elevated))` }
          : undefined
      }
    >
      {/* Index-card header: the classic ruled top line (card colour if set). */}
      <div
        className="flex items-baseline gap-2 px-3.5 pt-2.5 pb-2 border-b-2"
        style={{ borderBottomColor: colorHex ?? 'color-mix(in srgb, var(--color-accent) 35%, transparent)' }}
      >
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-academia-text-muted bg-academia-bg-tertiary rounded px-1.5 py-0.5">
          {position}
        </span>
        <button
          type="button"
          onClick={onOpen}
          title="Open this chapter in the editor"
          className="min-w-0 flex-1 text-left font-display text-sm text-academia-text-primary truncate hover:text-academia-accent transition-colors"
        >
          {chapter.title}
        </button>
        <ChapterMetaEditor chapter={chapter}>
          <button
            type="button"
            data-testid="meta-trigger"
            title="Status, POV, tags, and card colour"
            className="shrink-0 p-1 rounded text-academia-text-muted opacity-40 group-hover:opacity-100 hover:text-academia-accent transition-opacity"
          >
            <Tags className="h-3.5 w-3.5" />
          </button>
        </ChapterMetaEditor>
      </div>

      {/* Synopsis: the card's whole point. Click to edit, blur to save. */}
      {isEditing ? (
        <textarea
          autoFocus
          value={draft}
          maxLength={SYNOPSIS_LIMIT}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setIsEditing(false); // discard the draft
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              commit();
            }
          }}
          placeholder="What happens in this chapter?"
          className="flex-1 min-h-[7rem] w-full resize-none bg-transparent px-3.5 py-2.5 text-xs leading-relaxed text-academia-text-primary placeholder:text-academia-text-muted/60 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={beginEdit}
          title="Edit synopsis"
          className="flex-1 min-h-[7rem] w-full text-left px-3.5 py-2.5"
        >
          {chapter.synopsis ? (
            <span className="block text-xs leading-relaxed text-academia-text-secondary whitespace-pre-wrap line-clamp-6">
              {chapter.synopsis}
            </span>
          ) : (
            <span className="block text-xs italic text-academia-text-muted/60 group-hover:text-academia-text-muted transition-colors">
              Add a synopsis…
            </span>
          )}
        </button>
      )}

      <div className="px-3.5 pb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-academia-text-muted">
        <span
          data-testid="status-badge"
          className="rounded-full px-1.5 py-0.5 border border-transparent"
          style={{
            color: status.hex,
            backgroundColor: `color-mix(in srgb, ${status.hex} 14%, transparent)`,
          }}
        >
          {status.label}
        </span>
        {chapter.pov && (
          <span data-testid="pov-badge" className="text-academia-text-secondary">
            POV: {chapter.pov}
          </span>
        )}
        {chapter.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-academia-bg-tertiary border border-academia-border px-1.5 py-0.5 text-academia-text-secondary"
          >
            #{tag}
          </span>
        ))}
        <span className="ml-auto tabular-nums">{chapter.wordCount.toLocaleString()} words</span>
      </div>
    </div>
  );
}

export function CorkboardView() {
  const novels = useLibraryStore((state) => state.novels);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const chapters = useLibraryStore((state) => state.chapters);
  const activeChapterId = useLibraryStore((state) => state.activeChapterId);
  const openChapter = useLibraryStore((state) => state.openChapter);
  const setView = useWorkspaceStore((state) => state.setView);

  const mode = useCorkboardStore((state) => state.mode);
  const order = useCorkboardStore((state) => state.order);
  const isLoading = useCorkboardStore((state) => state.isLoading);
  const isApplying = useCorkboardStore((state) => state.isApplying);
  const error = useCorkboardStore((state) => state.error);

  // Local preview order while a card is in flight; committed once on drop.
  // The ref mirrors the state synchronously: drag events can arrive faster
  // than React re-renders, and the drop must commit what the author last saw,
  // not what the last committed render captured.
  const [dragIds, setDragIdsState] = useState<string[] | null>(null);
  const dragPreviewRef = useRef<string[] | null>(null);
  const setDragIds = (ids: string[] | null) => {
    dragPreviewRef.current = ids;
    setDragIdsState(ids);
  };
  const draggingIdRef = useRef<string | null>(null);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [applied, setApplied] = useState(false);

  // Lazy-load the arrangement for the open novel (the store no-ops repeats).
  useEffect(() => {
    if (activeNovelId) void useCorkboardStore.getState().load(activeNovelId);
  }, [activeNovelId]);

  const filter = useChapterFilterStore();
  const isFiltering = isFilterActive(filter);

  const arranged = useMemo(
    () => arrangeChapters(chapters, mode, order),
    [chapters, mode, order]
  );
  const displayed = useMemo(() => {
    if (!dragIds) return arranged;
    const byId = new Map(arranged.map((chapter) => [chapter.id, chapter]));
    return dragIds
      .map((id) => byId.get(id))
      .filter((chapter): chapter is ChapterSummary => Boolean(chapter));
  }, [arranged, dragIds]);

  // Filtering hides cards — it NEVER rearranges them. Cards keep their real
  // position number so "chapter 7" stays 7 while its neighbours are hidden,
  // and dragging is disabled entirely (committing a partial view would
  // corrupt the order it can't see).
  const visible = useMemo(
    () => (isFiltering ? displayed.filter((c) => matchesChapterFilter(c, filter)) : displayed),
    [displayed, isFiltering, filter]
  );
  const positionOf = useMemo(() => {
    const map = new Map(displayed.map((chapter, index) => [chapter.id, index + 1]));
    return (id: string) => map.get(id) ?? 0;
  }, [displayed]);

  const novel = novels.find((n) => n.id === activeNovelId);

  const manuscriptIds = chapters.map((chapter) => chapter.id).join('\u0000');
  const customMatchesManuscript =
    arranged.map((chapter) => chapter.id).join('\u0000') === manuscriptIds;

  const handleDragEnter = (targetId: string) => {
    const draggingId = draggingIdRef.current;
    if (!draggingId || draggingId === targetId) return;
    const ids = (dragPreviewRef.current ?? arranged.map((chapter) => chapter.id)).slice();
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggingId);
    setDragIds(ids);
  };

  // HTML5 DnD: 'drop' only fires for a real drop on a valid target; a drag
  // cancelled with Esc or released outside the board fires only 'dragend'
  // (with dropEffect 'none'). So: commit in onDrop, and onDragEnd merely
  // discards whatever preview is left. The preview order never reaches the
  // store — and in Manuscript mode, never the server — unless truly dropped.
  const handleDrop = () => {
    if (dragPreviewRef.current) useCorkboardStore.getState().commitOrder(dragPreviewRef.current);
    draggingIdRef.current = null;
    setDragIds(null);
  };
  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDragIds(null); // cancelled — snap back to the committed order
  };

  if (!activeNovelId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-8 bg-academia-bg-secondary rounded-lg border border-academia-border">
        <BookOpen className="h-12 w-12 text-academia-accent/30 mb-4" />
        <p className="text-academia-text-muted text-sm max-w-sm leading-relaxed">
          Open a novel from the Library to lay its chapters out on the corkboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-academia-bg-secondary rounded-lg border border-academia-border overflow-hidden">
      <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-academia-border">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-academia-text-primary flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-academia-accent" />
            Corkboard
          </h2>
          <p className="text-xs text-academia-text-muted truncate">
            {novel?.title} — {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Mode: where do drags land? */}
          <div
            className="flex rounded-md border border-academia-border overflow-hidden"
            title="Manuscript: dragging reorders the actual chapters. Planning: a corkboard-only arrangement that never touches the manuscript."
          >
            {(
              [
                { id: 'manuscript', label: 'Manuscript order' },
                { id: 'custom', label: 'Planning order' },
              ] as const
            ).map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  useCorkboardStore.getState().setMode(candidate.id);
                  setApplied(false);
                  setConfirmingApply(false);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs transition-colors',
                  mode === candidate.id
                    ? 'bg-academia-bg-tertiary text-academia-accent'
                    : 'text-academia-text-muted hover:text-academia-text-primary'
                )}
              >
                {candidate.label}
              </button>
            ))}
          </div>

          {mode === 'custom' &&
            (applied || customMatchesManuscript ? (
              <span className="flex items-center gap-1 text-xs text-academia-text-muted">
                <Check className="h-3.5 w-3.5 text-academia-accent" />
                Matches manuscript
              </span>
            ) : confirmingApply ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] text-academia-text-muted">
                  Reorder the real chapters to match?
                </span>
                <Button
                  size="sm"
                  disabled={isApplying}
                  onClick={() => {
                    void useCorkboardStore
                      .getState()
                      .applyToManuscript()
                      .then((ok) => {
                        // Only a persisted reorder may claim to match.
                        setApplied(ok);
                        setConfirmingApply(false);
                      });
                  }}
                >
                  {isApplying && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingApply(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmingApply(true)}
                title="Make the manuscript's chapter order match this arrangement"
              >
                Apply to manuscript
              </Button>
            ))}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3 px-6 py-2 border-b border-academia-border">
        <ChapterFilterBar shown={visible.length} total={chapters.length} />
        {isFiltering && (
          <span className="ml-auto text-[11px] italic text-academia-text-muted shrink-0">
            Filter on — drag to rearrange is paused
          </span>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-6 py-2 text-xs text-academia-error border-b border-academia-border">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && chapters.length === 0 ? (
          <p className="text-xs text-academia-text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <StickyNote className="h-8 w-8 text-academia-accent/30" />
            <p className="text-sm text-academia-text-muted">
              {isFiltering ? 'No chapters match this filter.' : 'No chapters yet.'}
            </p>
          </div>
        ) : (
          <div
            className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]"
            // Dropping on the gaps between cards still counts as "inside".
            onDragOver={(event) => {
              if (draggingIdRef.current) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop();
            }}
          >
            {visible.map((chapter) => (
              <IndexCard
                key={chapter.id}
                chapter={chapter}
                position={positionOf(chapter.id)}
                isDragging={dragIds !== null && draggingIdRef.current === chapter.id}
                isActive={chapter.id === activeChapterId}
                canDrag={!isFiltering}
                onDragStart={() => {
                  if (isFiltering) return;
                  draggingIdRef.current = chapter.id;
                  setDragIds(arranged.map((c) => c.id));
                  setApplied(false);
                }}
                onDragEnter={() => handleDragEnter(chapter.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onOpen={() => {
                  void openChapter(chapter.id);
                  setView('write');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
