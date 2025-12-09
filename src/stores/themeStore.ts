// src/stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { themes, defaultTheme, Theme } from '@/lib/themes';

interface ThemeState {
  themeId: string;
  theme: Theme;
  setTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: defaultTheme,
      theme: themes[defaultTheme],
      setTheme: (themeId: string) => {
        const theme = themes[themeId];
        if (theme) {
          set({ themeId, theme });
        }
      },
    }),
    {
      name: 'exlibris-theme',
    }
  )
);