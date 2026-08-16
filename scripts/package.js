/**
 * Packaging script to produce a clean zip file of the extension for release.
 */

import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const releasesDir = path.join(rootDir, 'releases');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version || '1.0.0';
const zipPath = path.join(releasesDir, `stake-auto-claim-v${version}.zip`);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKb = (archive.pointer() / 1024).toFixed(2);
  console.log(`✓ Package created successfully: ${zipPath} (${sizeKb} KB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
