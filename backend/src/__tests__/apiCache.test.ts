import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('cache de respostas da API', () => {
  it('não permite persistir respostas autenticadas no cache HTTP', async () => {
    const response = await request(app).get('/api/os');
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
