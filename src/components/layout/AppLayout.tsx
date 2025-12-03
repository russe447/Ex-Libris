import { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { useDocumentStore } from '@/stores/documentStore';

interface AppLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
}

export function AppLayout({ children, sidebar }: AppLayoutProps) {
  const { title, wordCount } = useDocumentStore();

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
          <span className="text-sm text-academia-text-secondary">
            {title}
          </span>
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