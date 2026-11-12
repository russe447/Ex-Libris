/// <reference types="vite/client" />
// src/vite-env.d.ts

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

// Exposed by electron/preload.cjs when running inside the desktop shell.
// Absent in the browser — always check before use.
interface Window {
  exlibrisDesktop?: {
    isDesktop: true
    platform: string
    electronVersion: string
    /** Native menu → app. Returns an unsubscribe function. */
    onMenuAction?: (handler: (action: string) => void) => () => void
    /** App → native menu (enabled/checked state, theme list). */
    updateMenuState?: (state: unknown) => void
    /** Native undo/redo on the focused element (plain inputs, not TipTap). */
    nativeEdit?: (command: 'undo' | 'redo') => void
  }
}

