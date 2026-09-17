import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.BANKRBOT_API_KEY': JSON.stringify(env.BANKRBOT_API_KEY),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'vendor-three';
            if (id.includes('node_modules/@google/genai') || id.includes('node_modules/@google/adk')) return 'vendor-genai';
            if (id.includes('node_modules/motion')) return 'vendor-motion';
            if (id.includes('node_modules/react-dom')) return 'vendor-react';
            if (id.includes('node_modules/react')) return 'vendor-react';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/zustand')) return 'vendor-ui';
            if (id.includes('/src/three/')) return 'scene';
          },
        },
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
