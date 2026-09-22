interface ActionIconProps {
  name: 'add' | 'search' | 'excel' | 'pdf' | 'print' | 'back' | 'update' | 'mail' | 'edit' | 'delete' | 'save' | 'ready' | 'photo';
  size?: number;
}

/** Ícones neutros para ações recorrentes. Mantêm o mesmo traço em todos os botões. */
export function ActionIcon({ name, size = 16 }: ActionIconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

  if (name === 'add') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
  if (name === 'excel') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13l4 4m0-4-4 4m7-4v4" /></svg>;
  if (name === 'pdf') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 16h8M8 12h5" /></svg>;
  if (name === 'print') return <svg {...common}><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>;
  if (name === 'back') return <svg {...common}><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></svg>;
  if (name === 'mail') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  if (name === 'edit') return <svg {...common}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  if (name === 'delete') return <svg {...common}><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6" /></svg>;
  if (name === 'save') return <svg {...common}><path d="M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-7h8v7" /></svg>;
  if (name === 'ready') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
  if (name === 'photo') return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></svg>;
  return <svg {...common}><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></svg>;
}
