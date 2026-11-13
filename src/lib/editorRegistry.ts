// src/lib/editorRegistry.ts
//
// Who is the primary editor, and which editor was touched last? With the split
// pane editable there can be up to two live TipTap instances, and several
// features need to aim at the right one:
//
//   - menu/uiBus Undo/Redo must hit the *focused* pane's history
//   - the mirror pane (same chapter in both panes) must find the primary
//     instance to pair with, and re-pair when it remounts
//
// Roles:
//   'primary'  the main writing pane (owns the chapter buffer + autosave)
//   'split'    the split pane showing a DIFFERENT chapter (own buffer+history)
//   'mirror'   the split pane showing the SAME chapter (no history of its own —
//              undo/redo are the primary's, so both panes share one stack)

import { create } from 'zustand';
import type { Editor } from '@tiptap/react';

export type EditorRole = 'primary' | 'split' | 'mirror';

interface EditorRegistryState {
  primary: Editor | null;
  /** Bumped per primary instance, so mirrors can key their remounts on it. */
  primaryGeneration: number;
}

export const useEditorRegistry = create<EditorRegistryState>(() => ({
  primary: null,
  primaryGeneration: 0,
}));

export function setPrimaryEditor(editor: Editor | null): void {
  useEditorRegistry.setState((state) => ({
    primary: editor,
    primaryGeneration: state.primaryGeneration + 1,
  }));
}

// Last-focused wins and is never cleared on blur: "undo" from the menu while a
// dialog has focus should still target the pane the author last typed in.
let focused: { editor: Editor; role: EditorRole } | null = null;

export function setFocusedEditor(editor: Editor, role: EditorRole): void {
  focused = { editor, role };
}

export function getFocusedEditor(): { editor: Editor; role: EditorRole } | null {
  if (focused && focused.editor.isDestroyed) focused = null;
  return focused;
}

/**
 * Apply undo/redo to the right history. The mirror pane has no history of its
 * own (by design — same document, one undo stack), so it defers to primary.
 */
export function routeHistory(command: 'undo' | 'redo'): void {
  const primary = useEditorRegistry.getState().primary;
  const current = getFocusedEditor();
  const target =
    !current || current.role === 'mirror' ? primary : current.editor;
  if (!target || target.isDestroyed) return;
  const chain = target.chain().focus();
  (command === 'undo' ? chain.undo() : chain.redo()).run();
}
