import { describe, expect, it } from 'vitest';
import { passwordPolicyErrors } from './passwordPolicy.js';

describe('política de senha', () => {
  it('aceita uma senha longa com variedade de caracteres', () => {
    expect(passwordPolicyErrors('Oficina#Segura2026')).toEqual([]);
  });

  it('recusa senha curta e previsível', () => {
    expect(passwordPolicyErrors('senha123')).not.toEqual([]);
  });

  it('recusa senha contendo identidade do usuário', () => {
    expect(passwordPolicyErrors('Filipe#Seguro2026', { name: 'Filipe Rodrigues' })).toContain(
      'Não use seu nome ou e-mail na senha.',
    );
  });
});
