// Copies pdf.js's worker and its support files (CJK cmaps, standard fonts, image
// decoders, ICC profiles) into public/pdfjs/<version>/ so the PDF viewer loads them
// from our own origin, independent of the bundler. Runs on every npm install; the
// version folder keeps a cached worker from ever pairing with a newer library.
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src     = join('node_modules', 'pdfjs-dist');
const { version } = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
const outRoot = join('public', 'pdfjs');
const out     = join(outRoot, version);

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, 'legacy', 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.js'));
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(join(src, dir), join(out, dir), { recursive: true });
}
