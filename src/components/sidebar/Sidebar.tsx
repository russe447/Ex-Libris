// src/components/Sidebar.tsx
import { useState } from 'react';
import { PanelRightClose, PanelRight, MessageSquare, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChatPanel } from './ChatPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { ThemeSelector } from '../settings/ThemeSelector';
import { cn } from '@/lib/utils';

type SidebarTab = 'chat' | 'documents' | 'settings';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

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
              onClick={() => setActiveTab('documents')}
              className={cn(
                'h-10 w-10',
                activeTab === 'documents' && 'bg-academia-bg-tertiary text-academia-accent'
              )}
              title="Documents"
            >
              <FileText className="h-5 w-5" />
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
            
            {activeTab === 'documents' && <DocumentsPanel />}

            {activeTab === 'settings' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-academia-border">
                  <h2 className="font-display text-lg text-academia-text-primary">
                    Settings
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <ThemeSelector />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
