import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // *.vercel.app のルートで配信するため、アセットURLを /assets/... にする。
  base: '/',
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js' },
});
