import fs from 'fs';
import { resolve } from 'path';
import { Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from 'vitest/config';

function htmlRelocatePlugin(): Plugin {
  return {
    name: 'html-relocate',
    closeBundle() {
      const srcPopup = resolve(__dirname, 'dist/src/popup/popup.html');
      const destPopup = resolve(__dirname, 'dist/popup/popup.html');
      const srcOptions = resolve(__dirname, 'dist/src/options/options.html');
      const destOptions = resolve(__dirname, 'dist/options/options.html');
      const distSrc = resolve(__dirname, 'dist/src');

      if (fs.existsSync(srcPopup)) {
        fs.mkdirSync(resolve(__dirname, 'dist/popup'), { recursive: true });
        fs.renameSync(srcPopup, destPopup);
      }
      if (fs.existsSync(srcOptions)) {
        fs.mkdirSync(resolve(__dirname, 'dist/options'), { recursive: true });
        fs.renameSync(srcOptions, destOptions);
      }
      if (fs.existsSync(distSrc)) {
        fs.rmSync(distSrc, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content/stakecruncher-monitor': resolve(__dirname, 'src/content/stakecruncher-monitor.ts'),
        'content/stake-automator': resolve(__dirname, 'src/content/stake-automator.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content/stakecruncher-monitor') {
            return 'content/stakecruncher-monitor.js';
          }
          if (chunkInfo.name === 'content/stake-automator') {
            return 'content/stake-automator.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup/popup.js';
          }
          if (chunkInfo.name === 'options') {
            return 'options/options.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            if (assetInfo.name.includes('popup')) return 'popup/popup.css';
            if (assetInfo.name.includes('options')) return 'options/options.css';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.'
        },
        {
          src: 'icon*.png',
          dest: 'icons'
        },
        {
          src: 'src/assets/*',
          dest: 'assets'
        },
        {
          src: 'test/fixtures/*',
          dest: 'test-fixtures'
        }
      ]
    }) as unknown as any,
    htmlRelocatePlugin() as unknown as any
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.test.ts']
  }
});
