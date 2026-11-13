// src/components/editor/EditorToolbar.tsx
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  History,
  Columns2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SnapshotsDialog } from './SnapshotsDialog';
import { openReferencePane } from '@/lib/splitEditor';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolItem {
  type?: 'separator';
  icon?: React.ComponentType<{ className?: string }>;
  action?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label?: string;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const isSplitOpen = useWorkspaceStore((state) => state.isSplitOpen);
  if (!editor) return null;

  const tools: ToolItem[] = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      label: 'Bold',
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      label: 'Italic',
    },
    {
      icon: Underline,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      label: 'Underline',
    },
    { type: 'separator' },
    {
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
      label: 'Heading 1',
    },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
      label: 'Heading 2',
    },
    {
      icon: Heading3,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
      label: 'Heading 3',
    },
    { type: 'separator' },
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
      label: 'Bullet List',
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
      label: 'Numbered List',
    },
    {
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
      label: 'Quote',
    },
    {
      icon: Minus,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
      label: 'Horizontal Rule',
    },
    { type: 'separator' },
    {
      icon: Undo,
      action: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().undo(),
      label: 'Undo',
    },
    {
      icon: Redo,
      action: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().redo(),
      label: 'Redo',
    },
  ];

  return (
    <div className="flex items-center gap-1 p-2 bg-academia-bg-secondary border-b border-academia-border rounded-t-lg">
      {tools.map((tool, index) => {
        if (tool.type === 'separator') {
          return (
            <div
              key={index}
              className="w-px h-6 bg-academia-border mx-1"
            />
          );
        }

        const Icon = tool.icon!;
        return (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              tool.action?.();
            }}
            disabled={tool.disabled}
            className={cn(
              'h-8 w-8',
              tool.isActive && 'bg-academia-bg-elevated text-academia-accent'
            )}
            title={tool.label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
      {/* Right-aligned: chapter-level tools rather than text formatting. */}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', isSplitOpen && 'bg-academia-bg-elevated text-academia-accent')}
          title="Split editor — open another chapter alongside, fully editable"
          onClick={() => {
            if (isSplitOpen) useWorkspaceStore.getState().closeSplit();
            else openReferencePane();
          }}
        >
          <Columns2 className="h-4 w-4" />
        </Button>
        <SnapshotsDialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Snapshots — saved versions of this chapter"
          >
            <History className="h-4 w-4" />
          </Button>
        </SnapshotsDialog>
      </div>
    </div>
  );
}
