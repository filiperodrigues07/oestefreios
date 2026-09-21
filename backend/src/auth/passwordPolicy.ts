export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password123!',
  'senha123456!',
  'admin123456!',
  'qwerty123456!',
]);

export function passwordPolicyErrors(password: string, identity: { name?: string; email?: string } = {}): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Use ao menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (password.length > PASSWORD_MAX_LENGTH) errors.push(`Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  if (!/[a-z]/.test(password)) errors.push('Inclua uma letra minúscula.');
  if (!/[A-Z]/.test(password)) errors.push('Inclua uma letra maiúscula.');
  if (!/\d/.test(password)) errors.push('Inclua um número.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Inclua um símbolo.');

  const normalized = password.toLocaleLowerCase('pt-BR');
  const emailPrefix = identity.email?.split('@')[0]?.toLocaleLowerCase('pt-BR');
  const nameParts = identity.name?.toLocaleLowerCase('pt-BR').split(/\s+/).filter((part) => part.length >= 4) ?? [];
  if ((emailPrefix && normalized.includes(emailPrefix)) || nameParts.some((part) => normalized.includes(part))) {
    errors.push('Não use seu nome ou e-mail na senha.');
  }
  if (COMMON_PASSWORDS.has(normalized)) errors.push('Essa senha é muito comum.');
  return errors;
}

