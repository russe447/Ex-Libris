// src/components/theme/ThemeProvider.tsx
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

// Google Fonts URL with all theme fonts
const GOOGLE_FONTS_URL = 
  'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Fira+Code:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Literata:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Special+Elite&display=swap';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Load all fonts
    const existingLink = document.querySelector('link[data-theme-fonts]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      link.setAttribute('data-theme-fonts', 'true');
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply color variables
    root.style.setProperty('--color-bg-primary', theme.colors.bgPrimary);
    root.style.setProperty('--color-bg-secondary', theme.colors.bgSecondary);
    root.style.setProperty('--color-bg-tertiary', theme.colors.bgTertiary);
    root.style.setProperty('--color-bg-elevated', theme.colors.bgElevated);
    
    root.style.setProperty('--color-text-primary', theme.colors.textPrimary);
    root.style.setProperty('--color-text-secondary', theme.colors.textSecondary);
    root.style.setProperty('--color-text-muted', theme.colors.textMuted);
    
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--color-accent-bright', theme.colors.accentBright);
    
    root.style.setProperty('--color-border', theme.colors.border);
    root.style.setProperty('--color-border-subtle', theme.colors.borderSubtle);
    root.style.setProperty('--color-border-strong', theme.colors.borderStrong);
    
    root.style.setProperty('--color-success', theme.colors.success);
    root.style.setProperty('--color-error', theme.colors.error);
    root.style.setProperty('--color-warning', theme.colors.warning);
    
    root.style.setProperty('--color-shadow-bg', theme.colors.shadowBg);
    root.style.setProperty('--color-selection-bg', theme.colors.selectionBg);
    root.style.setProperty('--color-glow', theme.colors.glowColor);
    
    // Apply font variables
    root.style.setProperty('--font-display', theme.fonts.display);
    root.style.setProperty('--font-serif', theme.fonts.serif);
    root.style.setProperty('--font-mono', theme.fonts.mono);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.bgPrimary);
    }
  }, [theme]);

  return <>{children}</>;
}

