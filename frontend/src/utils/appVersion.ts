declare const __APP_VERSION__: string;

/** Hash curto do commit + data do build (injetado pelo Vite, ver vite.config.ts). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
