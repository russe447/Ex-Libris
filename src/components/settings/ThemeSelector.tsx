// src/components/settings/ThemeSelector.tsx
import { Check, Palette, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { themes, themeOrder, Theme } from '@/lib/themes';
import { cn } from '@/lib/utils';

function ThemeCard({ theme, isActive, onClick }: { 
  theme: Theme; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const isLight = isLightTheme(theme);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full p-3 rounded-lg border-2 transition-all duration-200',
        'hover:scale-[1.02] hover:shadow-lg',
        isActive 
          ? 'border-[var(--color-accent)] shadow-md' 
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
      )}
      style={{ backgroundColor: theme.colors.bgSecondary }}
    >
      {/* Preview Colors */}
      <div className="flex gap-1 mb-2">
        <div 
          className="h-6 flex-1 rounded-l-md"
          style={{ backgroundColor: theme.colors.bgPrimary }}
        />
        <div 
          className="h-6 flex-1"
          style={{ backgroundColor: theme.colors.bgTertiary }}
        />
        <div 
          className="h-6 w-8 rounded-r-md"
          style={{ backgroundColor: theme.colors.accent }}
        />
      </div>
      
      {/* Theme Name */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <div 
            className="text-sm font-medium"
            style={{ color: theme.colors.textPrimary }}
          >
            {theme.name}
          </div>
          <div 
            className="text-xs mt-0.5 line-clamp-1"
            style={{ color: theme.colors.textMuted }}
          >
            {theme.description}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {isLight ? (
            <Sun 
              className="h-3.5 w-3.5" 
              style={{ color: theme.colors.textMuted }} 
            />
          ) : (
            <Moon 
              className="h-3.5 w-3.5" 
              style={{ color: theme.colors.textMuted }} 
            />
          )}
          
          {isActive && (
            <div 
              className="p-0.5 rounded-full"
              style={{ backgroundColor: theme.colors.accent }}
            >
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function isLightTheme(theme: Theme): boolean {
  // Simple heuristic: check if the primary background is light
  const hex = theme.colors.bgPrimary.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function ThemeSelector() {
  const { themeId, setTheme } = useThemeStore();

  const darkThemes = themeOrder.filter(id => !isLightTheme(themes[id]));
  const lightThemes = themeOrder.filter(id => isLightTheme(themes[id]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
        <Palette className="h-5 w-5 text-[var(--color-accent)]" />
        <h3 className="font-display text-lg">Choose Your Theme</h3>
      </div>

      {/* Dark Themes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Moon className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Dark Themes</span>
        </div>
        <div className="grid gap-2">
          {darkThemes.map((id) => (
            <ThemeCard
              key={id}
              theme={themes[id]}
              isActive={themeId === id}
              onClick={() => setTheme(id)}
            />
          ))}
        </div>
      </div>

      {/* Light Themes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sun className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Light Themes</span>
        </div>
        <div className="grid gap-2">
          {lightThemes.map((id) => (
            <ThemeCard
              key={id}
              theme={themes[id]}
              isActive={themeId === id}
              onClick={() => setTheme(id)}
            />
          ))}
        </div>
      </div>

      {/* Current Font Preview */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <span className="text-sm text-[var(--color-text-muted)]">Font Preview</span>
        <div className="mt-2 p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
          <p 
            className="text-lg mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Display Font
          </p>
          <p 
            className="text-base text-[var(--color-text-secondary)]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Body text appears in this elegant serif style, perfect for long-form writing.
          </p>
          <p 
            className="text-sm text-[var(--color-text-muted)] mt-2"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            const monospace = "for code";
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 Random code comment here
 */