export const PASSWORD_RULES = [
  { label: '12 caracteres', test: (value: string) => value.length >= 12 },
  { label: 'Uma letra maiúscula', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Uma letra minúscula', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Um número', test: (value: string) => /\d/.test(value) },
  { label: 'Um símbolo', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function isSecurePassword(value: string): boolean {
  return value.length <= 128 && PASSWORD_RULES.every((rule) => rule.test(value));
}
