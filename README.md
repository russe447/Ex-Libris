<!-- README.md -->
# Ex Libris

A distraction-free, AI-powered writing application designed for novelists and creative writers. Ex Libris combines a beautiful, minimalist writing environment with intelligent AI assistance powered by Claude (Anthropic) to help you refine your prose, develop ideas, and bring your stories to life.

## Features

### ✍️ Rich Text Editor
- **TipTap-powered editor** with full formatting capabilities
- **Multiple aesthetic themes** with carefully crafted typography and color palettes
- **Distraction-free interface** focused on your writing
- Support for headings, bold, italic, underline, text alignment, and more
- Real-time word count tracking

### 📄 Document Management
- **Multiple documents** — create, switch, rename, and delete manuscripts from the sidebar
- **SQLite persistence** — document content is stored server-side and survives refresh
- **Debounced autosave** — changes save automatically after you stop typing
- **Last-active document** — the app restores your previous document on reload via `localStorage`

### 🤖 AI-Powered Refinement
- **Floating Refine Menu**: Select any text and get AI-powered suggestions for improvement
- **Quick Actions**: One-click refinements like "More detail", "Tighten", "Vary rhythm", and "Stronger verbs"
- **Custom Instructions**: Provide your own specific refinement requests
- **Context-Aware**: AI understands the preceding context of your document for better suggestions
- **Shadow suggestions**: Accept or reject AI refinements inline before they replace your text

### 💬 Creative Collaboration
- **Sidebar Chat**: Interactive AI assistant for brainstorming, plot development, and creative ideation
- **Document Context**: The AI has access to your full document for contextually relevant suggestions
- **Codex Context**: Attach selected people, places, items, and events from the Codex to a chat turn
- **Streaming Responses**: Real-time streaming for natural conversation flow
- **Per-document chat history**: Every manuscript keeps its own conversation, persisted to SQLite
- **Automatic switching**: Opening a document loads its chat; deleting one removes its history
- **Durable context**: Conversations survive refresh; the last 40 turns are sent back to Claude for context

### 🏷️ Chapter Metadata & Filtering
- Every chapter carries a **status** (Idea / Draft / Revised / Complete), a **POV character**, free-form **tags**, and an optional **card colour**
- Edited from a small popover on each corkboard card — every control saves immediately (optimistic, rolled back on failure); POV suggests names already used plus the Codex's people; tags are deduped case-insensitively
- **Filter chapters** by status, POV, and tags — in the Corkboard *and* the sidebar chapter list (one shared filter). Within a facet selections are OR'd, across facets AND'd
- **Filtering changes visibility only.** Cards and rows keep their real position numbers, the saved order is never touched, and drag-reordering is paused while a filter is active (reordering a partial view would corrupt what it can't see). Great for reading one POV's thread in sequence

### 🗂️ Corkboard
- **Index cards** for every chapter: title, position, word count, and an **editable synopsis** (click to edit, saved on blur)
- **Drag and drop** to rearrange, with two explicit modes:
  - **Manuscript order** — dragging a card reorders the actual chapters (same as the Outline)
  - **Planning order** — a corkboard-only arrangement, persisted per novel server-side, that never touches the manuscript until you press **Apply to manuscript**
- Planning order reconciles automatically: deleted chapters drop off, new chapters append

### ⬅➡ Split Editor
- Open a second, **fully editable** chapter beside the one you're writing (toolbar button, or View ▸ Split Editor on desktop)
- Both panes **scroll independently** with independent cursors; drag the divider to resize (persisted)
- A different chapter gets its own buffer, autosave, and undo history
- **The same chapter in both panes is one document** (Scrivener-style): edits appear in the other pane instantly via ProseMirror step-forwarding, share **one undo stack**, and flow through the normal autosave — useful for editing two parts of a long chapter at once
- Undo/redo (keyboard or desktop menu) always target the pane you last touched

### 📸 Chapter Snapshots
- **Take a snapshot** of a chapter before a big edit (toolbar button, or `Ctrl/Cmd+Shift+T` in the desktop app) — optionally named, e.g. "Before rewrite"
- **Browse and read** previous versions at any time; rename or delete them freely
- **Compare**: word-level diff of any snapshot against the current text, live while you type
- **Restore safely**: restoring first writes an automatic backup of the current text *in the same database transaction*, so no restore can destroy work; the editor buffer is flushed before either operation so snapshots always match what's on screen
- Snapshots live outside the autosave path entirely and are removed with their chapter

### 📖 Story Codex
- **Per-document worldbuilding**: People, places, items, events, organizations, and other notes
- **Type-specific fields**: Each entry type has relevant inputs (e.g. personality for people, atmosphere for places)
- **Chat attachment**: Select entries in the Codex tab or Chat picker; selection sticks across sends
- **Cascade cleanup**: Deleting a document removes its Codex alongside its chat history

### 🎨 Beautiful Design
- **Multiple Color Themes**: Choose from a variety of carefully crafted themes including Dark Academia, Sepia Manuscript, Midnight Writer, and more
- **Quick Theme Switcher**: Easily switch themes from the header with live preview of color swatches
- **Custom Typography**: Theme-specific fonts for a unique literary feel per theme
- **Smooth Animations**: Polished UI transitions and interactions
- **Responsive Layout**: Adapts beautifully to different screen sizes

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Editor**: TipTap (ProseMirror-based)
- **Styling**: Tailwind CSS with dynamic theming (CSS variables)
- **State Management**: Zustand
- **UI Primitives**: Radix UI (dialog, popover, scroll area, etc.)
- **Backend**: Express.js
- **Database**: SQLite via better-sqlite3
- **AI**: Anthropic Claude API (Claude Sonnet 4)
- **Desktop shell**: Electron + electron-builder (the same UI and server, wrapped in one window)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- An AI backend — either an Anthropic API key ([get one here](https://console.anthropic.com/settings/keys)) **or** a local [Ollama](https://ollama.com) install. See [AI providers](#ai-providers) below.

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ex-libris
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)

   Create a `.env` file in the root directory:
   ```env
   # Optional — you can set the key in-app instead (Settings → AI provider)
   ANTHROPIC_API_KEY=your_api_key_here
   PORT=3001
   ```

   For the frontend, create a `.env` file or set:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This starts both the frontend (Vite) and backend (Express) servers concurrently.

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

4. **Choose your AI provider**

   Open the app, go to the sidebar's **Settings** tab → **Configure provider**, and either
   paste an Anthropic key or point Ex Libris at Ollama. No restart needed.

## Desktop app (Electron)

Ex Libris also runs as a standalone desktop app. The Electron shell is
deliberately thin: one window that starts the existing Express server on a
free loopback port, loads the built UI from it (same origin, no CORS), and
shuts both down when the window closes. The React app and API are byte-for-byte
the same code the browser version uses.

### Native menu

The desktop app has a native application menu (File / Edit / View / Novel /
AI / Help). It owns nothing: every item sends an action id to the renderer
over a small preload bridge (`electron/menu.cjs` → `electron/preload.cjs` →
`src/lib/desktopMenu.ts`), which calls the same store actions the in-app
buttons use. The renderer pushes a tiny state snapshot back so the menu can
enable/check the right items (active view, theme, chapter position). Edit ▸
Undo/Redo are routed to TipTap's own history when the editor has focus and
fall back to native behaviour in ordinary inputs; Help ▸ About and Keyboard
Shortcuts are native message boxes handled entirely in the main process. In
the browser none of this exists and nothing changes.

Menu accelerators consume keystrokes before the page sees them, so they are
chosen to never shadow the editor's own bindings (bold/italic/underline,
inline code, blockquote, alignment, headings…) or OS-level keys like AltGr
combos and GNOME's `Ctrl+Alt+arrows`. Highlights: `Ctrl/Cmd+Shift+N` new
novel, `Ctrl/Cmd+N` new chapter, `Ctrl/Cmd+P` export, `Ctrl/Cmd+F` find,
`Ctrl/Cmd+1/2/3/4` Manuscript / Outline / Focus / Corkboard, `Ctrl/Cmd+Shift+\` sidebar,
`Ctrl+PgUp/PgDn` (macOS: `Cmd+Alt+←/→`) previous/next chapter,
`Ctrl/Cmd+Shift+K` Codex, `Ctrl/Cmd+,` AI settings. The full list lives under
Help ▸ Keyboard Shortcuts.

Two bits of desktop polish: exports always go through a native save dialog
(suggested filename intact, starting in your Downloads folder), and in packaged
mode the served UI carries a strict Content-Security-Policy (scripts are
`'self'`-only; Google Fonts is the lone remote allowance). API rate limiting
applies only to the AI-facing routes (`/api/chat*`, `/api/refine`, connection
tests) — local library CRUD and static assets are never throttled.

### Where your data lives

Both the browser and desktop versions keep the SQLite database and the `.secret`
encryption key in a per-user app data directory — **not** in the repo:

| Platform | Location |
| --- | --- |
| Windows | `%APPDATA%\Ex Libris\` |
| macOS | `~/Library/Application Support/Ex Libris/` |
| Linux | `~/.config/Ex Libris/` (respects `$XDG_CONFIG_HOME`) |

Set `EXLIBRIS_DATA_DIR` to override. On first run, an existing repo-era
`server/exlibris.db` and `server/.secret` are copied there automatically, so
nothing is lost upgrading; the repo copies are then ignored and safe to delete.
Because dev and desktop resolve the same directory, they share one library.

### Desktop development

```bash
npm run dev:desktop
```

This runs the same Vite + Express pair as `npm run dev`, then opens an Electron
window pointed at the Vite dev server once both are up. Hot reload works as
usual; closing the window stops everything. (`npm run dev` in the browser keeps
working exactly as before.)

### Building installers

```bash
npm run dist       # installers for the current platform, into release/
npm run dist:dir   # unpacked app, for a quick smoke test
```

- Windows → NSIS installer, macOS → DMG + zip, Linux → AppImage + deb.
- `electron-builder` rebuilds `better-sqlite3` against Electron's ABI for the
  packaged app; the `postdist` script rebuilds it back for plain Node so
  `npm run dev` keeps working. If a failed build ever leaves the dev server
  complaining about a native-module version mismatch, run `npm run rebuild:node`.
- To run the production build locally without packaging: `npm run start:desktop`.

Code signing, auto-update, and a native application menu are intentionally out
of scope for now — the builds are unsigned local installers.

## AI providers

Chat and Refine both run through whichever provider is selected in
**Settings → AI provider**. The choice is stored server-side, so it survives
restarts and is the same in every browser that talks to your server.

### Option A — Anthropic (Claude)

1. Create a key at <https://console.anthropic.com/settings/keys>.
2. In Ex Libris: **Settings → Configure provider → Anthropic**, paste the key, press **Save**.
3. Press **Test connection**. A green line means the key works.

**How the key is stored.** It is POSTed once to your local Express server and
written to SQLite encrypted with AES-256-GCM. The encryption key lives in
`.secret` inside the app data directory (see
[Where your data lives](#where-your-data-lives)), created on first run with
mode `0600`. The
browser never receives the key back — the Settings panel only shows a mask like
`sk-ant-…9f2a`, and nothing is written to `localStorage`. Deleting the key from
Settings removes the row; if `ANTHROPIC_API_KEY` is still set in the
environment, Ex Libris falls back to it and labels it as coming from the
environment.

> This protects against casual disclosure — a copied database file, a synced
> backup, another user poking at devtools. It is not protection against someone
> who already has read access to both `exlibris.db` and `.secret`; that
> is the same trust boundary as the environment variable it replaces.

### Option B — Ollama (local models)

Everything stays on your machine: no key, no network, no per-token cost. Expect
slower generation and a smaller usable context than Claude.

**1. Install Ollama**

- **macOS**: `brew install ollama` — or download the app from <https://ollama.com/download>.
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows**: download the installer from <https://ollama.com/download>, or use WSL2 and the Linux instructions.

**2. Start the daemon**

The macOS and Windows apps start it for you (look for the menu-bar/tray icon).
Otherwise run it yourself:

```bash
ollama serve
```

On Linux the installer usually registers a systemd service instead:

```bash
sudo systemctl enable --now ollama
```

Confirm it's listening — this should return JSON, not a connection error:

```bash
curl http://127.0.0.1:11434/api/tags
```

**3. Pull a model**

```bash
# Good general-purpose starting points (≈5 GB each, needs ~8 GB RAM)
ollama pull llama3.1:8b
ollama pull mistral:7b

# Smaller/faster, for 8 GB machines (≈2 GB)
ollama pull llama3.2:3b

# Larger, noticeably better prose (≈20 GB, needs ~32 GB RAM or a big GPU)
ollama pull mixtral:8x7b
```

Rough guide: the model file must fit in RAM (or VRAM) with room to spare. A 7–8B
model at the default 4-bit quantisation needs about 8 GB of system memory; 70B
models need a workstation.

Check what you have:

```bash
ollama list
```

**4. Point Ex Libris at it**

**Settings → Configure provider → Ollama**. The dialog lists every model
`ollama list` would show, with parameter count and size. Click one to select it,
then press **Test connection**.

The default server URL is `http://127.0.0.1:11434`. Change it if:

- Ollama runs on another machine — use `http://<host>:11434`, and start that
  daemon with `OLLAMA_HOST=0.0.0.0 ollama serve` so it accepts remote connections.
- You set a custom port via `OLLAMA_HOST=127.0.0.1:<port>`.

Note that the Ex Libris **server** makes this connection, not your browser, so
the URL must be reachable from wherever `npm run dev:server` is running. There
are no CORS considerations.

**5. Context length (important for "Full novel" chats)**

Ollama defaults to a small context window (commonly 4k tokens), and silently
truncates anything longer — which, with "Full novel" context selected, means the
model quietly stops seeing your earlier chapters. Either keep the chat context
scope on **This chapter** / **Outline only**, or raise the window by creating a
variant model:

```bash
cat > Modelfile <<'EOM'
FROM llama3.1:8b
PARAMETER num_ctx 16384
EOM
ollama create llama3.1-16k -f Modelfile
```

Then pick `llama3.1-16k` in Settings. Larger windows use more RAM.

## Model tiers and the auto-router

Every generation request is graded into one of three **tiers**, and each
provider maps its own models onto them. Nothing in the codebase names a model
directly — `server/router.js` grades the job, `server/settings.js` holds the
assignments, and the providers just execute.

| Tier | Used for | Typical Claude | Typical Ollama |
| --- | --- | --- | --- |
| **Quick** | Short inline refines, light chat with little context | Haiku | a 3B model |
| **Default** | Ordinary chat, typical refines | Sonnet | a 7–8B model |
| **Deep** | Full-novel or outline context, long selections, explicit requests | Opus | the biggest model that fits |

### How automatic routing decides

With routing set to **Automatic** (the default), per request:

- **Deep** if the chat context scope is *Full novel* or *Outline only*; or the
  assembled context exceeds ~12,000 characters; or a refine selection exceeds
  ~1,500 characters; or the message is very long; or your own words ask for it
  (“think hard”, “in depth”, “strongest model”, “line edit”, …).
- **Quick** if the context is small (≤ ~2,500 chars) *and* it's either a short
  refine selection (≤ ~280 chars) or a short question (≤ ~200 chars).
- **Default** otherwise.

Thresholds live at the top of `server/router.js` if you want to retune them.

You can override routing in three places:

- **Settings → Routing** — *Automatic*, or pin everything to one tier.
- **Chat composer** — the *Auto model* pill pins this conversation to a tier.
- **Refine popover** — per-refine tier buttons.

Each assistant reply shows which tier and model answered, and hovering it
explains why the router chose that tier.

### Assigning models

**Settings → Configure provider** has a Quick/Default/Deep row per provider.
Claude tiers choose from the built-in catalogue of current model IDs (Haiku 4.5
and 3.5, Sonnet 4.5 / 4 / 3.7, Opus 4.1 / 4). Ollama tiers choose from what
`ollama list` reports — so you can run a 3B for Quick and a 47B MoE for Deep.
Assignments are stored per provider and persist across restarts; **Test a tier**
exercises each one individually.

If a tier has no model assigned, the router falls back to a neighbouring tier
and says so (`substituted`). If *nothing* is assigned, or an assigned Ollama
model isn't pulled, the request fails with the usual clear error rather than
silently using something else.

### When something goes wrong

Failures are reported, never swallowed — the message appears inline in the chat
thread or the Refine popover, and the Settings dialog shows the same detail:

| What you'll see | What it means | Fix |
| --- | --- | --- |
| *Could not reach Ollama at …* | The daemon isn't running, or the URL is wrong | `ollama serve`, or correct the URL |
| *Ollama doesn't have the model "X"* | A tier points at a model that was never pulled, or was removed | `ollama pull X`, or reassign that tier |
| *No model is assigned to the … tier* | That tier is empty and no fallback exists | Assign one in Settings → AI provider |
| *Ollama is running but has no models installed* | Fresh install | `ollama pull llama3.1:8b` |
| *Ollama did not respond in time* / *stopped sending output* | Model is loading, out of memory, or wedged | Retry, pick a smaller model, or check `ollama ps` |
| *No Anthropic API key is configured* | Neither Settings nor the environment has a key | Add one in Settings, or switch to Ollama |
| *Anthropic rejected the API key* | Key is wrong, revoked, or out of credit | Re-paste the key; check the console |
| *Could not reach the Ex Libris server* | The Express process is down | `npm run dev:server` |

Every provider call is bounded by a timeout (4s to list models, 30s for the
first response, 120s between streamed tokens), so a wedged daemon surfaces as a
clear error instead of a spinner that never stops.

### Development Scripts### Development Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run dev:client` - Start only the Vite dev server
- `npm run dev:server` - Start only the Express server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
ex-libris/
├── index.html                 # Vite HTML entry point
├── package.json
├── vite.config.ts             # Vite config (@ path alias → src/)
├── tailwind.config.js         # Tailwind + academia CSS variable tokens
├── postcss.config.js
├── tsconfig.json              # TypeScript project references
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── public/
│   └── favicon.svg
├── electron/                  # Desktop shell (thin Electron wrapper)
│   ├── main.cjs               # Window + embedded server lifecycle
│   └── preload.cjs            # Minimal, context-isolated bridge
├── server/                    # Express backend
│   ├── index.js               # API routes (documents + AI)
│   ├── database.js            # SQLite setup and schema
│   └── paths.js               # App data directory (db + .secret live there)
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Root component (ThemeProvider → AppLayout)
│   ├── index.css              # Global styles
│   ├── App.css
│   ├── vite-env.d.ts
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── editor/            # TipTap editor and AI refine UI
│   │   │   ├── Editor.tsx
│   │   │   ├── EditorToolbar.tsx
│   │   │   ├── FloatingRefineMenu.tsx
│   │   │   └── ShadowSuggestion.tsx
│   │   ├── layout/
│   │   │   └── AppLayout.tsx  # Header, word count, editable title
│   │   ├── settings/
│   │   │   └── ThemeSelector.tsx
│   │   ├── sidebar/           # Right sidebar panels
│   │   │   ├── Sidebar.tsx    # Tab navigation (chat, codex, documents, settings)
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── CodexPanel.tsx
│   │   │   └── DocumentsPanel.tsx
│   │   ├── theme/
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── QuickThemeSwitcher.tsx
│   │   └── ui/                # Reusable UI primitives
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Textarea.tsx
│   ├── hooks/
│   │   └── useAnthropic.ts    # useRefine + useChat hooks
│   ├── lib/
│   │   ├── utils.ts           # cn(), generateId(), countWords(), etc.
│   │   ├── themes.ts          # Theme color/font definitions
│   │   └── codex.ts           # Codex type schema + prompt formatting
│   ├── services/              # Frontend API clients
│   │   ├── documents.ts       # Document CRUD
│   │   ├── chat.ts            # Per-document chat message CRUD
│   │   ├── codex.ts           # Per-document codex entry CRUD
│   │   └── anthropic.ts       # Refine + chat/stream requests
│   ├── stores/                # Zustand state
│   │   ├── documentStore.ts   # Active document, autosave, shadow suggestions
│   │   ├── chatStore.ts       # Sidebar chat messages (scoped to active document)
│   │   ├── codexStore.ts      # Codex entries + chat selection
│   │   └── themeStore.ts      # Active theme (persisted)
│   └── types/
│       └── index.ts           # Shared TypeScript interfaces
├── A/                         # Standalone copy of the project (agent comparison)
└── B/                         # Standalone copy of the project (agent comparison)
```

### Key architectural notes

- **Document flow**: `Editor` ↔ `documentStore` ↔ `documents.ts` ↔ `server/index.js` ↔ SQLite
- **Chat flow**: `ChatPanel` ↔ `useChat` ↔ `anthropic.ts` ↔ `/api/chat/stream` for generation;
  `chatStore` ↔ `chat.ts` ↔ `/api/documents/:id/messages` ↔ SQLite for persistence.
  `documentStore` calls `chatStore.setActiveDocument(id)` whenever the active document changes.
- **Codex flow**: `CodexPanel` ↔ `codexStore` ↔ `codex.ts` ↔ `/api/documents/:id/codex` ↔ SQLite.
  Selected entries are formatted client-side into `codexContext` and appended to the chat system prompt.
  User messages store a `{id, name, type}` snapshot so history chips survive renames/deletes.
- **Refine flow**: `FloatingRefineMenu` ↔ `useRefine` ↔ `anthropic.ts` ↔ `/api/refine`
- **Theming**: `themeStore` → `ThemeProvider` sets CSS variables consumed by Tailwind `academia-*` classes

## Usage

### Writing

Simply start typing in the editor. Your content is automatically saved to SQLite when a document is active. The editor supports standard formatting shortcuts and a toolbar for styling.

### Managing Documents

1. Open the **sidebar** and switch to the **Documents** tab
2. Click **New** to create a document, or click an existing document to load it
3. Rename documents inline from the list or from the header title
4. Delete documents with the trash icon (with confirmation)

### Building a Codex

1. Open a document, then switch to the **Codex** tab
2. Click **New**, pick a type (Person, Place, Item, Event, …), and name the entry
3. Expand an entry to fill type-specific fields, then Save
4. Click the message icon on an entry to include it in chat context (sticky until cleared)

### Refining Text

1. **Select any text** in the editor
2. A **sparkle icon** (✨) will appear near your selection
3. Click it to open the **Refine Menu**
4. Choose a quick action or enter a custom instruction
5. Review the shadow suggestion, then **Accept** or **Reject**

### Using the Chat Assistant

1. Open the **sidebar** (right side of the screen)
2. Navigate to the **Chat** tab
3. Ask questions about your story, request brainstorming help, or discuss plot points
4. Toggle **document context** to include or exclude the current manuscript from the AI prompt
5. Use the **Codex** pill to attach selected worldbuilding entries to the next message
6. Conversations are saved per document — switching manuscripts swaps the chat, and the trash icon clears only the current document's history

## API Endpoints

### Documents

- `GET /api/documents` — List all documents (metadata only)
- `GET /api/documents/:id` — Get a single document with content
- `POST /api/documents` — Create a new document
- `PUT /api/documents/:id` — Update a document
- `DELETE /api/documents/:id` — Delete a document (and its chat + codex)

### Chat history

- `GET /api/documents/:id/messages` — List a document's chat history (chronological)
- `POST /api/documents/:id/messages` — Create/upsert a chat message (optional `contextEntries` snapshot)
- `DELETE /api/documents/:id/messages` — Clear a document's conversation

### Codex

- `GET /api/documents/:id/codex` — List a document's codex entries
- `POST /api/documents/:id/codex` — Create a codex entry
- `PUT /api/documents/:id/codex/:entryId` — Update a codex entry
- `DELETE /api/documents/:id/codex/:entryId` — Delete a codex entry

### AI

- `POST /api/refine` — Refine selected text with AI
- `POST /api/chat` — Send a chat message (non-streaming; optional `codexContext`)
- `POST /api/chat/stream` — Send a chat message (streaming; optional `codexContext`)

## Configuration

### Choosing a Theme

Ex Libris comes with multiple built-in themes. Click the palette icon in the header to switch between them:

- **Dark Academia** - Elegant dark tones inspired by classic literature
- **Sepia Manuscript** - Warm, aged paper aesthetic
- **Midnight Writer** - Deep blues for late-night writing sessions
- **Forest Study** - Earthy greens for a natural feel
- **Vintage Typewriter** - Classic monochrome typewriter aesthetic
- And more...

Your theme preference is automatically saved and persists across sessions.

### Customizing Themes

Theme definitions are located in `src/lib/themes.ts`. Each theme includes:
- Color palette (backgrounds, text, accents, borders)
- Typography (display, serif, and monospace fonts)

The base Tailwind configuration in `tailwind.config.js` uses CSS variables that are dynamically updated by the ThemeProvider.

### AI Model

The application uses Claude Sonnet 4 by default. You can change the model in `server/index.js`:

```javascript
model: 'claude-sonnet-4-20250514'
```

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

Private project - All rights reserved.

## Acknowledgments

- Built with [TipTap](https://tiptap.dev/) for the rich text editor
- Powered by [Anthropic Claude](https://www.anthropic.com/) for AI capabilities
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)

---

**Ex Libris** - Where stories come to life, one word at a time.
