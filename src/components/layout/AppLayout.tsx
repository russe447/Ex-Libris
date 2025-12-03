import { ReactNode, useState, useRef, useEffect } from 'react';
import { BookOpen, Edit2, Check, X } from 'lucide-react';
import { useDocumentStore } from '@/stores/documentStore';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
}

function EditableTitle() {
  const { title, setTitle, activeDocumentId } = useDocumentStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (activeDocumentId) {
      setIsEditing(true);
      setEditValue(title);
    }
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      setTitle(trimmed);
    } else if (!trimmed) {
      setEditValue(title); // Reset if empty
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!activeDocumentId) {
    return (
      <span className="text-sm text-academia-text-secondary">
        {title}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-7 px-2 text-sm min-w-[200px] max-w-[400px]"
        />
        <button
          onClick={handleSave}
          className="p-1 rounded hover:bg-academia-bg-tertiary text-academia-success transition-colors"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 rounded hover:bg-academia-bg-tertiary text-academia-text-muted hover:text-academia-error transition-colors"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      className={cn(
        'flex items-center gap-2 group text-sm text-academia-text-secondary',
        'hover:text-academia-text-primary transition-colors',
        'px-2 py-1 rounded hover:bg-academia-bg-tertiary'
      )}
      title="Click to rename"
    >
      <span className="truncate max-w-[300px]">{title}</span>
      <Edit2 className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  const { wordCount } = useDocumentStore();

  return (
    <div className="h-screen flex flex-col bg-academia-bg-primary overflow-hidden">
      <header className="shrink-0 h-14 bg-academia-bg-secondary border-b border-academia-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-academia-accent-gold/20">
            <BookOpen className="h-4 w-4 text-academia-accent-gold" />
          </div>
          <span className="font-display text-xl font-semibold text-academia-text-primary">
            Ex Libris
          </span>
        </div>

        <div className="flex items-center gap-4">
          <EditableTitle />
          <span className="text-xs text-academia-text-muted px-2 py-1 bg-academia-bg-tertiary rounded">
            {wordCount.toLocaleString()} words
          </span>
        </div>

        <div className="w-32" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 p-6 overflow-hidden">
          {children}
        </main>

        {sidebar}
      </div>
    </div>
  );
}