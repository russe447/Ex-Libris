/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Academia palette
        academia: {
          bg: {
            primary: '#1a1814',
            secondary: '#242019',
            tertiary: '#2e2a23',
            elevated: '#38342c',
          },
          text: {
            primary: '#e8e4dc',
            secondary: '#b8b4aa',
            muted: '#888578',
          },
          accent: {
            gold: '#c9a227',
            goldMuted: '#a68b1f',
            goldBright: '#e4b82a',
            copper: '#b87333',
          },
          border: {
            subtle: '#3d3830',
            DEFAULT: '#4a453c',
            strong: '#5c564b',
          },
          success: '#5c7c5c',
          error: '#8b4444',
          shadow: {
            bg: 'rgba(201, 162, 39, 0.08)',
            border: 'rgba(201, 162, 39, 0.3)',
          }
        }
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Garamond', 'Georgia', 'serif'],
        display: ['Cinzel', 'Cormorant Garamond', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'editor': ['1.125rem', { lineHeight: '1.85', letterSpacing: '0.01em' }],
        'editor-lg': ['1.25rem', { lineHeight: '1.85', letterSpacing: '0.01em' }],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(201, 162, 39, 0.15)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}