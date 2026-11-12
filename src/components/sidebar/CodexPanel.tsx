// src/components/sidebar/CodexPanel.tsx
import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookMarked,
  MessageSquarePlus,
  MessageSquareText,
  User,
  MapPin,
  Package,
  CalendarDays,
  Landmark,
  Shapes,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useCodexStore } from '@/stores/codexStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { CODEX_TYPES, CODEX_TYPE_ORDER } from '@/lib/codex';
import { CodexEntry, CodexEntryType } from '@/types';
import { cn } from '@/lib/utils';
import { CodexSuggestions } from './CodexSuggestions';
import { useCodexSuggestionScan } from '@/hooks/useCodexSuggestions';

const TYPE_ICONS: Record<CodexEntryType, LucideIcon> = {
  person: User,
  place: MapPin,
  item: Package,
  event: CalendarDays,
  organization: Landmark,
  other: Shapes,
};

function EntryEditor({
  entry,
  onClose,
}: {
  entry: CodexEntry;
  onClose: () => void;
}) {
  const { updateEntry, deleteEntry, isSaving } = useCodexStore();
  const [name, setName] = useState(entry.name);
  const [fields, setFields] = useState<Record<string, string>>({ ...entry.fields });
  const definition = CODEX_TYPES[entry.type];

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      await updateEntry(entry.id, { name: trimmedName, fields });
      onClose();
    } catch {
      // store surfaced the error; keep the draft open so nothing is lost
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${entry.name}" from the codex? This cannot be undone.`)) {
      await deleteEntry(entry.id);
      onClose();
    }
  };

  return (
    <div className="p-3 space-y-3 border-t border-academia-border-subtle">
      <div>
        <label className="text-xs text-academia-text-muted block mb-1">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          maxLength={200}
        />
      </div>
      {definition.fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs text-academia-text-muted block mb-1">{field.label}</label>
          {field.multiline ? (
            <Textarea
              value={fields[field.key] ?? ''}
              onChange={(e) => setFields((f) => ({ ...f, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="min-h-[60px] text-sm"
              maxLength={10000}
            />
          ) : (
            <Input
              value={fields[field.key] ?? ''}
              onChange={(e) => setFields((f) => ({ ...f, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="h-8 text-sm"
              maxLength={10000}
            />
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-academia-text-muted hover:text-academia-error gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CodexPanel() {
  const {
    entries,
    selectedEntryIds,
    isLoading,
    isSaving,
    error,
    activeNovelId,
    createEntry,
    toggleEntrySelection,
    suggestionsEnabled,
    setSuggestionsEnabled,
  } = useCodexStore();
  // Scans the active document for repeated capitalized names. Debounced +
  // idle-scheduled, and only alive while this panel is mounted.
  useCodexSuggestionScan(suggestionsEnabled);
  const novelTitle = useLibraryStore(
    (state) => state.novels.find((novel) => novel.id === state.activeNovelId)?.title ?? ''
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState<CodexEntryType>('person');
  const [newName, setNewName] = useState('');

  // Close any open editor/form when the document (and thus the codex) changes.
  useEffect(() => {
    setExpandedId(null);
    setShowNewForm(false);
    setNewName('');
  }, [activeNovelId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const entry = await createEntry(newType, name);
    if (entry) {
      setNewName('');
      setShowNewForm(false);
      setExpandedId(entry.id); // jump straight into filling out the details
    }
  };

  if (!activeNovelId) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-academia-border">
          <h2 className="font-display text-lg text-academia-text-primary">Codex</h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
          <BookMarked className="h-12 w-12 text-academia-accent/30 mb-4" />
          <p className="text-academia-text-muted text-sm leading-relaxed">
            Open or create a novel to build its codex of people, places, items, and events.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-academia-border">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-academia-text-primary">Codex</h2>
          <p className="text-xs text-academia-text-muted truncate max-w-[200px]">
            {novelTitle}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSuggestionsEnabled(!suggestionsEnabled)}
            className={cn('h-8 w-8', suggestionsEnabled && 'text-academia-accent')}
            title={
              suggestionsEnabled
                ? 'Auto-suggest is on — click to stop scanning the manuscript'
                : 'Auto-suggest is off — click to scan the manuscript for new names'
            }
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewForm((v) => !v)}
            className="h-8 gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-academia-error border-b border-academia-border">
          {error}
        </div>
      )}

      {showNewForm && (
        <div className="p-3 border-b border-academia-border space-y-2 bg-academia-bg-tertiary/40">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as CodexEntryType)}
            className="w-full h-8 rounded-md border border-academia-border bg-academia-bg-tertiary px-2 text-sm text-academia-text-primary focus:outline-none focus:ring-2 focus:ring-academia-accent"
          >
            {CODEX_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {CODEX_TYPES[type].label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={`${CODEX_TYPES[newType].label} name…`}
              className="h-8 text-sm flex-1"
              maxLength={200}
              autoFocus
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-academia-text-muted" />
          </div>
        ) : (
          <div className="p-2 space-y-3">
            <CodexSuggestions onEntryCreated={(id) => setExpandedId(id)} />
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
                <BookMarked className="h-8 w-8 text-academia-text-muted/50 mb-2" />
                <p className="text-sm text-academia-text-muted">No codex entries yet</p>
                <p className="text-xs text-academia-text-muted mt-1">
                  Click "New" to add a person, place, item, or event
                </p>
              </div>
            ) : (
              CODEX_TYPE_ORDER.map((type) => {
              const group = entries.filter((e) => e.type === type);
              if (group.length === 0) return null;
              const Icon = TYPE_ICONS[type];
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs uppercase tracking-wide text-academia-text-muted">
                    <Icon className="h-3 w-3" />
                    {CODEX_TYPES[type].pluralLabel}
                    <span className="opacity-60">({group.length})</span>
                  </div>
                  <div className="space-y-1">
                    {group.map((entry) => {
                      const isExpanded = expandedId === entry.id;
                      const isSelected = selectedEntryIds.includes(entry.id);
                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            'rounded-lg border border-transparent',
                            isExpanded && 'bg-academia-bg-tertiary border-academia-accent/30'
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center gap-1 p-2 rounded-lg cursor-pointer group',
                              !isExpanded && 'hover:bg-academia-bg-tertiary'
                            )}
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-academia-text-muted shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-academia-text-muted shrink-0" />
                            )}
                            <span className="text-sm text-academia-text-primary truncate flex-1">
                              {entry.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEntrySelection(entry.id);
                              }}
                              className={cn(
                                'p-1 rounded transition-colors shrink-0',
                                isSelected
                                  ? 'text-academia-accent'
                                  : 'text-academia-text-muted opacity-0 group-hover:opacity-100 hover:text-academia-accent'
                              )}
                              title={
                                isSelected
                                  ? 'Included in chat context — click to remove'
                                  : 'Include in chat context'
                              }
                            >
                              {isSelected ? (
                                <MessageSquareText className="h-3.5 w-3.5" />
                              ) : (
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          {isExpanded && (
                            <EntryEditor
                              key={`${entry.id}-${entry.updatedAt.getTime()}`}
                              entry={entry}
                              onClose={() => setExpandedId(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
