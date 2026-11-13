import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { BookOpen } from 'lucide-react';
import { EditorToolbar } from './EditorToolbar';
import { FloatingRefineMenu } from './FloatingRefineMenu';
import { ShadowSuggestion } from './ShadowSuggestion';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useSearchStore } from '@/stores/searchStore';
import { onUiCommand } from '@/lib/uiBus';
import { SearchHighlight, findMatchRange, searchHighlightKey } from './searchHighlight';
import { SplitPane } from './SplitPane';
import { SplitResizer } from './SplitResizer';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { routeHistory, setFocusedEditor, setPrimaryEditor } from '@/lib/editorRegistry';
/**
 * One TipTap instance per chapter. The parent keys this on `chapterId`, so a
 * chapter switch destroys and recreates it — which is the only reliable way to
 * drop ProseMirror's undo history. Previously you could Ctrl+Z backwards into
 * the previous document's prose.
 *
 * It reads `content` once, imperatively. Subscribing would re-render TipTap on
 * every keystroke.
 */
function ChapterEditor() {
  const shadowSuggestion = useEditorStore((state) => state.shadowSuggestion);
  const setContent = useEditorStore((state) => state.setContent);
  const initialContent = useEditorStore.getState().content;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Begin your chapter…' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      SearchHighlight,
    ],
    content: initialContent,
    editorProps: { attributes: { class: 'tiptap-editor prose-academia focus:outline-none' } },
    // Synchronous. The store debounces the network save, so the buffer is never
    // newer than what flush() can persist before a chapter switch.
    onUpdate: ({ editor: instance }) => setContent(instance.getHTML()),
    onFocus: ({ editor: instance }) => setFocusedEditor(instance, 'primary'),
  });

  // Publish this instance so the split pane can mirror it and menu undo/redo
  // can find it. Cleared on unmount (chapter switch, restore, view change).
  useEffect(() => {
    if (!editor) return;
    setPrimaryEditor(editor);
    return () => setPrimaryEditor(null);
  }, [editor]);
  // Desktop menu Edit ▸ Undo/Redo. ProseMirror keeps its own history, so the
  // native role would miss; routeHistory aims at the focused pane's stack
  // (the mirror pane defers to this editor's — one document, one stack).
  useEffect(() => {
    const offUndo = onUiCommand('editor-undo', () => routeHistory('undo'));
    const offRedo = onUiCommand('editor-redo', () => routeHistory('redo'));
    return () => {
      offUndo();
      offRedo();
    };
  }, []);
  // A search hit that landed on this chapter: select it, scroll to it, and
  // leave a fading highlight so the eye can find it on a dense page.
  const pendingJump = useSearchStore((state) => state.pendingJump);
  const consumeJump = useSearchStore((state) => state.consumeJump);
  const chapterId = useEditorStore((state) => state.chapterId);

  useEffect(() => {
    if (!editor || !pendingJump || pendingJump.chapterId !== chapterId) return;

    const range = findMatchRange(editor.state.doc, pendingJump.query, pendingJump.occurrence, pendingJump.options);
    consumeJump();
    if (!range) return;

    editor.chain().focus().setTextSelection(range).run();
    editor.view.dispatch(editor.state.tr.setMeta(searchHighlightKey, range));

    const dom = editor.view.domAtPos(range.from).node;
    const element = dom instanceof HTMLElement ? dom : dom.parentElement;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timeout = setTimeout(() => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(searchHighlightKey, null));
    }, 2600);
    return () => clearTimeout(timeout);
  }, [editor, pendingJump, chapterId, consumeJump]);

  return (
    <>
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-academia-bg-secondary rounded-b-lg border border-t-0 border-academia-border">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <div className="writing-area min-h-[calc(100vh-16rem)] px-8 py-8">
            <EditorContent editor={editor} />
            {editor && shadowSuggestion && <ShadowSuggestion editor={editor} />}
          </div>
        </div>
      </div>
      {editor && <FloatingRefineMenu editor={editor} />}
    </>
  );
}
export function Editor() {
  const chapterId = useEditorStore((state) => state.chapterId);
  // Part of the mount key: a snapshot restore replaces the buffer and bumps
  // this, remounting TipTap exactly like a chapter switch (fresh undo stack).
  const loadVersion = useEditorStore((state) => state.loadVersion);
  const isLoadingChapter = useEditorStore((state) => state.isLoadingChapter);
  const activeNovelId = useLibraryStore((state) => state.activeNovelId);
  const isSplitOpen = useWorkspaceStore((state) => state.isSplitOpen);
  const splitRatio = useWorkspaceStore((state) => state.splitRatio);
  // Previously the editor was always writable. With no active document, every
  // keystroke went into a store that had nothing to save it to.
  if (!chapterId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-8 bg-academia-bg-secondary rounded-lg border border-academia-border">
        <BookOpen className="h-12 w-12 text-academia-accent/30 mb-4" />
        <p className="text-academia-text-muted text-sm max-w-sm leading-relaxed">
          {isLoadingChapter
            ? 'Opening chapter…'
            : activeNovelId
              ? 'Select a chapter from the Library, or create one to start writing.'
              : 'Open a novel from the Library, or create your first one.'}
        </p>
      </div>
    );
  }
  return (
    // Split editor: two independently scrolling panes around a draggable
    // divider; the widths come from the persisted ratio.
    <div className="flex h-full">
      <div
        data-testid="primary-pane"
        className="flex flex-col h-full min-w-[16rem]"
        style={{ flex: isSplitOpen ? `${1 - splitRatio} 1 0%` : '1 1 0%' }}
      >
        <ChapterEditor key={`${chapterId}:${loadVersion}`} />
      </div>
      {isSplitOpen && (
        <>
          <SplitResizer />
          <div className="flex h-full min-w-[16rem]" style={{ flex: `${splitRatio} 1 0%` }}>
            <SplitPane />
          </div>
        </>
      )}
    </div>
  );
}
