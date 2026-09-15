import pino, { type LoggerOptions } from 'pino';
import { env } from '../config/env.js';

const baseOptions: LoggerOptions = {
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
};

const options: LoggerOptions =
  env.NODE_ENV === 'development'
    ? {
        ...baseOptions,
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
      }
    : baseOptions;

export const logger = pino(options);
