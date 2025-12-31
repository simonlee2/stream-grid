import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');
const indexFile = join(distDir, 'index.html');
const fallbackFile = join(distDir, '404.html');

if (!existsSync(indexFile)) {
  console.error('Cannot create 404.html – dist/index.html not found. Did you run `npm run build`?');
  process.exit(1);
}

copyFileSync(indexFile, fallbackFile);
console.log('Created dist/404.html for GitHub Pages SPA fallback.');
