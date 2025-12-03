import { useCallback } from 'react';
import { refineText, streamChatMessage } from '@/services/anthropic';
import { useDocumentStore } from '@/stores/documentStore';
import { useChatStore } from '@/stores/chatStore';
import { generateId, extractPrecedingContext } from '@/lib/utils';

export function useRefine() {
  const { content, setShadowSuggestion, setIsRefining } = useDocumentStore();

  const refine = useCallback(
    async (
      selectedText: string,
      instruction: string,
      from: number,
      to: number
    ) => {
      setIsRefining(true);

      try {
        const precedingContext = extractPrecedingContext(content, from);

        const response = await refineText({
          selectedText,
          instruction,
          precedingContext,
        });

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

export function useChat() {
  const { messages, addMessage, updateLastAssistantMessage, setIsLoading } =
    useChatStore();
  const { content } = useDocumentStore();

  const sendMessage = useCallback(
    async (userMessage: string, includeDocumentContext = true) => {
      addMessage('user', userMessage);
      setIsLoading(true);

      try {
        const chatMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: userMessage },
        ];

        const documentContext = includeDocumentContext ? content : undefined;

        addMessage('assistant', '');
        let fullResponse = '';

        for await (const chunk of streamChatMessage(chatMessages, documentContext)) {
          fullResponse += chunk;
          updateLastAssistantMessage(fullResponse);
        }
      } catch (error) {
        console.error('Chat error:', error);
        updateLastAssistantMessage('Sorry, I encountered an error. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, content, addMessage, updateLastAssistantMessage, setIsLoading]
  );

  return { sendMessage };
}