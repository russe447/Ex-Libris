import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { EditorToolbar } from './EditorToolbar';
import { FloatingRefineMenu } from './FloatingRefineMenu';
import { ShadowSuggestion } from './ShadowSuggestion';
import { useDocumentStore } from '@/stores/documentStore';
import { countWords } from '@/lib/utils';

export function Editor() {
  const { setContent, shadowSuggestion } = useDocumentStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Begin your story...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose-academia focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        const html = editor.getHTML();
        setContent(html);
      }, 1000);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      
      <div className="flex-1 overflow-y-auto bg-academia-bg-secondary rounded-b-lg border border-t-0 border-academia-border">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <div className="writing-area min-h-[calc(100vh-16rem)] px-8 py-8">
            <EditorContent editor={editor} />
            
            {editor && shadowSuggestion && (
              <ShadowSuggestion editor={editor} />
            )}
          </div>
        </div>
      </div>

      {editor && <FloatingRefineMenu editor={editor} />}
    </div>
  );
}