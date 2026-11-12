// src/components/editor/SnapshotsDialog.tsx
//
// Scrivener-style snapshots for the open chapter: take a named snapshot before
// a big edit, browse old versions, compare one against the current text, and
// restore — which always backs the current text up first (the server does
// this in the same transaction as the overwrite).
//
// Layout: snapshot list on the left, preview/compare pane on the right.
// Everything renders extracted *text*, never raw HTML — the diff is textual
// anyway, and it keeps the dialog inert by construction.

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Camera, Check, History, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSnapshotStore } from '@/stores/snapshotStore';
import { useEditorStore } from '@/stores/editorStore';
import { ChapterSnapshot } from '@/types';
import * as snapshotsService from '@/services/snapshots';
import { diffHtml, htmlToParagraphs, DiffParagraph } from '@/lib/diff';
import { onUiCommand } from '@/lib/uiBus';
import { cn } from '@/lib/utils';

function snapshotLabel(snapshot: ChapterSnapshot): string {
  if (snapshot.name) return snapshot.name;
  return snapshot.kind === 'auto' ? 'Backup (before restore)' : 'Untitled snapshot';
}

function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SnapshotsDialog({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'preview' | 'compare'>('compare');
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirming, setConfirming] = useState<'restore' | 'delete' | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const snapshots = useSnapshotStore((state) => state.snapshots);
  const isLoading = useSnapshotStore((state) => state.isLoading);
  const isWorking = useSnapshotStore((state) => state.isWorking);
  const error = useSnapshotStore((state) => state.error);
  const storeChapterId = useSnapshotStore((state) => state.chapterId);
  const storeNovelId = useSnapshotStore((state) => state.novelId);

  const chapterId = useEditorStore((state) => state.chapterId);
  // Subscribed so an open Compare pane tracks live typing.
  const currentContent = useEditorStore((state) => state.content);

  // Desktop menu Novel ▸ Snapshots… opens this same dialog.
  useEffect(() => onUiCommand('open-snapshots', () => setIsOpen(true)), []);

  // (Re)load the list every time the dialog opens — cheap, metadata only.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setSelectedContent(null);
    setConfirming(null);
    setRestoredId(null);
    setRenamingId(null);
    setNewName('');
    useSnapshotStore.getState().clearError();
    void useSnapshotStore.getState().openForCurrentChapter();
  }, [isOpen]);

  // Fetch the selected snapshot's prose for preview/compare.
  useEffect(() => {
    if (!isOpen || !selectedId || !storeNovelId || !storeChapterId) return;
    let cancelled = false;
    setIsLoadingContent(true);
    setSelectedContent(null);
    snapshotsService
      .fetchSnapshotContent(storeNovelId, storeChapterId, selectedId)
      .then((snapshot) => {
        if (!cancelled) setSelectedContent(snapshot.content);
      })
      .catch((fetchError) => {
        console.error('Failed to load snapshot content:', fetchError);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedId, storeNovelId, storeChapterId]);

  const selected = snapshots.find((snapshot) => snapshot.id === selectedId) ?? null;

  // The diff is recomputed when the snapshot or the live buffer changes.
  const diff: DiffParagraph[] | null = useMemo(() => {
    if (mode !== 'compare' || selectedContent == null) return null;
    return diffHtml(selectedContent, currentContent);
  }, [mode, selectedContent, currentContent]);

  const previewParagraphs = useMemo(
    () => (mode === 'preview' && selectedContent != null ? htmlToParagraphs(selectedContent) : null),
    [mode, selectedContent]
  );

  const changedCount = diff ? diff.filter((paragraph) => paragraph.type !== 'same').length : 0;

  const handleTake = async () => {
    const snapshot = await useSnapshotStore.getState().create(newName.trim());
    if (snapshot) {
      setNewName('');
      setSelectedId(snapshot.id);
    }
  };

  const handleRestore = async () => {
    if (!selected) return;
    const ok = await useSnapshotStore.getState().restore(selected.id);
    setConfirming(null);
    if (ok) setRestoredId(selected.id);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await useSnapshotStore.getState().remove(selected.id);
    setConfirming(null);
    setSelectedId(null);
    setSelectedContent(null);
  };

  const commitRename = async () => {
    if (renamingId) {
      await useSnapshotStore.getState().rename(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[min(56rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-4rem))] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-xl border border-academia-border bg-academia-bg-secondary shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between p-5 border-b border-academia-border shrink-0">
            <div>
              <Dialog.Title className="font-display text-lg text-academia-text-primary">
                Snapshots
              </Dialog.Title>
              <Dialog.Description className="text-xs text-academia-text-muted mt-1">
                Saved versions of this chapter. Take one before a big edit; restoring always
                backs up the current text first.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded text-academia-text-muted hover:text-academia-text-primary"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {!chapterId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-academia-text-muted">
              Open a chapter to use snapshots.
            </div>
          ) : (
            <div className="flex-1 flex min-h-0">
              {/* ---- Left: take + list ---- */}
              <div className="w-72 shrink-0 border-r border-academia-border flex flex-col min-h-0">
                <div className="p-3 border-b border-academia-border space-y-2">
                  <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleTake();
                    }}
                    placeholder="Name (optional) — e.g. “Before rewrite”"
                    maxLength={200}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isWorking}
                    onClick={() => void handleTake()}
                  >
                    {isWorking ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Take snapshot
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {isLoading && (
                    <p className="text-xs text-academia-text-muted px-2 py-3">Loading…</p>
                  )}
                  {!isLoading && snapshots.length === 0 && (
                    <p className="text-xs text-academia-text-muted px-2 py-3 leading-relaxed">
                      No snapshots yet. Take one now and this version of the chapter is kept
                      until you delete it.
                    </p>
                  )}
                  {snapshots.map((snapshot) => (
                    <button
                      key={snapshot.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(snapshot.id);
                        setConfirming(null);
                        setRestoredId(null);
                      }}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                        snapshot.id === selectedId
                          ? 'border-academia-accent/50 bg-academia-bg-tertiary'
                          : 'border-transparent hover:bg-academia-bg-tertiary/60'
                      )}
                    >
                      {renamingId === snapshot.id ? (
                        <Input
                          autoFocus
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => void commitRename()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commitRename();
                            if (event.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(event) => event.stopPropagation()}
                          maxLength={200}
                          className="h-6 text-xs mb-1"
                        />
                      ) : (
                        <span
                          className={cn(
                            'block text-xs truncate',
                            snapshot.kind === 'auto'
                              ? 'text-academia-text-secondary italic'
                              : 'text-academia-text-primary'
                          )}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            setRenamingId(snapshot.id);
                            setRenameDraft(snapshot.name);
                          }}
                          title="Double-click to rename"
                        >
                          {snapshotLabel(snapshot)}
                        </span>
                      )}
                      <span className="block text-[11px] text-academia-text-muted mt-0.5">
                        {formatWhen(snapshot.createdAt)} · {snapshot.wordCount.toLocaleString()}{' '}
                        words
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ---- Right: preview / compare / actions ---- */}
              <div className="flex-1 flex flex-col min-h-0">
                {!selected ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
                    <History className="h-8 w-8 text-academia-accent/30" />
                    <p className="text-sm text-academia-text-muted max-w-xs leading-relaxed">
                      Select a snapshot to read it or compare it with the current text.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-academia-border shrink-0">
                      <div className="flex rounded-md border border-academia-border overflow-hidden">
                        {(['compare', 'preview'] as const).map((candidate) => (
                          <button
                            key={candidate}
                            type="button"
                            onClick={() => setMode(candidate)}
                            className={cn(
                              'px-3 py-1 text-xs transition-colors',
                              mode === candidate
                                ? 'bg-academia-bg-tertiary text-academia-accent'
                                : 'text-academia-text-muted hover:text-academia-text-primary'
                            )}
                          >
                            {candidate === 'compare' ? 'Compare with current' : 'Read snapshot'}
                          </button>
                        ))}
                      </div>
                      {mode === 'compare' && diff && (
                        <span className="text-[11px] text-academia-text-muted">
                          {changedCount === 0
                            ? 'Identical to the current text.'
                            : `${changedCount} changed paragraph${changedCount === 1 ? '' : 's'}`}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1.5">
                        {restoredId === selected.id ? (
                          <span className="flex items-center gap-1 text-xs text-academia-accent">
                            <Check className="h-3.5 w-3.5" /> Restored — previous text backed up
                          </span>
                        ) : confirming === 'restore' ? (
                          <>
                            <span className="text-[11px] text-academia-text-muted">
                              Replace current text? A backup is taken first.
                            </span>
                            <Button
                              size="sm"
                              disabled={isWorking}
                              onClick={() => void handleRestore()}
                            >
                              {isWorking && (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              )}
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirming(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : confirming === 'delete' ? (
                          <>
                            <span className="text-[11px] text-academia-text-muted">
                              Delete this snapshot permanently?
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              disabled={isWorking}
                              onClick={() => void handleDelete()}
                            >
                              Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isWorking}
                              onClick={() => setConfirming('restore')}
                              title="Replace the current text with this snapshot (a backup of the current text is taken first)"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Restore…
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-academia-text-muted"
                              disabled={isWorking}
                              onClick={() => setConfirming('delete')}
                              title="Delete this snapshot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      {isLoadingContent && (
                        <p className="text-xs text-academia-text-muted">Loading snapshot…</p>
                      )}
                      {!isLoadingContent && mode === 'preview' && previewParagraphs && (
                        <div className="space-y-3 max-w-prose">
                          {previewParagraphs.length === 0 && (
                            <p className="text-xs text-academia-text-muted">
                              This snapshot is empty.
                            </p>
                          )}
                          {previewParagraphs.map((paragraph, index) => (
                            <p
                              key={index}
                              className="text-sm leading-relaxed text-academia-text-primary"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                      {!isLoadingContent && mode === 'compare' && diff && (
                        <div className="space-y-3 max-w-prose">
                          {diff.map((paragraph, index) => (
                            <p
                              key={index}
                              className={cn(
                                'text-sm leading-relaxed',
                                paragraph.type === 'same'
                                  ? 'text-academia-text-muted'
                                  : 'text-academia-text-primary'
                              )}
                            >
                              {paragraph.segments.map((segment, segmentIndex) => (
                                <span
                                  key={segmentIndex}
                                  className={cn(
                                    segment.type === 'added' &&
                                      'bg-emerald-500/15 text-emerald-300 rounded-sm px-0.5',
                                    segment.type === 'removed' &&
                                      'bg-red-500/15 text-red-300 line-through decoration-red-400/60 rounded-sm px-0.5'
                                  )}
                                >
                                  {segment.text}
                                </span>
                              ))}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {error && (
                  <div className="px-4 py-2 border-t border-academia-border text-xs text-red-400 shrink-0">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
