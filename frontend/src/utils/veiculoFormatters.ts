/**
 * Placa: maiúsculas, só letras/números/hífen, no máximo 8 caracteres ("ABC-1234"). Não impõe
 * hífen — o CHERP tem placas gravadas nos dois formatos e a busca precisa casar com qualquer um.
 */
export function sanitizarPlaca(valor: string): string {
  return valor.toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9-]/g, '').slice(0, 8);
}

/** Chassi (VIN): 17 caracteres alfanuméricos, sem espaço — colar do documento costuma trazer espaço/traço. */
export function sanitizarChassi(valor: string): string {
  return valor.toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9]/g, '').slice(0, 17);
}

export function somenteDigitos(valor: string, limite?: number): string {
  const digitos = valor.replace(/\D/g, '');
  return limite === undefined ? digitos : digitos.slice(0, limite);
}
