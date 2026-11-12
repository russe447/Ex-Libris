// src/components/sidebar/ChatPanel.tsx
import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  BookOpen,
  Loader2,
  FileQuestion,
  BookMarked,
  X,
  ChevronDown,
  Check,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ChatMessage } from './ChatMessage';
import { useChatStore } from '@/stores/chatStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useCodexStore } from '@/stores/codexStore';
import { useChatContextStore } from '@/stores/chatContextStore';
import { useEditorStore } from '@/stores/editorStore';
import { CHAT_CONTEXT_SCOPES } from '@/lib/manuscript';
import { useRouteStore } from '@/stores/routeStore';
import { TIER_ORDER } from '@/services/settings';
import { useChat } from '@/hooks/useAnthropic';
import { CODEX_TYPES } from '@/lib/codex';
import { cn } from '@/lib/utils';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [showCodexPicker, setShowCodexPicker] = useState(false);
  const [showScopePicker, setShowScopePicker] = useState(false);
  const [showTierPicker, setShowTierPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    activeNovelId,
    clearMessages,
  } = useChatStore();
  const novelTitle = useLibraryStore(
    (state) => state.novels.find((novel) => novel.id === state.activeNovelId)?.title ?? 'Untitled Novel'
  );
  const {
    entries: codexEntries,
    selectedEntryIds,
    toggleEntrySelection,
    clearSelection,
  } = useCodexStore();
  const selectedEntries = codexEntries.filter((e) => selectedEntryIds.includes(e.id));
  const { sendMessage } = useChat();

  // Context scope is persisted globally and defaults to the open chapter.
  const scope = useChatContextStore((state) => state.scope);
  const setScope = useChatContextStore((state) => state.setScope);
  const tierPreference = useChatContextStore((state) => state.tier);
  const setTierPreference = useChatContextStore((state) => state.setTier);
  const routesByMessage = useRouteStore((state) => state.byMessage);
  const activeScope = CHAT_CONTEXT_SCOPES.find((entry) => entry.id === scope)!;
  const openChapterTitle = useLibraryStore(
    (state) => state.chapters.find((chapter) => chapter.id === state.activeChapterId)?.title ?? null
  );
  const hasOpenChapter = useEditorStore((state) => state.chapterId !== null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Jump (don't animate) to the bottom when the conversation is swapped.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeNovelId, isLoadingHistory]);

  // Close the pickers when the conversation is swapped.
  useEffect(() => {
    setShowCodexPicker(false);
    setShowScopePicker(false);
    setShowTierPicker(false);
  }, [activeNovelId]);

  const canChat = Boolean(activeNovelId) && !isLoadingHistory;

  const handleSend = async () => {
    if (!input.trim() || isLoading || !canChat) return;

    const message = input;
    setInput('');
    await sendMessage(message, scope, tierPreference === 'auto' ? undefined : tierPreference);
  };

  const handleClear = () => {
    if (
      window.confirm(
        `Clear the conversation for "${novelTitle}"? This cannot be undone.`
      )
    ) {
      void clearMessages();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-academia-border">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-academia-text-primary">
            Writing Assistant
          </h2>
          {activeNovelId && (
            <p className="text-xs text-academia-text-muted truncate max-w-[200px]">
              {novelTitle}
            </p>
          )}
        </div>
        {messages.length > 0 && !isLoadingHistory && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={isLoading}
            className="h-8 w-8 text-academia-text-muted hover:text-academia-error"
            title="Clear this document's conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-academia-error border-b border-academia-border">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Loader2 className="h-6 w-6 text-academia-accent/50 animate-spin mb-3" />
            <p className="text-academia-text-muted text-sm">Loading conversation…</p>
          </div>
        ) : !activeNovelId ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileQuestion className="h-12 w-12 text-academia-accent/30 mb-4" />
            <p className="text-academia-text-muted text-sm leading-relaxed">
              Open or create a novel to start a conversation. Each novel keeps its
              own chat history across all its chapters.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <BookOpen className="h-12 w-12 text-academia-accent/30 mb-4" />
            <p className="text-academia-text-muted text-sm leading-relaxed">
              Ask me about your story, brainstorm ideas, or discuss your characters
              and plot. This conversation is saved with “{novelTitle}”.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id}>
                <ChatMessage message={message} />
                {message.role === 'assistant' && routesByMessage[message.id] && (
                  <p
                    className="mt-1 px-1 text-[10px] text-academia-text-muted"
                    title={`Router: ${routesByMessage[message.id].reason}`}
                  >
                    {routesByMessage[message.id].tier} · {routesByMessage[message.id].model}
                    {routesByMessage[message.id].substituted && ' (substituted)'}
                  </p>
                )}
                {message.codexEntries && message.codexEntries.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1 mt-1 px-1">
                    <BookMarked className="h-3 w-3 text-academia-text-muted shrink-0" />
                    {message.codexEntries.map((ref) => (
                      <span
                        key={ref.id}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-academia-bg-tertiary text-academia-text-muted border border-academia-border-subtle"
                        title={CODEX_TYPES[ref.type]?.label ?? ref.type}
                      >
                        {ref.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-academia-border">
        {selectedEntries.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-2">
            {selectedEntries.map((entry) => (
              <span
                key={entry.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-academia-accent/40 bg-academia-accent/10 text-academia-accent"
              >
                {entry.name}
                <button
                  onClick={() => toggleEntrySelection(entry.id)}
                  className="hover:text-academia-error"
                  title="Remove from context"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearSelection}
              className="text-xs text-academia-text-muted hover:text-academia-error px-1"
            >
              clear all
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              setShowScopePicker((open) => !open);
              setShowCodexPicker(false);
            }}
            disabled={!canChat}
            className={cn(
              'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50',
              scope === 'none'
                ? 'border-academia-border text-academia-text-muted'
                : 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
            )}
            title={`Context sent with your message: ${activeScope.description}`}
          >
            <BookOpen className="h-3 w-3" />
            {activeScope.label}
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setShowTierPicker((open) => !open);
              setShowScopePicker(false);
              setShowCodexPicker(false);
            }}
            disabled={!canChat}
            className={cn(
              'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50',
              tierPreference === 'auto'
                ? 'border-academia-border text-academia-text-muted'
                : 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
            )}
            title="Which model tier answers. Auto lets the router decide."
          >
            <Gauge className="h-3 w-3" />
            {tierPreference === 'auto' ? 'Auto model' : `${tierPreference} model`}
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setShowCodexPicker((v) => !v);
              setShowScopePicker(false);
              setShowTierPicker(false);
            }}
            disabled={!canChat || codexEntries.length === 0}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50 ${
              selectedEntries.length > 0
                ? 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
                : 'border-academia-border text-academia-text-muted'
            }`}
            title={
              codexEntries.length === 0
                ? 'No codex entries yet — add some in the Codex tab'
                : 'Attach codex entries as context'
            }
          >
            <BookMarked className="h-3 w-3" />
            Codex{selectedEntries.length > 0 && ` (${selectedEntries.length})`}
          </button>
        </div>

        {showScopePicker && (
          <div className="mb-3 rounded-md border border-academia-border bg-academia-bg-tertiary/50 p-1">
            {CHAT_CONTEXT_SCOPES.map((entry) => {
              const isActive = entry.id === scope;
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    setScope(entry.id);
                    setShowScopePicker(false);
                  }}
                  className={cn(
                    'w-full flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-academia-bg-tertiary',
                    isActive ? 'text-academia-accent' : 'text-academia-text-secondary'
                  )}
                >
                  <Check
                    className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', !isActive && 'opacity-0')}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm">{entry.label}</span>
                    <span className="block text-[10px] text-academia-text-muted">
                      {entry.id === 'chapter' && openChapterTitle
                        ? `Only “${openChapterTitle}”`
                        : entry.description}
                    </span>
                  </span>
                </button>
              );
            })}
            {scope === 'chapter' && !hasOpenChapter && (
              <p className="px-2 py-1.5 text-[10px] text-academia-text-muted">
                No chapter is open, so the outline will be sent instead.
              </p>
            )}
          </div>
        )}

        {showTierPicker && (
          <div className="mb-3 rounded-md border border-academia-border bg-academia-bg-tertiary/50 p-1">
            {(['auto', ...TIER_ORDER] as const).map((option) => {
              const isActive = option === tierPreference;
              return (
                <button
                  key={option}
                  onClick={() => {
                    setTierPreference(option);
                    setShowTierPicker(false);
                  }}
                  className={cn(
                    'w-full flex items-start gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-academia-bg-tertiary',
                    isActive ? 'text-academia-accent' : 'text-academia-text-secondary'
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', !isActive && 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block text-sm capitalize">
                      {option === 'auto' ? 'Auto' : option}
                    </span>
                    <span className="block text-[10px] text-academia-text-muted">
                      {option === 'auto'
                        ? 'Router picks from context size and what you ask'
                        : `Always use the ${option} tier for this conversation`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showCodexPicker && (
          <div className="mb-3 max-h-40 overflow-y-auto rounded-md border border-academia-border bg-academia-bg-tertiary/50 p-1">
            {codexEntries.map((entry) => {
              const checked = selectedEntryIds.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => toggleEntrySelection(entry.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                    'hover:bg-academia-bg-tertiary',
                    checked ? 'text-academia-accent' : 'text-academia-text-secondary'
                  )}
                >
                  <span
                    className={cn(
                      'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 text-[9px]',
                      checked
                        ? 'border-academia-accent bg-academia-accent/20'
                        : 'border-academia-border'
                    )}
                  >
                    {checked && '✓'}
                  </span>
                  <span className="truncate flex-1">{entry.name}</span>
                  <span className="text-[10px] text-academia-text-muted shrink-0">
                    {CODEX_TYPES[entry.type].label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              canChat ? 'Ask about your story...' : 'Open a document to chat...'
            }
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading || !canChat}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !canChat}
            size="icon"
            className="shrink-0 self-end h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
