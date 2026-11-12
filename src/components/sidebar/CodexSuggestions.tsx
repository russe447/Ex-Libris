import { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCodexStore } from '@/stores/codexStore';
import { CODEX_TYPES, CODEX_TYPE_ORDER } from '@/lib/codex';
import { CodexEntryType } from '@/types';
import { cn } from '@/lib/utils';
interface CodexSuggestionsProps {
  /** Called with the new entry id so the panel can expand it for editing. */
  onEntryCreated: (entryId: string) => void;
}
export function CodexSuggestions({ onEntryCreated }: CodexSuggestionsProps) {
  const suggestions = useCodexStore((s) => s.suggestions);
  const dismissedCount = useCodexStore((s) => s.dismissedKeys.length);
  const suggestionsEnabled = useCodexStore((s) => s.suggestionsEnabled);
  const pendingKey = useCodexStore((s) => s.pendingSuggestionKey);
  const createEntryFromSuggestion = useCodexStore((s) => s.createEntryFromSuggestion);
  const dismissSuggestion = useCodexStore((s) => s.dismissSuggestion);
  const restoreDismissed = useCodexStore((s) => s.restoreDismissed);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, CodexEntryType>>({});
  if (!suggestionsEnabled) return null;
  if (suggestions.length === 0 && dismissedCount === 0) return null;
  const handleAdd = async (key: string, type: CodexEntryType) => {
    const entry = await createEntryFromSuggestion(key, type);
    if (entry) {
      setExpandedKey(null);
      onEntryCreated(entry.id);
    }
  };
  return (
    <div className="mb-2 border-b border-academia-border-subtle pb-2">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-xs uppercase tracking-wide text-academia-text-muted hover:text-academia-text-secondary transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <Sparkles className="h-3 w-3 text-academia-accent" />
        <span>Suggested</span>
        {suggestions.length > 0 && <span className="opacity-60">({suggestions.length})</span>}
      </button>
      {!collapsed && (
        <div className="mt-1 space-y-1">
          {suggestions.length === 0 && (
            <p className="px-2 py-1 text-xs text-academia-text-muted">
              No new names found in this draft.
            </p>
          )}
          {suggestions.map((suggestion) => {
            const isExpanded = expandedKey === suggestion.key;
            const isPending = pendingKey === suggestion.key;
            const type = typeOverrides[suggestion.key] ?? suggestion.type;
            return (
              <div
                key={suggestion.key}
                className={cn(
                  'rounded-lg border border-transparent',
                  isExpanded && 'bg-academia-bg-tertiary border-academia-accent/30'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-1 p-2 rounded-lg cursor-pointer group',
                    !isExpanded && 'hover:bg-academia-bg-tertiary'
                  )}
                  onClick={() => setExpandedKey(isExpanded ? null : suggestion.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedKey(isExpanded ? null : suggestion.key);
                    }
                  }}
                >
                  <Sparkles className="h-3 w-3 text-academia-accent/60 shrink-0" />
                  <span className="text-sm text-academia-text-primary truncate flex-1">
                    {suggestion.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-academia-text-muted shrink-0">
                    {CODEX_TYPES[type].label}
                  </span>
                  <span className="text-[10px] text-academia-text-muted shrink-0 tabular-nums">
                    ×{suggestion.count}
                  </span>
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-academia-text-muted shrink-0" />
                  ) : (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleAdd(suggestion.key, type);
                        }}
                        className="p-1 rounded text-academia-text-muted hover:text-academia-success transition-colors"
                        title={`Add "${suggestion.name}" to the codex as a ${CODEX_TYPES[type].label}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismissSuggestion(suggestion.key);
                        }}
                        className="p-1 rounded text-academia-text-muted hover:text-academia-error transition-colors"
                        title={`Never suggest "${suggestion.name}" again`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-academia-border-subtle pt-2">
                    {suggestion.context && (
                      <p className="text-xs italic text-academia-text-muted line-clamp-3">
                        “{suggestion.context}”
                      </p>
                    )}
                    <div>
                      <label className="text-xs text-academia-text-muted block mb-1">Type</label>
                      <select
                        value={type}
                        onChange={(e) =>
                          setTypeOverrides((prev) => ({
                            ...prev,
                            [suggestion.key]: e.target.value as CodexEntryType,
                          }))
                        }
                        className="w-full h-8 rounded-md border border-academia-border bg-academia-bg-tertiary px-2 text-sm text-academia-text-primary focus:outline-none focus:ring-2 focus:ring-academia-accent"
                      >
                        {CODEX_TYPE_ORDER.map((option) => (
                          <option key={option} value={option}>
                            {CODEX_TYPES[option].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={isPending}
                        onClick={() => void handleAdd(suggestion.key, type)}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Add to Codex'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => void dismissSuggestion(suggestion.key)}
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {dismissedCount > 0 && (
            <button
              type="button"
              onClick={() => void restoreDismissed()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-academia-text-muted hover:text-academia-accent transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Restore {dismissedCount} ignored {dismissedCount === 1 ? 'name' : 'names'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
