// src/components/editor/SplitResizer.tsx
//
// The draggable divider between the writing pane and the split pane. While
// dragging, the ratio updates live in the workspace store's memory; it's a
// persisted store, so the final width survives reloads. Writes are cheap
// (zustand persists per set), but we still only set on actual movement.

import { useRef } from 'react';
import { useWorkspaceStore, clampSplitRatio } from '@/stores/workspaceStore';

export function SplitResizer() {
  const dragState = useRef<{ pointerId: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragState.current = { pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Ratio = the split (right) pane's share of the row.
    const ratio = clampSplitRatio((rect.right - event.clientX) / rect.width);
    if (ratio !== useWorkspaceStore.getState().splitRatio) {
      useWorkspaceStore.getState().setSplitRatio(ratio);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize the panes"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group relative shrink-0 w-3 cursor-col-resize flex items-center justify-center touch-none"
    >
      <div className="w-px h-full bg-academia-border group-hover:bg-academia-accent/60 group-active:bg-academia-accent transition-colors" />
    </div>
  );
}
