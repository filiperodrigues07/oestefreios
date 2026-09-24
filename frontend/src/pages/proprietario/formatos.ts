export const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function dataBr(iso: string | null): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

export const mesAno = (referencia: string) => referencia.split('-').reverse().join('/');
