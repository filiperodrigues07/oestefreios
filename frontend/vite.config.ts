import { execFileSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Hash do commit + data do build: aparece no perfil, na tela de erro e no log de erro do frontend. */
function appVersion(): string {
  const data = new Date().toISOString().slice(0, 10);
  try {
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${hash} · ${data}`;
  } catch {
    return `dev · ${data}`;
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['client-favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Oeste Freios — Controle de OS',
        short_name: 'Oeste Freios',
        description: 'Controle de Ordens de Serviço integrado ao CHERP.',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Assets do build (JS/CSS/HTML/ícones): cache-first via precache — o padrão do Workbox pra tudo que está no glob.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // SPA: qualquer navegação sem match de arquivo cai no index.html cacheado (permite abrir o app offline).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Respostas de /api/ incluem dados autenticados. O shell da PWA continua
        // disponível offline, mas respostas da API não são persistidas no aparelho.
        runtimeCaching: [],
      },
      devOptions: {
        // localhost é um contexto seguro: habilita o service worker também no Vite
        // para testar instalação e funcionamento offline antes da publicação.
        enabled: true,
      },
    }),
  ],
  server: {
    host: true,
    // Vite bloqueia Host header desconhecido por padrão (proteção contra DNS rebinding) — libera
    // o domínio do túnel temporário (loca.lt) usado pra testar no celular fora da rede local.
    allowedHosts: ['.loca.lt'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` não herda `server.proxy` — precisa do seu próprio, senão /api 404 no build de produção local.
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
