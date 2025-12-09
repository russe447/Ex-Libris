// src/components/theme/QuickThemeSwitcher.tsx
import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { themes, themeOrder } from '@/lib/themes';
import { cn } from '@/lib/utils';

export function QuickThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { themeId, setTheme, theme } = useThemeStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md',
          'text-academia-text-secondary hover:text-academia-text-primary',
          'hover:bg-academia-bg-tertiary transition-colors',
          isOpen && 'bg-academia-bg-tertiary'
        )}
        title="Change theme"
      >
        <Palette className="h-4 w-4" />
        <span className="text-xs hidden sm:inline">{theme.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-academia-bg-elevated border border-academia-border rounded-lg shadow-soft z-50 animate-fade-in">
          {themeOrder.map((id) => {
            const t = themes[id];
            return (
              <button
                key={id}
                onClick={() => {
                  setTheme(id);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm flex items-center gap-3',
                  'hover:bg-academia-bg-tertiary transition-colors',
                  themeId === id && 'text-academia-accent'
                )}
              >
                <div className="flex gap-0.5">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.colors.bgPrimary }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.colors.accent }}
                  />
                </div>
                <span className={themeId === id ? 'font-medium' : ''}>
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

