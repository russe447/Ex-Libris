import { PenLine, Focus, ListTree } from 'lucide-react';
import { useWorkspaceStore, WorkspaceView } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

const VIEWS: { id: WorkspaceView; label: string; hint: string; Icon: typeof PenLine }[] = [
  { id: 'write', label: 'Write', hint: 'Editor, chapters, and assistant together', Icon: PenLine },
  { id: 'focus', label: 'Focus', hint: 'The editor alone (Esc to leave)', Icon: Focus },
  { id: 'outline', label: 'Outline', hint: 'All chapters at a glance', Icon: ListTree },
];

/** Segmented control for the workspace view. Persisted via the workspace store. */
export function ViewSwitcher({ compact = false }: { compact?: boolean }) {
  const view = useWorkspaceStore((state) => state.view);
  const setView = useWorkspaceStore((state) => state.setView);

  return (
    <div
      role="tablist"
      aria-label="Workspace view"
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-academia-bg-tertiary border border-academia-border"
    >
      {VIEWS.map(({ id, label, hint, Icon }) => {
        const isActive = view === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setView(id)}
            title={`${label} — ${hint}`}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
              isActive
                ? 'bg-academia-bg-secondary text-academia-accent shadow-sm'
                : 'text-academia-text-muted hover:text-academia-text-primary'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className={cn(compact && 'sr-only')}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
