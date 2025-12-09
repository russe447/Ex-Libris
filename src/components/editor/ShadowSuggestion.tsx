import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDocumentStore } from '@/stores/documentStore';

interface ShadowSuggestionProps {
  editor: Editor;
}

export function ShadowSuggestion({ editor }: ShadowSuggestionProps) {
  const { shadowSuggestion, acceptSuggestion, rejectSuggestion } = useDocumentStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shadowSuggestion && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [shadowSuggestion]);

  if (!shadowSuggestion) return null;

  const handleAccept = () => {
    const result = acceptSuggestion();
    if (result) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: result.from, to: result.to })
        .deleteSelection()
        .insertContent(result.text)
        .run();
    }
  };

  const handleReject = () => {
    rejectSuggestion();
    editor.commands.focus();
  };

  return (
    <div
      ref={containerRef}
      className="shadow-suggestion my-4 animate-slide-up"
    >
      <div className="flex items-center gap-2 mb-2 text-sm text-academia-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-academia-accent" />
        <span className="italic">"{shadowSuggestion.instruction}"</span>
      </div>

      <div className="shadow-suggestion-content text-editor mb-3">
        {shadowSuggestion.suggestedText}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleAccept}
          variant="success"
          size="sm"
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          onClick={handleReject}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-academia-text-muted hover:text-academia-error"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}