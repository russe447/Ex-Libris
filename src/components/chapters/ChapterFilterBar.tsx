// src/components/chapters/ChapterFilterBar.tsx
//
// The faceted chapter filter, shared (same store, same look scaled down)
// between the Corkboard and the sidebar chapter list. Selecting facets only
// hides cards/rows — the surfaces it filters disable their drag-reordering
// while a filter is active, because reordering a partial view would be a lie.

import { FilterX } from 'lucide-react';
import {
  CHAPTER_STATUSES,
  distinctPovs,
  distinctTags,
  isFilterActive,
} from '@/lib/chapterMeta';
import { useChapterFilterStore } from '@/stores/chapterFilterStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { cn } from '@/lib/utils';

export function ChapterFilterBar({
  compact = false,
  shown,
  total,
}: {
  compact?: boolean;
  /** How many chapters the filter currently lets through, of how many. */
  shown: number;
  total: number;
}) {
  const chapters = useLibraryStore((state) => state.chapters);
  const statuses = useChapterFilterStore((state) => state.statuses);
  const pov = useChapterFilterStore((state) => state.pov);
  const tags = useChapterFilterStore((state) => state.tags);
  const toggleStatus = useChapterFilterStore((state) => state.toggleStatus);
  const setPov = useChapterFilterStore((state) => state.setPov);
  const toggleTag = useChapterFilterStore((state) => state.toggleTag);
  const clearFilters = useChapterFilterStore((state) => state.clearFilters);

  const povs = distinctPovs(chapters);
  const allTags = distinctTags(chapters);
  const active = isFilterActive({ statuses, pov, tags });

  const chip = (isOn: boolean) =>
    cn(
      'rounded-full border px-2 py-0.5 transition-colors',
      compact ? 'text-[10px]' : 'text-[11px]',
      isOn
        ? 'border-academia-accent/60 bg-academia-bg-tertiary text-academia-accent'
        : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
    );

  return (
    <div
      data-testid="chapter-filter-bar"
      className={cn('flex flex-wrap items-center', compact ? 'gap-1 px-2 py-1.5' : 'gap-1.5')}
    >
      {CHAPTER_STATUSES.map((status) => (
        <button
          key={status.id}
          type="button"
          onClick={() => toggleStatus(status.id)}
          className={chip(statuses.includes(status.id))
          }
          title={`Only chapters with status “${status.label}”`}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
            style={{ backgroundColor: status.hex }}
          />
          {status.label}
        </button>
      ))}

      {povs.length > 0 && (
        <select
          value={pov ?? ''}
          onChange={(event) => setPov(event.target.value || null)}
          className={cn(
            'bg-academia-bg-tertiary border border-academia-border rounded-full px-2 py-0.5 text-academia-text-primary focus:outline-none focus:ring-1 focus:ring-academia-accent',
            compact ? 'text-[10px] max-w-[9rem]' : 'text-[11px]',
            pov && 'border-academia-accent/60 text-academia-accent'
          )}
          title="Only chapters from one character's point of view"
        >
          <option value="">All POVs</option>
          {povs.map((candidate) => (
            <option key={candidate} value={candidate}>
              POV: {candidate}
            </option>
          ))}
        </select>
      )}

      {allTags.map((tag) => (
        <button
          key={tag.toLowerCase()}
          type="button"
          onClick={() => toggleTag(tag)}
          className={chip(tags.some((t) => t.toLowerCase() === tag.toLowerCase()))}
          title={`Only chapters tagged “${tag}”`}
        >
          #{tag}
        </button>
      ))}

      {active && (
        <>
          <span
            className={cn(
              'text-academia-text-muted tabular-nums',
              compact ? 'text-[10px]' : 'text-[11px]'
            )}
          >
            {shown} of {total}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              'flex items-center gap-1 text-academia-accent hover:opacity-80',
              compact ? 'text-[10px]' : 'text-[11px]'
            )}
            title="Show every chapter again"
          >
            <FilterX className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            Clear
          </button>
        </>
      )}
    </div>
  );
}
