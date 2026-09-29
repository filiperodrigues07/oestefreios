/**
 * Abreviações e variações que o catálogo do CHERP usa de verdade (conferido nas descrições reais:
 * "BUCHA MOLA DT", "COXIM TZ", "TROCA DE LONA CARRETA 3º EX LD", "SOQUETE IMPACTO SEXT."...).
 * Cada linha é um grupo: qualquer palavra do grupo encontra as outras — quem digita "dianteiro"
 * acha "DT" e quem digita "dt" acha "DIANTEIRA". Palavras sem acento e em maiúsculas.
 *
 * Só entra aqui o que tem um único significado no catálogo. Sigla ambígua (TR, CAB, RED, SC...)
 * fica de fora até alguém confirmar o que significa.
 */
export const CATALOG_SYNONYM_GROUPS: string[][] = [
  ['DIANTEIRO', 'DIANTEIRA', 'DIANT', 'DT'],
  ['TRASEIRO', 'TRASEIRA', 'TRAS', 'TZ'],
  ['ESQUERDO', 'ESQUERDA', 'ESQ', 'LE'],
  ['DIREITO', 'DIREITA', 'DIR', 'LD'],
  ['CARRETA', 'CAR'],
  ['CAVALO', 'CV'],
  ['EIXO', 'EX'],
  ['SEXTAVADO', 'SEXTAVADA', 'SEXT'],
  ['SUSPENSAO', 'SUSP'],
  ['IMPACTO', 'IMP'],
  ['LAMPADA', 'LAMP'],
  ['PLASTICO', 'PLASTICA', 'PLAST'],
  ['TRIFASICO', 'TRIF'],
  ['CONJUNTO', 'CONJ', 'CJ'],
  ['COMPLETO', 'COMPLETA', 'COMPL'],
  ['ORIGINAL', 'ORIG'],
  ['REFORCADO', 'REFORCADA', 'REFORC'],
  ['PARAFUSO', 'PARAF'],
  ['ROLAMENTO', 'ROLAM'],
  ['MERCEDES', 'MB'],
  ['VOLKSWAGEN', 'VW', 'VOLKS'],
];
