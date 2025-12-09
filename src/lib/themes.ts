// src/lib/themes.ts

export interface ThemeColors {
    // Backgrounds
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgElevated: string;
    
    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    
    // Accent
    accent: string;
    accentBright: string;
    
    // Borders
    border: string;
    borderSubtle: string;
    borderStrong: string;
    
    // Semantic
    success: string;
    error: string;
    warning: string;
    
    // Special
    shadowBg: string;
    selectionBg: string;
    glowColor: string;
  }
  
  export interface ThemeFonts {
    display: string;
    serif: string;
    mono: string;
  }
  
  export interface Theme {
    id: string;
    name: string;
    description: string;
    colors: ThemeColors;
    fonts: ThemeFonts;
    // Preview colors for the selector
    preview: {
      primary: string;
      secondary: string;
      accent: string;
    };
  }
  
  export const themes: Record<string, Theme> = {
    darkAcademia: {
      id: 'darkAcademia',
      name: 'Dark Academia',
      description: 'Classic scholarly aesthetic with warm, muted tones',
      colors: {
        bgPrimary: '#1a1614',
        bgSecondary: '#252220',
        bgTertiary: '#2f2b28',
        bgElevated: '#3a3532',
        textPrimary: '#e8e0d5',
        textSecondary: '#b8a99a',
        textMuted: '#7a6f63',
        accent: '#c9a227',
        accentBright: '#dbb84d',
        border: '#3a3532',
        borderSubtle: '#2f2b28',
        borderStrong: '#4a4440',
        success: '#7cb97c',
        error: '#c75d5d',
        warning: '#d4a843',
        shadowBg: 'rgba(201, 162, 39, 0.15)',
        selectionBg: 'rgba(201, 162, 39, 0.3)',
        glowColor: 'rgba(201, 162, 39, 0.3)',
      },
      fonts: {
        display: '"Cinzel", serif',
        serif: '"Cormorant Garamond", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#1a1614',
        secondary: '#252220',
        accent: '#c9a227',
      },
    },
  
    midnight: {
      id: 'midnight',
      name: 'Midnight',
      description: 'Deep purple-blue tones for late night writing',
      colors: {
        bgPrimary: '#32292F',
        bgSecondary: '#3d343a',
        bgTertiary: '#4a4252',
        bgElevated: '#575366',
        textPrimary: '#D1E3DD',
        textSecondary: '#a8c4bb',
        textMuted: '#6E7DAB',
        accent: '#5762D5',
        accentBright: '#7681e6',
        border: '#4a4252',
        borderSubtle: '#3d343a',
        borderStrong: '#575366',
        success: '#4ade80',
        error: '#f87171',
        warning: '#fbbf24',
        shadowBg: 'rgba(87, 98, 213, 0.15)',
        selectionBg: 'rgba(87, 98, 213, 0.3)',
        glowColor: 'rgba(87, 98, 213, 0.3)',
      },
      fonts: {
        display: '"Cinzel", serif',
        serif: '"Cormorant Garamond", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#32292F',
        secondary: '#4a4252',
        accent: '#5762D5',
      },
    },
  
    ocean: {
      id: 'ocean',
      name: 'Ocean',
      description: 'Calm, deep sea blues for focused writing',
      colors: {
        bgPrimary: '#0d1b2a',
        bgSecondary: '#1b2838',
        bgTertiary: '#253545',
        bgElevated: '#2f4156',
        textPrimary: '#e0f4ff',
        textSecondary: '#a8d4e6',
        textMuted: '#5b8a9a',
        accent: '#00b4d8',
        accentBright: '#48cae4',
        border: '#2f4156',
        borderSubtle: '#253545',
        borderStrong: '#3d5a73',
        success: '#06d6a0',
        error: '#ef476f',
        warning: '#ffd166',
        shadowBg: 'rgba(0, 180, 216, 0.15)',
        selectionBg: 'rgba(0, 180, 216, 0.3)',
        glowColor: 'rgba(0, 180, 216, 0.3)',
      },
      fonts: {
        display: '"Playfair Display", serif',
        serif: '"Lora", Georgia, serif',
        mono: '"Fira Code", monospace',
      },
      preview: {
        primary: '#0d1b2a',
        secondary: '#1b2838',
        accent: '#00b4d8',
      },
    },
  
    spring: {
      id: 'spring',
      name: 'Spring',
      description: 'Fresh, light greens and soft pastels',
      colors: {
        bgPrimary: '#f0f7f4',
        bgSecondary: '#ffffff',
        bgTertiary: '#e8f3ed',
        bgElevated: '#d4e9dd',
        textPrimary: '#1a2f23',
        textSecondary: '#3d5a47',
        textMuted: '#6b8f7a',
        accent: '#2d936c',
        accentBright: '#40b88c',
        border: '#c8ddd0',
        borderSubtle: '#dce9e1',
        borderStrong: '#a8c9b5',
        success: '#22c55e',
        error: '#dc2626',
        warning: '#f59e0b',
        shadowBg: 'rgba(45, 147, 108, 0.12)',
        selectionBg: 'rgba(45, 147, 108, 0.2)',
        glowColor: 'rgba(45, 147, 108, 0.3)',
      },
      fonts: {
        display: '"Libre Baskerville", serif',
        serif: '"Source Serif 4", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#f0f7f4',
        secondary: '#ffffff',
        accent: '#2d936c',
      },
    },
  
    summer: {
      id: 'summer',
      name: 'Summer',
      description: 'Warm, sunny vibes with golden accents',
      colors: {
        bgPrimary: '#fffbf5',
        bgSecondary: '#ffffff',
        bgTertiary: '#fff5e6',
        bgElevated: '#ffedd5',
        textPrimary: '#2d1810',
        textSecondary: '#5c3d2e',
        textMuted: '#9a7b6b',
        accent: '#e85d04',
        accentBright: '#ff7b29',
        border: '#f5dcc8',
        borderSubtle: '#fae8d8',
        borderStrong: '#e5c4a8',
        success: '#16a34a',
        error: '#dc2626',
        warning: '#d97706',
        shadowBg: 'rgba(232, 93, 4, 0.12)',
        selectionBg: 'rgba(232, 93, 4, 0.2)',
        glowColor: 'rgba(232, 93, 4, 0.3)',
      },
      fonts: {
        display: '"Abril Fatface", serif',
        serif: '"Merriweather", Georgia, serif',
        mono: '"Fira Code", monospace',
      },
      preview: {
        primary: '#fffbf5',
        secondary: '#ffffff',
        accent: '#e85d04',
      },
    },
  
    fall: {
      id: 'fall',
      name: 'Fall',
      description: 'Rich autumn colors and cozy warmth',
      colors: {
        bgPrimary: '#1f1a16',
        bgSecondary: '#2a2420',
        bgTertiary: '#352e28',
        bgElevated: '#453c34',
        textPrimary: '#f5e6d3',
        textSecondary: '#d4c0a8',
        textMuted: '#8b7355',
        accent: '#c45d25',
        accentBright: '#e07839',
        border: '#453c34',
        borderSubtle: '#352e28',
        borderStrong: '#5a4f44',
        success: '#6b8e50',
        error: '#b8433d',
        warning: '#d4913d',
        shadowBg: 'rgba(196, 93, 37, 0.15)',
        selectionBg: 'rgba(196, 93, 37, 0.3)',
        glowColor: 'rgba(196, 93, 37, 0.3)',
      },
      fonts: {
        display: '"Playfair Display", serif',
        serif: '"Crimson Pro", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#1f1a16',
        secondary: '#2a2420',
        accent: '#c45d25',
      },
    },
  
    winter: {
      id: 'winter',
      name: 'Winter',
      description: 'Cool, crisp whites and icy blues',
      colors: {
        bgPrimary: '#f8fafc',
        bgSecondary: '#ffffff',
        bgTertiary: '#f1f5f9',
        bgElevated: '#e2e8f0',
        textPrimary: '#0f172a',
        textSecondary: '#334155',
        textMuted: '#64748b',
        accent: '#3b82f6',
        accentBright: '#60a5fa',
        border: '#cbd5e1',
        borderSubtle: '#e2e8f0',
        borderStrong: '#94a3b8',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        shadowBg: 'rgba(59, 130, 246, 0.1)',
        selectionBg: 'rgba(59, 130, 246, 0.2)',
        glowColor: 'rgba(59, 130, 246, 0.3)',
      },
      fonts: {
        display: '"Inter", sans-serif',
        serif: '"IBM Plex Serif", Georgia, serif',
        mono: '"IBM Plex Mono", monospace',
      },
      preview: {
        primary: '#f8fafc',
        secondary: '#ffffff',
        accent: '#3b82f6',
      },
    },
  
    fireplace: {
      id: 'fireplace',
      name: 'Fireplace',
      description: 'Warm amber glow like sitting by a fire',
      colors: {
        bgPrimary: '#1a1210',
        bgSecondary: '#261c18',
        bgTertiary: '#332520',
        bgElevated: '#442f28',
        textPrimary: '#ffecd9',
        textSecondary: '#e8c9a8',
        textMuted: '#a07b5a',
        accent: '#ff6b35',
        accentBright: '#ff8c5a',
        border: '#442f28',
        borderSubtle: '#332520',
        borderStrong: '#5a3d32',
        success: '#7cb342',
        error: '#e53935',
        warning: '#ffb300',
        shadowBg: 'rgba(255, 107, 53, 0.15)',
        selectionBg: 'rgba(255, 107, 53, 0.3)',
        glowColor: 'rgba(255, 107, 53, 0.4)',
      },
      fonts: {
        display: '"Cinzel", serif',
        serif: '"Literata", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#1a1210',
        secondary: '#261c18',
        accent: '#ff6b35',
      },
    },
  
    elegant: {
      id: 'elegant',
      name: 'Elegant',
      description: 'Sophisticated monochrome with rose gold accents',
      colors: {
        bgPrimary: '#18181b',
        bgSecondary: '#27272a',
        bgTertiary: '#3f3f46',
        bgElevated: '#52525b',
        textPrimary: '#fafafa',
        textSecondary: '#d4d4d8',
        textMuted: '#71717a',
        accent: '#e8b4b8',
        accentBright: '#f0c9cc',
        border: '#3f3f46',
        borderSubtle: '#27272a',
        borderStrong: '#52525b',
        success: '#4ade80',
        error: '#f87171',
        warning: '#fbbf24',
        shadowBg: 'rgba(232, 180, 184, 0.12)',
        selectionBg: 'rgba(232, 180, 184, 0.25)',
        glowColor: 'rgba(232, 180, 184, 0.3)',
      },
      fonts: {
        display: '"Cormorant Garamond", serif',
        serif: '"EB Garamond", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#18181b',
        secondary: '#27272a',
        accent: '#e8b4b8',
      },
    },
  
    forest: {
      id: 'forest',
      name: 'Forest',
      description: 'Deep woodland greens and earthy tones',
      colors: {
        bgPrimary: '#0f1a14',
        bgSecondary: '#1a2820',
        bgTertiary: '#24352b',
        bgElevated: '#2f4538',
        textPrimary: '#e8f0eb',
        textSecondary: '#b8ccbf',
        textMuted: '#6a8a74',
        accent: '#5fa777',
        accentBright: '#7bc492',
        border: '#2f4538',
        borderSubtle: '#24352b',
        borderStrong: '#3d5847',
        success: '#34d399',
        error: '#f87171',
        warning: '#fcd34d',
        shadowBg: 'rgba(95, 167, 119, 0.15)',
        selectionBg: 'rgba(95, 167, 119, 0.25)',
        glowColor: 'rgba(95, 167, 119, 0.3)',
      },
      fonts: {
        display: '"Libre Baskerville", serif',
        serif: '"Crimson Pro", Georgia, serif',
        mono: '"Fira Code", monospace',
      },
      preview: {
        primary: '#0f1a14',
        secondary: '#1a2820',
        accent: '#5fa777',
      },
    },
  
    lavender: {
      id: 'lavender',
      name: 'Lavender Dreams',
      description: 'Soft purples and gentle lavender hues',
      colors: {
        bgPrimary: '#1e1b29',
        bgSecondary: '#2a2638',
        bgTertiary: '#363248',
        bgElevated: '#454059',
        textPrimary: '#f0eef5',
        textSecondary: '#c8c3d8',
        textMuted: '#8b84a3',
        accent: '#a78bfa',
        accentBright: '#c4b5fd',
        border: '#454059',
        borderSubtle: '#363248',
        borderStrong: '#5a5470',
        success: '#4ade80',
        error: '#fb7185',
        warning: '#fcd34d',
        shadowBg: 'rgba(167, 139, 250, 0.15)',
        selectionBg: 'rgba(167, 139, 250, 0.25)',
        glowColor: 'rgba(167, 139, 250, 0.3)',
      },
      fonts: {
        display: '"Playfair Display", serif',
        serif: '"Lora", Georgia, serif',
        mono: '"JetBrains Mono", monospace',
      },
      preview: {
        primary: '#1e1b29',
        secondary: '#2a2638',
        accent: '#a78bfa',
      },
    },
  
    typewriter: {
      id: 'typewriter',
      name: 'Typewriter',
      description: 'Classic vintage typewriter aesthetic',
      colors: {
        bgPrimary: '#f5f1e8',
        bgSecondary: '#fffdf7',
        bgTertiary: '#ebe5d9',
        bgElevated: '#e0d8c8',
        textPrimary: '#2c2416',
        textSecondary: '#4a4030',
        textMuted: '#7a6f5c',
        accent: '#4a4030',
        accentBright: '#5c5040',
        border: '#d4cbb8',
        borderSubtle: '#e0d8c8',
        borderStrong: '#b8a88f',
        success: '#4a7c59',
        error: '#9b2c2c',
        warning: '#b7791f',
        shadowBg: 'rgba(74, 64, 48, 0.1)',
        selectionBg: 'rgba(74, 64, 48, 0.15)',
        glowColor: 'rgba(74, 64, 48, 0.2)',
      },
      fonts: {
        display: '"Special Elite", "Courier New", monospace',
        serif: '"Courier Prime", "Courier New", monospace',
        mono: '"Courier Prime", monospace',
      },
      preview: {
        primary: '#f5f1e8',
        secondary: '#fffdf7',
        accent: '#4a4030',
      },
    },
  };
  
  export const themeOrder = [
    'darkAcademia',
    'midnight',
    'elegant',
    'ocean',
    'forest',
    'lavender',
    'fireplace',
    'fall',
    'spring',
    'summer',
    'winter',
    'typewriter',
  ];
  
  export const defaultTheme = 'darkAcademia';