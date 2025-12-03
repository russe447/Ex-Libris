import { useEffect, useState, useRef } from 'react';
import { Plus, FileText, Trash2, Clock, Check, Loader2, Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDocumentStore } from '@/stores/documentStore';
import { cn } from '@/lib/utils';

function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString();
}

export function DocumentsPanel() {
  const {
    documents,
    activeDocumentId,
    isLoadingDocuments,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    fetchDocuments,
    createNewDocument,
    loadDocument,
    deleteDocument,
    setTitle,
  } = useDocumentStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreateNew = async () => {
    setIsCreating(true);
    try {
      await createNewDocument();
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }
    
    setDeletingId(id);
    try {
      await deleteDocument(id);
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = async (id: string) => {
    if (id === activeDocumentId || editingId === id) return;
    
    try {
      await loadDocument(id);
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, doc: { id: string; title: string }) => {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditValue(doc.title || 'Untitled');
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editValue.trim() || 'Untitled';
    const doc = documents.find(d => d.id === id);
    
    if (doc && trimmed !== doc.title) {
      try {
        // If this is the active document, update it via the store (which will autosave)
        if (id === activeDocumentId) {
          setTitle(trimmed);
        } else {
          // For non-active documents, we need to fetch the full document, update it, and save
          const { fetchDocument, updateDocument } = await import('@/services/documents');
          const fullDoc = await fetchDocument(id);
          await updateDocument(id, {
            title: trimmed,
            content: fullDoc.content,
            wordCount: fullDoc.wordCount,
          });
          // Refresh the document list to show the updated title
          await fetchDocuments();
        }
      } catch (error) {
        console.error('Failed to update document title:', error);
      }
    }
    
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancelEdit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-academia-border">
        <h2 className="font-display text-lg text-academia-text-primary">
          Documents
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreateNew}
          disabled={isCreating}
          className="h-8 gap-1"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span>New</span>
        </Button>
      </div>

      {/* Save status */}
      {activeDocumentId && (
        <div className="px-4 py-2 border-b border-academia-border bg-academia-bg-tertiary/50">
          <div className="flex items-center gap-2 text-xs text-academia-text-muted">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Clock className="h-3 w-3" />
                <span>Unsaved changes</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-3 w-3 text-academia-success" />
                <span>Saved {formatRelativeTime(lastSaved)}</span>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingDocuments ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <FileText className="h-8 w-8 text-academia-text-muted/50 mb-2" />
            <p className="text-sm text-academia-text-muted">
              No documents yet
            </p>
            <p className="text-xs text-academia-text-muted mt-1">
              Click "New" to create your first document
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleLoad(doc.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-colors group',
                  'hover:bg-academia-bg-tertiary',
                  activeDocumentId === doc.id && 'bg-academia-bg-tertiary border border-academia-accent-gold/30'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === doc.id ? (
                      <div className="flex items-center gap-1 mb-1">
                        <Input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveEdit(doc.id)}
                          onKeyDown={(e) => handleEditKeyDown(e, doc.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 px-2 text-sm flex-1"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit(doc.id);
                          }}
                          className="p-1 rounded hover:bg-academia-bg-elevated text-academia-success transition-colors"
                          title="Save"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-1 rounded hover:bg-academia-bg-elevated text-academia-text-muted hover:text-academia-error transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <h3 className={cn(
                          'font-medium text-sm truncate flex-1',
                          activeDocumentId === doc.id 
                            ? 'text-academia-accent-gold' 
                            : 'text-academia-text-primary'
                        )}>
                          {doc.title || 'Untitled'}
                        </h3>
                        <button
                          onClick={(e) => handleStartEdit(e, doc)}
                          className={cn(
                            'p-1 rounded opacity-0 group-hover/title:opacity-100 transition-opacity',
                            'hover:bg-academia-bg-elevated text-academia-text-muted hover:text-academia-accent-gold'
                          )}
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-academia-text-muted">
                      <span>{doc.wordCount.toLocaleString()} words</span>
                      <span>•</span>
                      <span>{formatRelativeTime(doc.lastModified)}</span>
                    </div>
                  </div>
                  
                  {editingId !== doc.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, doc.id)}
                      disabled={deletingId === doc.id}
                      className={cn(
                        'h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity',
                        'text-academia-text-muted hover:text-academia-error',
                        deletingId === doc.id && 'opacity-100'
                      )}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

