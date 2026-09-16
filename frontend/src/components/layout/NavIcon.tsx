import type { NavItem } from './navItems.js';

const PATHS: Record<NavItem['icon'], string> = {
  home: 'M4 11.5 12 5l8 6.5M6 10v9h12v-9',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12v14H6z',
  box: 'M3 8l9-5 9 5-9 5-9-5Zm0 0v9l9 5m0-9v9m0-9 9-5v9l-9 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  users:
    'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0M17 6.5a3 3 0 1 1 0 6M20 20a5.5 5.5 0 0 0-4.5-5.4',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 3H9l-.5 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L9 21h6l.5-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  building: 'M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M4 21h16M14 21v-8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8M8 7h0M8 11h0M8 15h0',
};

export function NavIcon({ name }: { name: NavItem['icon'] }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
