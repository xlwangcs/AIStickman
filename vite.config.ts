/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径 base，使产物可直接部署到 GitHub Pages 子路径
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
