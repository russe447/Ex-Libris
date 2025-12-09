import { User, Sparkles } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg animate-fade-in',
        isUser ? 'bg-academia-bg-tertiary' : 'bg-transparent'
      )}
    >
      <div
        className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-academia-bg-elevated text-academia-text-secondary'
            : 'bg-academia-accent/20 text-academia-accent'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-academia-text-muted mb-1">
          {isUser ? 'You' : 'Ex Libris'}
        </div>
        <div className="text-sm text-academia-text-primary whitespace-pre-wrap leading-relaxed">
          {message.content || (
            <span className="inline-flex items-center gap-1 text-academia-text-muted">
              <span className="animate-pulse">Thinking</span>
              <span className="animate-pulse animation-delay-100">.</span>
              <span className="animate-pulse animation-delay-200">.</span>
              <span className="animate-pulse animation-delay-300">.</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}