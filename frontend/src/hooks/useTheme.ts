import { useEffect } from 'react';
import { useThemeStore } from '../store/themeStore.js';

/** Aplica data-theme no <html> sempre que o tema mudar (inicial ou escolhido pelo usuário). */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return theme;
}
