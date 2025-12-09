import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRefine } from '@/hooks/useAnthropic';
import { useDocumentStore } from '@/stores/documentStore';
import { cn } from '@/lib/utils';

interface FloatingRefineMenuProps {
  editor: Editor;
}

interface SelectionState {
  text: string;
  from: number;
  to: number;
}

export function FloatingRefineMenu({ editor }: FloatingRefineMenuProps) {
  const [showTrigger, setShowTrigger] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [instruction, setInstruction] = useState('');
  const [selection, setSelection] = useState<SelectionState | null>(null);
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { refine } = useRefine();
  const { isRefining, shadowSuggestion } = useDocumentStore();

  const quickActions = [
    { label: 'More detail', instruction: 'Add more sensory details and vivid description' },
    { label: 'Tighten', instruction: 'Make this more concise while preserving meaning' },
    { label: 'Vary rhythm', instruction: 'Vary the sentence structure and rhythm' },
    { label: 'Stronger verbs', instruction: 'Use stronger, more specific verbs' },
  ];

  const closeAll = useCallback(() => {
    setShowTrigger(false);
    setShowMenu(false);
    setInstruction('');
    setSelection(null);
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Don't process if clicking on the trigger or menu
    if (
      triggerRef.current?.contains(e.target as Node) ||
      menuRef.current?.contains(e.target as Node)
    ) {
      return;
    }

    // Don't process if menu is already open
    if (showMenu) {
      return;
    }

    if (shadowSuggestion) {
      closeAll();
      return;
    }

    setTimeout(() => {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      
      if (hasSelection) {
        const selectedText = editor.state.doc.textBetween(from, to);
        
        if (selectedText.trim().length > 0) {
          const { view } = editor;
          const endCoords = view.coordsAtPos(to);
          
          setPosition({
            top: endCoords.bottom + 8,
            left: endCoords.left,
          });
          setSelection({ text: selectedText, from, to });
          setShowTrigger(true);
          setShowMenu(false);
        } else {
          closeAll();
        }
      } else {
        closeAll();
      }
    }, 10);
  }, [editor, shadowSuggestion, closeAll, showMenu]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      
      if (!clickedTrigger && !clickedMenu) {
        closeAll();
      }
    };

    if (showTrigger || showMenu) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTrigger, showMenu, closeAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAll]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
    setShowTrigger(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRefine = async (customInstruction?: string) => {
    if (!selection) return;
    
    const finalInstruction = customInstruction || instruction;
    if (!finalInstruction.trim()) return;

    try {
      await refine(selection.text, finalInstruction, selection.from, selection.to);
      closeAll();
    } catch (error) {
      console.error('Failed to refine:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  if (shadowSuggestion) return null;

  return (
    <>
      {showTrigger && !showMenu && (
        <button
          ref={triggerRef}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleTriggerClick}
          className={cn(
            'fixed z-50 p-2 rounded-full',
            'bg-academia-accent/20 hover:bg-academia-accent/30',
            'border border-academia-accent/50',
            'text-academia-accent',
            'transition-all duration-150',
            'shadow-lg hover:shadow-glow',
            'animate-fade-in'
          )}
          style={{
            top: Math.max(10, position.top),
            left: Math.max(10, position.left),
          }}
          title="Refine selection"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {showMenu && (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-50 bg-academia-bg-elevated border border-academia-border rounded-lg shadow-soft p-3 animate-fade-in',
            'min-w-[320px] max-w-[400px]'
          )}
          style={{
            top: Math.max(10, position.top),
            left: Math.max(10, Math.min(position.left, window.innerWidth - 420)),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-academia-text-secondary">
              <Sparkles className="h-4 w-4 text-academia-accent" />
              <span>Refine Selection</span>
            </div>
            <button
              onClick={closeAll}
              className="p-1 rounded hover:bg-academia-bg-tertiary text-academia-text-muted hover:text-academia-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleRefine(action.instruction)}
                disabled={isRefining}
                className="text-xs px-2 py-1 rounded bg-academia-bg-tertiary text-academia-text-secondary hover:text-academia-accent hover:bg-academia-bg-primary border border-academia-border-subtle transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Custom instruction..."
              className="bg-academia-bg-tertiary text-sm"
              disabled={isRefining}
            />
            <Button
              onClick={() => handleRefine()}
              disabled={!instruction.trim() || isRefining}
              size="default"
              className="shrink-0"
            >
              {isRefining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refine'
              )}
            </Button>
          </div>

          {selection && (
            <div className="mt-3 pt-3 border-t border-academia-border-subtle">
              <p className="text-xs text-academia-text-muted mb-1">Selected text:</p>
              <p className="text-xs text-academia-text-secondary italic line-clamp-2">
                "{selection.text.slice(0, 100)}{selection.text.length > 100 ? '...' : ''}"
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}