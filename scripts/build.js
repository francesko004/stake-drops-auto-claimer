/**
 * Custom multi-target build script for Stake Auto-Claim Chrome Extension.
 * Ensures Content Scripts are built as 100% self-contained IIFE bundles with ZERO import statements.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function runBuild() {
  console.log('🚀 Starting Chrome Extension build...');

  // Clean dist
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // 1. Build Popup, Options, and Background Service Worker (ES modules)
  console.log('📦 Building UI pages & Service Worker...');
  await build({
    root: rootDir,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: false,
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'src/popup/popup.html'),
          options: path.resolve(rootDir, 'src/options/options.html'),
          'background/service-worker': path.resolve(rootDir, 'src/background/service-worker.ts')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background/service-worker') {
              return 'background/service-worker.js';
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
          { src: 'icon*.png', dest: 'icons' },
          { src: 'src/assets/*', dest: 'assets' },
          { src: 'test/fixtures/*', dest: 'test-fixtures' }
        ]
      })
    ]
  });

  // Relocate HTML files from dist/src to dist/
  const srcPopup = path.join(distDir, 'src/popup/popup.html');
  const destPopup = path.join(distDir, 'popup/popup.html');
  const srcOptions = path.join(distDir, 'src/options/options.html');
  const destOptions = path.join(distDir, 'options/options.html');
  const distSrc = path.join(distDir, 'src');

  if (fs.existsSync(srcPopup)) {
    fs.mkdirSync(path.join(distDir, 'popup'), { recursive: true });
    fs.renameSync(srcPopup, destPopup);
  }
  if (fs.existsSync(srcOptions)) {
    fs.mkdirSync(path.join(distDir, 'options'), { recursive: true });
    fs.renameSync(srcOptions, destOptions);
  }
  if (fs.existsSync(distSrc)) {
    fs.rmSync(distSrc, { recursive: true, force: true });
  }

  // 2. Build Content Script: stake-automator.ts (100% Self-Contained IIFE, NO imports)
  console.log('⚡ Building Content Script: stake-automator.js (IIFE)...');
  await build({
    root: rootDir,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content/stake-automator.ts'),
        name: 'StakeAutomator',
        formats: ['iife'],
        fileName: () => 'content/stake-automator.js'
      }
    },
    configFile: false
  });

  // 3. Build Content Script: stakecruncher-monitor.ts (100% Self-Contained IIFE, NO imports)
  console.log('⚡ Building Content Script: stakecruncher-monitor.js (IIFE)...');
  await build({
    root: rootDir,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: path.resolve(rootDir, 'src/content/stakecruncher-monitor.ts'),
        name: 'StakeCruncherMonitor',
        formats: ['iife'],
        fileName: () => 'content/stakecruncher-monitor.js'
      }
    },
    configFile: false
  });

  // 4. Copy manifest.json and icons at the final stage
  console.log('📋 Copying manifest.json and verifying extension structure...');
  fs.copyFileSync(path.resolve(rootDir, 'manifest.json'), path.join(distDir, 'manifest.json'));

  // Ensure icons directory exists
  const iconsDir = path.join(distDir, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  for (const size of ['16', '48', '128']) {
    const srcIcon = path.resolve(rootDir, `icon${size}.png`);
    const destIcon = path.join(iconsDir, `icon${size}.png`);
    if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, destIcon);
    }
  }

  // Verify all required extension assets
  const requiredFiles = [
    'manifest.json',
    'background/service-worker.js',
    'content/stake-automator.js',
    'content/stakecruncher-monitor.js',
    'popup/popup.html',
    'options/options.html',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png'
  ];

  let missing = 0;
  for (const file of requiredFiles) {
    const fullPath = path.join(distDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Missing build file: dist/${file}`);
      missing++;
    }
  }

  if (missing > 0) {
    throw new Error(`Build verification failed! ${missing} required files are missing from dist.`);
  }

  console.log('✨ Build completed & verified successfully! Ready to load unpacked in Chrome.');
}

runBuild().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});
