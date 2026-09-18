import type { TipoPessoa } from '../types/cherp.types.js';

/** Formatação de CPF/CNPJ, telefone e CEP — compartilhada entre a página de cliente e o cadastro rápido pela OS. */
export function apenasDigitos(valor: string, limite: number): string {
  return valor.replace(/\D/g, '').slice(0, limite);
}

export function formatarDocumento(valor: string, tipo: TipoPessoa): string {
  const digitos = apenasDigitos(valor, tipo === 'PJ' ? 14 : 11);
  if (tipo === 'PJ') {
    return digitos
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarCep(valor: string): string {
  return apenasDigitos(valor, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatarTelefone(valor: string): string {
  const digitos = apenasDigitos(valor, 11);
  if (digitos.length <= 10) {
    return digitos.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digitos.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}
