import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { EditorToolbar } from './EditorToolbar';
import { FloatingRefineMenu } from './FloatingRefineMenu';
import { ShadowSuggestion } from './ShadowSuggestion';
import { useDocumentStore } from '@/stores/documentStore';

export function Editor() {
  const { 
    content,
    setContent, 
    shadowSuggestion,
    activeDocumentId,
    loadDocument,
    fetchDocuments,
  } = useDocumentStore();
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingContent = useRef(false);

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
      // Don't trigger save when we're loading content
      if (isLoadingContent.current) return;
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        const html = editor.getHTML();
        setContent(html);
      }, 300);
    },
  });

  // Memoize the initialization function to avoid unnecessary recreations
  const initializeDocument = useCallback(async () => {
    await fetchDocuments();
    
    const savedDocumentId = localStorage.getItem('exlibris_active_document');
    if (savedDocumentId) {
      try {
        await loadDocument(savedDocumentId);
      } catch {
        // Document might have been deleted, clear the reference
        localStorage.removeItem('exlibris_active_document');
      }
    }
  }, [fetchDocuments, loadDocument]);

  // Load the last active document on mount
  useEffect(() => {
    initializeDocument();
  }, [initializeDocument]);

  // Sync editor content when document content changes (e.g., when loading a document)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isLoadingContent.current = true;
      editor.commands.setContent(content);
      // Use requestAnimationFrame to ensure the flag is reset after the update cycle
      requestAnimationFrame(() => {
        isLoadingContent.current = false;
      });
    }
  }, [editor, content, activeDocumentId]);

  // Cleanup timeout on unmount
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
