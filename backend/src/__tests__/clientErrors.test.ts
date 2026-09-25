import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { logger } from '../utils/logger.js';

describe('POST /api/client-errors', () => {
  it('registra no log e responde 204 sem exigir login', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const res = await request(app)
      .post('/api/client-errors')
      .send({ source: 'boundary', message: 'x is undefined', url: '/os/123', stack: 'a'.repeat(20_000) });
    expect(res.status).toBe(204);
    const chamada = spy.mock.calls.find(([, msg]) => msg === 'Erro no frontend');
    expect((chamada?.[0] as { clientError: { stack: string } }).clientError.stack).toHaveLength(8000);
    spy.mockRestore();
  });

  it('rejeita payload sem campos obrigatórios', async () => {
    const res = await request(app).post('/api/client-errors').send({ message: 'x' });
    expect(res.status).toBe(400);
  });
});
