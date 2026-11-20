import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3500,
    host: true,
    open: false
  }
});
