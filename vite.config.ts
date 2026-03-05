import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0', // Força escuta em todos os IPs
      port: 3000,
      strictPort: true,
      // Suporte para Vite 6.x
      allowedHosts: true, 
      // Suporte para Vite 5.x e anteriores
      hmr: {
        clientPort: 443,
        host: 'maikysoft-uatizapi.iomi94.easypanel.host'
      },
    },
    // Desativa a checagem de host de forma global (fallback)
    preview: {
      host: true,
      allowedHosts: true
    }
  };
});