import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import styles from './AppShell.module.css';
import { NavIcon } from './NavIcon.js';
import { NAV_ITEMS } from './navItems.js';

/**
 * Shell responsivo: sidebar fixa a partir de 768px, bottom navigation abaixo disso.
 * Os dois lêem a mesma lista de itens (navItems.ts) para não divergir.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Oeste Freios</div>
        <nav className={styles.sidebarNav} aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>{children}</main>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
