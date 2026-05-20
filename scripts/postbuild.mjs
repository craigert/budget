// Duplicate index.html as 404.html so GitHub Pages serves the SPA shell
// for any unknown route — required because gh-pages is a plain static host.
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

await copyFile(join(buildDir, 'index.html'), join(buildDir, '404.html'));
console.log('Wrote build/404.html (copy of index.html for SPA fallback).');
