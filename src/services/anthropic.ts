import { RefineRequest, RefineResponse, ChatMessage } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function refineText(request: RefineRequest): Promise<RefineResponse> {
  const response = await fetch(`${API_URL}/api/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to refine text');
  }

  return response.json();
}

export async function sendChatMessage(
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[],
  documentContext?: string
): Promise<string> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      documentContext,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const data = await response.json();
  return data.message;
}

export async function* streamChatMessage(
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[],
  documentContext?: string
): AsyncGenerator<string> {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      documentContext,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to stream message');
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            yield parsed.text;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}