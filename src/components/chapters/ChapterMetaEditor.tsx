// src/components/chapters/ChapterMetaEditor.tsx
//
// Popover for a chapter's metadata: status, POV character, tags, card colour.
// Every control saves immediately through the optimistic
// libraryStore.updateChapterMeta — no Save button to forget. POV suggests
// names already used in the manuscript plus the Codex's people.

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, X } from 'lucide-react';
import {
  CARD_COLORS,
  CHAPTER_STATUSES,
  distinctPovs,
} from '@/lib/chapterMeta';
import { useLibraryStore } from '@/stores/libraryStore';
import { useCodexStore } from '@/stores/codexStore';
import { ChapterSummary } from '@/types';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const MAX_TAG_LENGTH = 40;

export function ChapterMetaEditor({
  chapter,
  children,
}: {
  chapter: ChapterSummary;
  children: React.ReactNode;
}) {
  const chapters = useLibraryStore((state) => state.chapters);
  const codexEntries = useCodexStore((state) => state.entries);
  const [tagDraft, setTagDraft] = useState('');
  const [povDraft, setPovDraft] = useState<string | null>(null); // null = not editing

  const patch = (p: Partial<Pick<ChapterSummary, 'status' | 'pov' | 'tags' | 'color'>>) =>
    void useLibraryStore.getState().updateChapterMeta(chapter.id, p);

  const povSuggestions = Array.from(
    new Set([
      ...distinctPovs(chapters),
      ...codexEntries.filter((entry) => entry.type === 'person').map((entry) => entry.name),
    ])
  ).filter(Boolean);

  const addTag = () => {
    const tag = tagDraft.trim();
    setTagDraft('');
    if (!tag || tag.length > MAX_TAG_LENGTH) return;
    if (chapter.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    patch({ tags: [...chapter.tags, tag] });
  };

  const removeTag = (tag: string) => {
    patch({ tags: chapter.tags.filter((t) => t !== tag) });
  };

  const commitPov = () => {
    if (povDraft === null) return;
    const pov = povDraft.trim();
    setPovDraft(null);
    if (pov !== chapter.pov) patch({ pov });
  };

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) {
          commitPov();
          if (tagDraft.trim()) addTag();
        }
      }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          data-testid="chapter-meta-editor"
          className="z-50 w-64 rounded-lg border border-academia-border bg-academia-bg-secondary shadow-xl p-3 space-y-3 focus:outline-none"
          // Keep card drag handlers out of the popover's way.
          onPointerDown={(event) => event.stopPropagation()}
        >
          {/* Status */}
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-academia-text-muted mb-1">
              Status
            </span>
            <div className="flex gap-1">
              {CHAPTER_STATUSES.map((status) => {
                const isOn = chapter.status === status.id;
                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => patch({ status: status.id })}
                    className={cn(
                      'flex-1 rounded-md border px-1 py-1 text-[10px] transition-colors',
                      isOn
                        ? 'border-academia-accent/60 bg-academia-bg-tertiary text-academia-text-primary'
                        : 'border-academia-border text-academia-text-muted hover:text-academia-text-primary'
                    )}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                      style={{ backgroundColor: status.hex }}
                    />
                    {status.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* POV */}
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-academia-text-muted mb-1">
              POV character
            </span>
            <Input
              list={`pov-suggestions-${chapter.id}`}
              value={povDraft ?? chapter.pov}
              onChange={(event) => setPovDraft(event.target.value)}
              onBlur={commitPov}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitPov();
              }}
              placeholder="Whose chapter is this?"
              maxLength={100}
              className="h-7 text-xs"
            />
            <datalist id={`pov-suggestions-${chapter.id}`}>
              {povSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* Tags */}
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-academia-text-muted mb-1">
              Tags
            </span>
            {chapter.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {chapter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-0.5 rounded-full bg-academia-bg-tertiary border border-academia-border px-1.5 py-0.5 text-[10px] text-academia-text-secondary"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-academia-text-muted hover:text-academia-error"
                      title={`Remove “${tag}”`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={() => {
                if (tagDraft.trim()) addTag();
              }}
              placeholder="Add a tag and press Enter"
              maxLength={MAX_TAG_LENGTH}
              className="h-7 text-xs"
            />
          </div>

          {/* Card colour */}
          <div>
            <span className="block text-[10px] uppercase tracking-wide text-academia-text-muted mb-1">
              Card colour
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => patch({ color: '' })}
                title="No colour"
                className={cn(
                  'w-5 h-5 rounded-full border flex items-center justify-center',
                  chapter.color === ''
                    ? 'border-academia-accent'
                    : 'border-academia-border hover:border-academia-text-muted'
                )}
              >
                <X className="h-3 w-3 text-academia-text-muted" />
              </button>
              {CARD_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => patch({ color: color.id })}
                  title={color.label}
                  className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center transition-transform hover:scale-110',
                    chapter.color === color.id ? 'border-academia-text-primary' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color.hex }}
                >
                  {chapter.color === color.id && <Check className="h-3 w-3 text-black/60" />}
                </button>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
