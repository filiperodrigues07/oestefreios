import type { NavItem } from './navItems.js';

const PATHS: Record<NavItem['icon'], string> = {
  home: 'M4 11.5 12 5l8 6.5M6 10v9h12v-9',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12v14H6z',
  box: 'M3 8l9-5 9 5-9 5-9-5Zm0 0v9l9 5m0-9v9m0-9 9-5v9l-9 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
};

export function NavIcon({ name }: { name: NavItem['icon'] }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
