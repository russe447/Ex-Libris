// src/components/sidebar/Sidebar.tsx
import {
  PanelRightClose,
  PanelRight,
  MessageSquare,
  Library,
  Settings,
  BookMarked,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChatPanel } from './ChatPanel';
import { LibraryPanel } from './LibraryPanel';
import { CodexPanel } from './CodexPanel';
import { SearchPanel } from './SearchPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { useWorkspaceStore, type SidebarTab } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

export function Sidebar() {
  // Open/closed lives in the workspace store so it survives a reload — and so
  // Focus view can hide the sidebar without forgetting your preference.
  const isOpen = useWorkspaceStore((state) => state.isSidebarOpen);
  const setIsOpen = useWorkspaceStore((state) => state.setSidebarOpen);
  // The tab lives in the store too, so Ctrl+F can open Search directly.
  const activeTab: SidebarTab = useWorkspaceStore((state) => state.sidebarTab);
  const setActiveTab = useWorkspaceStore((state) => state.setSidebarTab);

  return (
    <>
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="fixed right-4 top-4 z-50"
        >
          <PanelRight className="h-5 w-5" />
        </Button>
      )}

      <aside
        className={cn(
          'h-full bg-academia-bg-secondary border-l border-academia-border transition-all duration-300',
          isOpen ? 'w-96' : 'w-0 overflow-hidden'
        )}
      >
        <div className="flex h-full">
          <div className="w-12 bg-academia-bg-primary border-r border-academia-border flex flex-col items-center py-4 gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('chat')}
              className={cn(
                'h-10 w-10',
                activeTab === 'chat' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Chat"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('codex')}
              className={cn(
                'h-10 w-10',
                activeTab === 'codex' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Codex"
            >
              <BookMarked className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('search')}
              className={cn(
                'h-10 w-10',
                activeTab === 'search' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Search this novel (Ctrl/Cmd+F)"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('library')}
              className={cn(
                'h-10 w-10',
                activeTab === 'library' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Library"
            >
              <Library className="h-5 w-5" />
            </Button>

            <div className="flex-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('settings')}
              className={cn(
                'h-10 w-10',
                activeTab === 'settings' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-10 w-10"
              title="Close sidebar"
            >
              <PanelRightClose className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && <ChatPanel />}

            {activeTab === 'codex' && <CodexPanel />}
            
            {activeTab === 'search' && <SearchPanel />}

            {activeTab === 'library' && <LibraryPanel />}

            {activeTab === 'settings' && <SettingsPanel />}
          </div>
        </div>
      </aside>
    </>
  );
}
