// src/services/apiBase.ts
//
// One place that decides where the API lives.
//
// - Vite dev server (`npm run dev` / `npm run dev:desktop`): the API is a
//   separate Node process on port 3001.
// - Production build (the desktop app): the Express server serves this UI
//   itself from a dynamically chosen port, so relative URLs ('' + '/api/…')
//   always hit the right place with zero configuration and no CORS.
// - VITE_API_URL overrides either, for unusual setups.
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
