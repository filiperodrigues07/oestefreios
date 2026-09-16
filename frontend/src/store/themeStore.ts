import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  hasExplicitChoice: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Preferência persistida continua vencendo; instalações novas começam no tema premium escuro.
      theme: 'dark',
      hasExplicitChoice: false,
      setTheme: (theme) => set({ theme, hasExplicitChoice: true }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark', hasExplicitChoice: true }),
    }),
    { name: 'oeste-freios-theme' },
  ),
);
