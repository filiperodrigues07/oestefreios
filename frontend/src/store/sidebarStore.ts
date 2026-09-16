import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

/** Preferência de dispositivo (não é dado de conta) — expandir/reduzir a sidebar no desktop. */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      toggle: () => set({ collapsed: !get().collapsed }),
    }),
    { name: 'oeste-freios-sidebar' },
  ),
);
