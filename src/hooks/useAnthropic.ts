import { useCallback } from 'react';
import { refineText, streamChatMessage } from '@/services/anthropic';
import { useEditorStore } from '@/stores/editorStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useChatStore } from '@/stores/chatStore';
import { useCodexStore } from '@/stores/codexStore';
import { generateId, extractPrecedingContext } from '@/lib/utils';
import { buildCodexContext } from '@/lib/codex';
import { ChatContextScope, buildOutlineContext, buildScopedContext } from '@/lib/manuscript';
import { useChatContextStore } from '@/stores/chatContextStore';
import * as novelsService from '@/services/novels';
import { ChatMessage } from '@/types';
import type { AiTier } from '@/services/settings';
import { useRouteStore } from '@/stores/routeStore';
import { describeAiFailure } from '@/lib/aiErrors';
export function useRefine() {
  // Refining is chapter-local: the preceding context is this chapter's prose.
  const { content, setShadowSuggestion, setIsRefining } = useEditorStore();
  const refine = useCallback(
    async (
      selectedText: string,
      instruction: string,
      from: number,
      to: number,
      /** Undefined means "let the router decide". */
      tier?: AiTier
    ) => {
      setIsRefining(true);
      try {
        const precedingContext = extractPrecedingContext(content, from);
        const response = await refineText({ selectedText, instruction, precedingContext }, tier);
        if (response.route) useRouteStore.getState().noteRoute('refine', response.route);
        setShadowSuggestion({
          id: generateId(),
          originalText: selectedText,
          suggestedText: response.refinedText,
          instruction,
          position: { from, to },
          status: 'pending',
        });
      } catch (error) {
        console.error('Refine error:', error);
        throw error;
      } finally {
        setIsRefining(false);
      }
    },
    [content, setShadowSuggestion, setIsRefining]
  );
  return { refine };
}
const MAX_CONTEXT_MESSAGES = 40;
function buildApiMessages(messages: ChatMessage[]) {
  const window = messages.filter((m) => m.content.trim().length > 0).slice(-MAX_CONTEXT_MESSAGES);
  while (window.length > 0 && window[0].role !== 'user') window.shift();
  return window.map((m) => ({ role: m.role, content: m.content }));
}
/**
 * Fetch the novel's prose and fold in the live editor buffer for the open
 * chapter. Read-only: no forced save, and the autosave lands regardless.
 *
 * `scope` decides how much of it is actually sent.
 */
async function resolveManuscriptContext(
  novelId: string,
  scope: ChatContextScope
): Promise<string | undefined> {
  if (scope === 'none') return undefined;
  try {
    const chapters = await novelsService.fetchManuscript(novelId);
    const novel = useLibraryStore.getState().novels.find((n) => n.id === novelId);
    const title = novel?.title ?? 'Untitled Novel';
    const { chapterId, content } = useEditorStore.getState();

    // "This chapter" with no chapter open would send nothing at all; the
    // outline is the closest honest substitute.
    if (scope === 'chapter' && !chapterId) {
      return buildOutlineContext(title, chapters, null) || undefined;
    }

    return buildScopedContext(
      scope,
      title,
      chapters,
      chapterId,
      chapterId ? content : undefined
    );
  } catch (error) {
    console.error('Could not load the manuscript for chat context:', error);
    return undefined;
  }
}
export function useChat() {
  const sendMessage = useCallback(async (
    userMessage: string,
    scopeOverride?: ChatContextScope,
    /** Undefined means "let the router decide". */
    tier?: AiTier
  ) => {
    const scope = scopeOverride ?? useChatContextStore.getState().scope;
    const { addMessage, updateMessageContent, persistMessage, setIsLoading } = useChatStore.getState();
    // Pin the conversation to the novel that was active at send time.
    const novelId = useChatStore.getState().activeNovelId;
    const selectedEntries = useCodexStore.getState().getSelectedEntries();
    const codexContext = selectedEntries.length > 0 ? buildCodexContext(selectedEntries) : undefined;
    const codexRefs = selectedEntries.map(({ id, name, type }) => ({ id, name, type }));
    const userMsg = addMessage('user', userMessage, codexRefs);
    setIsLoading(true);
    void persistMessage(userMsg, novelId);
    const apiMessages = buildApiMessages(useChatStore.getState().messages);
    const assistantMsg = addMessage('assistant', '');
    let fullResponse = '';
    try {
      const manuscriptContext = novelId
        ? await resolveManuscriptContext(novelId, scope)
        : undefined;
      for await (const event of streamChatMessage(apiMessages, manuscriptContext, codexContext, {
        contextScope: scope,
        tier,
      })) {
        if (event.type === 'route') {
          useRouteStore.getState().noteRoute('chat', event.route, assistantMsg.id);
          continue;
        }
        fullResponse += event.text;
        updateMessageContent(assistantMsg.id, fullResponse, novelId);
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Say *what* went wrong — no key, Ollama not running, model not pulled —
      // so the author can fix it instead of retrying blindly.
      const explanation = describeAiFailure(error);
      fullResponse = fullResponse
        ? `${fullResponse}\n\n_(Interrupted: ${explanation})_`
        : `⚠️ ${explanation}`;
      updateMessageContent(assistantMsg.id, fullResponse, novelId);
    } finally {
      setIsLoading(false);
      void persistMessage({ ...assistantMsg, content: fullResponse }, novelId);
    }
  }, []);
  return { sendMessage };
}
