import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  hasExplicitChoice: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: systemPrefersDark() ? 'dark' : 'light',
      hasExplicitChoice: false,
      setTheme: (theme) => set({ theme, hasExplicitChoice: true }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark', hasExplicitChoice: true }),
    }),
    { name: 'oeste-freios-theme' },
  ),
);
