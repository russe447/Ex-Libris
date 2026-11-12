// src/services/chat.ts
import { ChatMessage, CodexEntryRef } from '@/types';
import { API_URL } from '@/services/apiBase';

interface ApiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  contextEntries?: CodexEntryRef[] | null;
}

function toChatMessage(message: ApiChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
    ...(message.contextEntries && message.contextEntries.length > 0
      ? { codexEntries: message.contextEntries }
      : {}),
  };
}

export async function fetchMessages(novelId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/messages`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Novel not found');
    }
    throw new Error('Failed to fetch chat messages');
  }
  const data: ApiChatMessage[] = await response.json();
  return data.map(toChatMessage);
}

/**
 * Create or update a message. The server upserts on `id`, so calling this
 * again with the same id (e.g. to finalize a streamed assistant reply)
 * simply updates the stored content.
 */
export async function saveMessage(
  novelId: string,
  message: ChatMessage
): Promise<ChatMessage> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.timestamp.toISOString(),
      contextEntries: message.codexEntries,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to save chat message');
  }
  return toChatMessage(await response.json());
}

export async function clearMessages(novelId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/messages`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to clear chat messages');
  }
}
