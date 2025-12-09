# Ex Libris

A distraction-free, AI-powered writing application designed for novelists and creative writers. Ex Libris combines a beautiful, minimalist writing environment with intelligent AI assistance powered by Claude (Anthropic) to help you refine your prose, develop ideas, and bring your stories to life.

## Features

### ✍️ Rich Text Editor
- **TipTap-powered editor** with full formatting capabilities
- **Multiple aesthetic themes** with carefully crafted typography and color palettes
- **Distraction-free interface** focused on your writing
- Support for headings, bold, italic, underline, text alignment, and more
- Real-time word count tracking

### 🤖 AI-Powered Refinement
- **Floating Refine Menu**: Select any text and get AI-powered suggestions for improvement
- **Quick Actions**: One-click refinements like "More detail", "Tighten", "Vary rhythm", and "Stronger verbs"
- **Custom Instructions**: Provide your own specific refinement requests
- **Context-Aware**: AI understands the preceding context of your document for better suggestions

### 💬 Creative Collaboration
- **Sidebar Chat**: Interactive AI assistant for brainstorming, plot development, and creative ideation
- **Document Context**: The AI has access to your full document for contextually relevant suggestions
- **Streaming Responses**: Real-time streaming for natural conversation flow
- **Conversation History**: Maintain context across multiple exchanges

### 🎨 Beautiful Design
- **Multiple Color Themes**: Choose from a variety of carefully crafted themes including Dark Academia, Sepia Manuscript, Midnight Writer, and more
- **Quick Theme Switcher**: Easily switch themes from the header with live preview of color swatches
- **Custom Typography**: Theme-specific fonts for a unique literary feel per theme
- **Smooth Animations**: Polished UI transitions and interactions
- **Responsive Layout**: Adapts beautifully to different screen sizes

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Editor**: TipTap (ProseMirror-based)
- **Styling**: Tailwind CSS with dynamic theming system
- **State Management**: Zustand with Immer
- **UI Components**: Radix UI primitives
- **Backend**: Express.js
- **AI**: Anthropic Claude API (Claude Sonnet 4)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- An Anthropic API key ([Get one here](https://console.anthropic.com/))

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

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
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

### Development Scripts

- `npm run dev` - Start both client and server in development mode
- `npm run dev:client` - Start only the Vite dev server
- `npm run dev:server` - Start only the Express server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
ex-libris/
├── src/
│   ├── components/          # React components
│   │   ├── editor/          # Editor components (Editor, Toolbar, FloatingRefineMenu, etc.)
│   │   ├── layout/          # Layout components (AppLayout)
│   │   ├── settings/        # Settings components (ThemeSelector)
│   │   ├── sidebar/         # Sidebar components (Chat, Documents panels)
│   │   ├── theme/           # Theme components (ThemeProvider, QuickThemeSwitcher)
│   │   └── ui/              # Reusable UI components (Button, Input, Textarea)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions and theme definitions
│   ├── services/            # API service functions
│   ├── stores/              # Zustand state stores (document, chat, theme)
│   └── types/               # TypeScript type definitions
├── server/                  # Express backend
│   ├── index.js             # API server entry point
│   └── database.js          # SQLite database configuration
├── public/                  # Static assets
└── package.json
```

## Usage

### Writing

Simply start typing in the editor. Your content is automatically saved to the application state. The editor supports standard formatting shortcuts and a toolbar for styling.

### Refining Text

1. **Select any text** in the editor
2. A **sparkle icon** (✨) will appear near your selection
3. Click it to open the **Refine Menu**
4. Choose a quick action or enter a custom instruction
5. The AI will refine your selected text while preserving your voice and style

### Using the Chat Assistant

1. Open the **sidebar** (right side of the screen)
2. Navigate to the **Chat** tab
3. Ask questions about your story, request brainstorming help, or discuss plot points
4. The AI has access to your full document for context-aware responses

## API Endpoints

The backend provides three main endpoints:

- `POST /api/refine` - Refine selected text with AI
- `POST /api/chat` - Send a chat message (non-streaming)
- `POST /api/chat/stream` - Send a chat message (streaming)

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
