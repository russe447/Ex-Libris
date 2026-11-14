// src/components/editor/SplitPane.tsx
//
// The split editor's second pane — now fully editable. Two modes:
//
// DIFFERENT chapter  A second TipTap editor over its own buffer
//                    (splitEditorStore): own debounced autosave, own undo
//                    history. The two buffers hold different chapters by
//                    construction, so their saves can never race over one row.
//
// SAME chapter       Scrivener-style: both panes are the same document. The
//  ("mirror")        pane runs a second TipTap instance whose ProseMirror doc
//                    is kept identical to the primary's by forwarding
//                    transaction *steps* both ways (the canonical ProseMirror
//                    recipe for two views of one document). Each view keeps
//                    its own selection and scroll position, so you can edit
//                    two parts of a long chapter at once.
//
//                    Single undo stack, no autosave changes: the mirror has no
//                    history plugin — its Mod-Z/Y route to the primary — and
//                    every mirror edit lands in the primary via a dispatched
//                    transaction, so the primary's existing onUpdate →
//                    editorStore.setContent → autosave path sees ALL edits,
//                    and prosemirror-history records them in one stack.

import { useEffect, useState } from 'react';
import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react';
import { Step } from '@tiptap/pm/transform';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Columns2, Link2, Loader2, X } from 'lucide-react';
import { useLibraryStore } from '@/stores/libraryStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSplitEditorStore } from '@/stores/splitEditorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorRegistry, setFocusedEditor } from '@/lib/editorRegistry';

const SYNC_META = 'exlibrisSplitMirror';

const sharedExtensions = () => [
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];

/**
 * Forward the steps of a doc-changing transaction from one editor to the
 * other. Each Editor instance owns its own schema, so steps must cross the
 * boundary as JSON and be rebuilt against the receiver's schema — exactly how
 * collaborative editing sends steps over the wire. Selections in the receiving
 * view are mapped through the steps by ProseMirror itself, so each pane's
 * cursor stays put while the text moves around it.
 * Returns false if the docs had drifted and a step could not apply.
 */
function forwardSteps(
  transaction: { docChanged: boolean; getMeta: (k: string) => unknown; steps: Array<{ toJSON: () => unknown }> },
  to: Editor
): boolean {
  const tr = to.state.tr;
  for (const step of transaction.steps) {
    const rebuilt = Step.fromJSON(to.state.schema, step.toJSON());
    if (tr.maybeStep(rebuilt).failed) return false;
  }
  tr.setMeta(SYNC_META, true);
  // The mirror has no history plugin; on the primary, forwarded mirror edits
  // SHOULD enter history (one document, one undo stack) — so no addToHistory
  // meta here, on purpose.
  to.view.dispatch(tr);
  return true;
}

/** Cross-schema doc comparison (node types differ per instance, so not .eq). */
function sameDoc(a: Editor, b: Editor): boolean {
  return JSON.stringify(a.getJSON()) === JSON.stringify(b.getJSON());
}

/** Same chapter in both panes: a second live view of the primary's document.
 *
 * Created imperatively (not via useEditor): the instance, its initial doc, and
 * the step-forwarding listeners must come into existence together, atomically,
 * against one specific primary instance — useEditor's instance manager can
 * recreate editors between renders, which would silently unpair them.
 */
function MirrorEditor({ primary }: { primary: Editor }) {
  const [mirror, setMirror] = useState<Editor | null>(null);

  useEffect(() => {
    if (primary.isDestroyed) return;

    const instance = new Editor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          // One document, one undo stack (the primary's).
          history: false,
        }),
        ...sharedExtensions(),
        Extension.create({
          name: 'mirrorHistoryKeys',
          addKeyboardShortcuts() {
            const run = (command: 'undo' | 'redo') => () => {
              if (!primary.isDestroyed) primary.commands[command]();
              return true; // swallow even if nothing to undo
            };
            return {
              'Mod-z': run('undo'),
              'Shift-Mod-z': run('redo'),
              'Mod-y': run('redo'),
              // Cyrillic layouts, mirroring @tiptap/extension-history.
              'Mod-я': run('undo'),
              'Shift-Mod-я': run('redo'),
            };
          },
        }),
      ],
      content: primary.getJSON(),
      editorProps: { attributes: { class: 'tiptap-editor prose-academia focus:outline-none' } },
      onFocus: ({ editor }) => setFocusedEditor(editor, 'mirror'),
    });

    const resync = (to: Editor, from: Editor) => {
      console.error('[exlibris] Split mirror desynced — rebuilding from source.');
      // Rebuild in the RECEIVER's schema; foreign-schema nodes get dropped
      // silently by ProseMirror's replace fitting, which is how docs vanish.
      const doc = to.state.schema.nodeFromJSON(from.getJSON());
      const tr = to.state.tr.replaceWith(0, to.state.doc.content.size, doc.content);
      tr.setMeta(SYNC_META, true);
      to.view.dispatch(tr);
    };

    type TrEvent = {
      transaction: { docChanged: boolean; getMeta: (k: string) => unknown; steps: Array<{ toJSON: () => unknown }> };
    };
    const onPrimaryTr = ({ transaction }: TrEvent) => {
      if (!transaction.docChanged || transaction.getMeta(SYNC_META) || instance.isDestroyed) return;
      if (!forwardSteps(transaction, instance)) resync(instance, primary);
    };
    const onMirrorTr = ({ transaction }: TrEvent) => {
      if (!transaction.docChanged || transaction.getMeta(SYNC_META) || primary.isDestroyed) return;
      if (!forwardSteps(transaction, primary)) resync(primary, instance);
    };
    primary.on('transaction', onPrimaryTr);
    instance.on('transaction', onMirrorTr);

    // A primary keystroke can land between getJSON() above and the listener
    // registration; if so, re-seed before the first forwarded step arrives.
    if (!sameDoc(instance, primary)) resync(instance, primary);

    setMirror(instance);
    return () => {
      primary.off('transaction', onPrimaryTr);
      instance.off('transaction', onMirrorTr);
      instance.destroy();
      setMirror(null);
    };
  }, [primary]);

  return mirror ? <EditorContent editor={mirror} /> : null;
}

/** Different chapter: an independent editor over the split buffer. */
function SplitChapterEditor() {
  const initialContent = useSplitEditorStore.getState().content;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ...sharedExtensions(),
    ],
    content: initialContent,
    editorProps: { attributes: { class: 'tiptap-editor prose-academia focus:outline-none' } },
    onUpdate: ({ editor: instance }) =>
      useSplitEditorStore.getState().setContent(instance.getHTML()),
    onFocus: ({ editor: instance }) => setFocusedEditor(instance, 'split'),
  });
  return <EditorContent editor={editor} />;
}

function SaveBadge() {
  const isSaving = useSplitEditorStore((state) => state.isSaving);
  const hasUnsaved = useSplitEditorStore((state) => state.hasUnsavedChanges);
  const saveError = useSplitEditorStore((state) => state.saveError);
  if (saveError) return <span className="text-[10px] text-academia-error shrink-0">{saveError}</span>;
  return (
    <span className="text-[10px] text-academia-text-muted shrink-0 tabular-nums">
      {isSaving ? 'Saving…' : hasUnsaved ? 'Unsaved' : 'Saved'}
    </span>
  );
}

export function SplitPane() {
  const chapters = useLibraryStore((state) => state.chapters);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const splitChapterId = useWorkspaceStore((state) => state.splitChapterId);
  const setSplitChapter = useWorkspaceStore((state) => state.setSplitChapter);
  const closeSplit = useWorkspaceStore((state) => state.closeSplit);

  const primaryChapterId = useEditorStore((state) => state.chapterId);
  const primaryEditor = useEditorRegistry((state) => state.primary);
  const primaryGeneration = useEditorRegistry((state) => state.primaryGeneration);

  const bufferChapterId = useSplitEditorStore((state) => state.chapterId);
  const bufferLoadVersion = useSplitEditorStore((state) => state.loadVersion);
  const isLoading = useSplitEditorStore((state) => state.isLoading);

  // A persisted id from another novel (or a deleted chapter) fails soft: the
  // picker simply shows no selection.
  const selected = chapters.find((chapter) => chapter.id === splitChapterId) ?? null;
  const isMirror = selected !== null && selected.id === primaryChapterId;

  // Keep the split buffer in step with the selection: open it for a different
  // chapter, close it (flushing) when mirroring or when nothing is selected.
  // Keyed on the chapter ID, not the summary object — summaries get a fresh
  // identity on every word-count tick, and this effect must not churn (and
  // setState) once per keystroke.
  const selectedId = selected?.id ?? null;
  const [bufferError, setBufferError] = useState(false);
  useEffect(() => {
    const store = useSplitEditorStore.getState();
    setBufferError(false);
    if (!selectedId || !activeNovelId || isMirror) {
      if (store.chapterId) void store.close();
      return;
    }
    void store.open(activeNovelId, selectedId).then(() => {
      if (useSplitEditorStore.getState().chapterId === null) setBufferError(true);
    });
  }, [selectedId, activeNovelId, isMirror]);

  // Leaving the pane (close button, view switch, unmount) persists its edits.
  useEffect(() => {
    return () => {
      void useSplitEditorStore.getState().flush();
    };
  }, []);

  return (
    <div
      data-testid="split-pane"
      className="flex flex-col h-full min-w-0 flex-1 rounded-lg border border-academia-border bg-academia-bg-secondary overflow-hidden"
    >
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-academia-border bg-academia-bg-secondary">
        <Columns2 className="h-3.5 w-3.5 text-academia-accent shrink-0" />
        <select
          value={selected?.id ?? ''}
          onChange={(event) => setSplitChapter(event.target.value || null)}
          className="min-w-0 flex-1 bg-academia-bg-tertiary border border-academia-border rounded-md px-2 py-1 text-xs text-academia-text-primary focus:outline-none focus:ring-1 focus:ring-academia-accent"
          title="Which chapter to edit in this pane"
        >
          <option value="">Choose a chapter…</option>
          {chapters.map((chapter, index) => (
            <option key={chapter.id} value={chapter.id}>
              {index + 1}. {chapter.title}
              {chapter.id === primaryChapterId ? ' (same as left)' : ''}
            </option>
          ))}
        </select>
        {isMirror ? (
          <span
            className="flex items-center gap-1 text-[10px] text-academia-accent shrink-0"
            title="Both panes show this chapter — it's one document, edits appear in both instantly and share one undo history"
          >
            <Link2 className="h-3 w-3" />
            same chapter
          </span>
        ) : selected ? (
          <SaveBadge />
        ) : null}
        <button
          type="button"
          onClick={closeSplit}
          title="Close the split pane"
          className="p-1 rounded text-academia-text-muted hover:text-academia-text-primary shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-xs text-academia-text-muted leading-relaxed">
              Pick a chapter above — including the one you're writing, to edit
              two parts of it side by side.
            </p>
          </div>
        ) : isMirror ? (
          primaryEditor && !primaryEditor.isDestroyed ? (
            <div className="max-w-2xl mx-auto px-6 py-5">
              <MirrorEditor key={primaryGeneration} primary={primaryEditor} />
            </div>
          ) : null
        ) : isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-academia-text-muted" />
          </div>
        ) : bufferError ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-xs text-academia-error">Could not load that chapter.</p>
          </div>
        ) : bufferChapterId === selected.id ? (
          <div className="max-w-2xl mx-auto px-6 py-5">
            <SplitChapterEditor key={`${bufferChapterId}:${bufferLoadVersion}`} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
