import { useEffect, useMemo, useRef } from 'react';
import { Search, X, Loader2, CaseSensitive, WholeWord } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { useSearchStore } from '@/stores/searchStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { MIN_QUERY_LENGTH, SearchHit } from '@/lib/search';
import { cn } from '@/lib/utils';

function HitRow({ hit, onOpen }: { hit: SearchHit; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-lg px-3 py-2 hover:bg-academia-bg-tertiary transition-colors group"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] tabular-nums text-academia-text-muted/70 shrink-0">
          {hit.chapterPosition + 1}
        </span>
        <span className="text-xs text-academia-accent truncate group-hover:underline">
          {hit.chapterTitle}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-academia-text-secondary">
        {hit.truncatedStart && '…'}
        {hit.before}
        {/* A <span>, not <mark>: the UA default for <mark> is black-on-yellow,
            which fights every theme. */}
        <span className="rounded px-0.5 bg-academia-accent/30 text-academia-text-primary font-medium">
          {hit.match}
        </span>
        {hit.after}
        {hit.truncatedEnd && '…'}
      </p>
    </button>
  );
}

/** Novel-wide search. Scoped to the active novel, like chat and the codex. */
export function SearchPanel() {
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);
  const options = useSearchStore((state) => state.options);
  const setOptions = useSearchStore((state) => state.setOptions);
  const results = useSearchStore((state) => state.results);
  const resultsQuery = useSearchStore((state) => state.resultsQuery);
  const isSearching = useSearchStore((state) => state.isSearching);
  const error = useSearchStore((state) => state.error);
  const clear = useSearchStore((state) => state.clear);
  const requestJump = useSearchStore((state) => state.requestJump);

  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const openChapter = useLibraryStore((state) => state.openChapter);
  const setView = useWorkspaceStore((state) => state.setView);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const chapterCount = useMemo(
    () => new Set(results.map((hit) => hit.chapterId)).size,
    [results]
  );

  const open = (hit: SearchHit) => {
    // Order matters: queue the jump first, so a chapter that's already open
    // (and therefore mounts no new editor) still gets the highlight.
    requestJump(hit);
    void openChapter(hit.chapterId);
    setView('write');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-academia-border space-y-3">
        <h2 className="font-display text-lg text-academia-text-primary">Search</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-academia-text-muted pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            placeholder="Search this novel…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clear();
              }
              if (event.key === 'Enter' && results.length > 0) {
                event.preventDefault();
                open(results[0]);
              }
            }}
            className="h-9 pl-8 pr-8 text-sm"
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-academia-text-muted hover:text-academia-text-primary"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setOptions({ caseSensitive: !options.caseSensitive })}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors',
              options.caseSensitive
                ? 'border-academia-accent/40 text-academia-accent bg-academia-bg-tertiary'
                : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
            )}
            title="Match case"
          >
            <CaseSensitive className="h-3.5 w-3.5" />
            Match case
          </button>
          <button
            onClick={() => setOptions({ wholeWord: !options.wholeWord })}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors',
              options.wholeWord
                ? 'border-academia-accent/40 text-academia-accent bg-academia-bg-tertiary'
                : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
            )}
            title="Whole words only"
          >
            <WholeWord className="h-3.5 w-3.5" />
            Whole word
          </button>
        </div>

        {resultsQuery && !isSearching && (
          <p className="text-[11px] text-academia-text-muted">
            {results.length === 0
              ? `No matches for “${resultsQuery}”`
              : `${results.length} match${results.length === 1 ? '' : 'es'} in ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!activeNovelId ? (
          <p className="px-3 py-6 text-center text-sm text-academia-text-muted">
            Open a novel to search it.
          </p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-sm text-academia-error">{error}</p>
        ) : isSearching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-academia-text-muted" />
          </div>
        ) : query.trim().length < MIN_QUERY_LENGTH ? (
          <p className="px-3 py-6 text-center text-sm text-academia-text-muted">
            Type at least {MIN_QUERY_LENGTH} characters to search every chapter of this novel.
          </p>
        ) : (
          results.map((hit) => (
            <HitRow
              key={`${hit.chapterId}:${hit.occurrence}`}
              hit={hit}
              onOpen={() => open(hit)}
            />
          ))
        )}
      </div>
    </div>
  );
}
