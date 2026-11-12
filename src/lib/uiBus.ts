// src/lib/uiBus.ts
//
// A very small window-scoped command bus for the handful of UI surfaces that
// live in component state rather than a store (the Export dialog, the AI
// settings dialog, the TipTap instance). The desktop menu dispatches into it;
// in the browser nothing emits, so it's inert.
//
// One wrinkle: some targets are mounted on demand (sidebar panels, the header
// in Focus view). A command emitted a beat before its listener mounts would
// vanish, so the last command stays "sticky" for a moment and is delivered to
// the next matching subscriber.

export type UiCommand =
  | 'open-export'
  | 'open-ai-settings'
  | 'ai-test-connection'
  | 'open-snapshots'
  | 'editor-undo'
  | 'editor-redo';

const EVENT = 'exlibris:ui-command';
const STICKY_MS = 1000;

let pending: { command: UiCommand; at: number } | null = null;

export function emitUiCommand(command: UiCommand): void {
  pending = { command, at: Date.now() };
  window.dispatchEvent(new CustomEvent<UiCommand>(EVENT, { detail: command }));
}

/** Subscribe to one command. Returns an unsubscribe function. */
export function onUiCommand(command: UiCommand, handler: () => void): () => void {
  // Catch a just-missed command from a component that was still mounting.
  if (pending && pending.command === command && Date.now() - pending.at < STICKY_MS) {
    pending = null;
    // After the current render commit, never during it.
    setTimeout(handler, 0);
  }
  const listener = (event: Event) => {
    if ((event as CustomEvent<UiCommand>).detail !== command) return;
    pending = null;
    handler();
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
