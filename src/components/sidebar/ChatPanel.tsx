import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ChatMessage } from './ChatMessage';
import { useChatStore } from '@/stores/chatStore';
import { useChat } from '@/hooks/useAnthropic';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, clearMessages } = useChatStore();
  const { sendMessage } = useChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    await sendMessage(message, includeContext);
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
        <h2 className="font-display text-lg text-academia-text-primary">
          Writing Assistant
        </h2>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            className="h-8 w-8 text-academia-text-muted hover:text-academia-error"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <BookOpen className="h-12 w-12 text-academia-accent/30 mb-4" />
            <p className="text-academia-text-muted text-sm leading-relaxed">
              Ask me about your story, brainstorm ideas, or discuss your characters and plot.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-academia-border">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setIncludeContext(!includeContext)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              includeContext
                ? 'border-academia-accent/50 bg-academia-accent/10 text-academia-accent'
                : 'border-academia-border text-academia-text-muted'
            }`}
          >
            {includeContext ? '✓ Using document context' : 'Document context off'}
          </button>
        </div>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your story..."
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 self-end h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}