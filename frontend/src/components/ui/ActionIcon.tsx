interface ActionIconProps {
  name: 'add' | 'search' | 'excel' | 'pdf' | 'print' | 'back' | 'update';
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
  return <svg {...common}><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></svg>;
}
