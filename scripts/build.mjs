// Baut die App nach _site/ (lokal und in der GitHub Action identisch).
// esbuild bündelt React + App, Tailwind v3 erzeugt das CSS. Keine Laufzeit-Abhängigkeit zu Drittanbietern.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const out = '_site';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
const date = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
const version = `${date}${sha ? ` · ${sha}` : ' · lokal'}`;

await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(version) },
  outfile: `${out}/bundle.js`,
  target: ['safari15'],
});

execSync(
  `npx tailwindcss -c tailwind.config.cjs -i src/tailwind-input.css -o ${out}/tailwind.css --minify`,
  { stdio: 'inherit' },
);

let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace('</body>', '    <script src="bundle.js"></script>\n  </body>');
fs.writeFileSync(`${out}/index.html`, html);
fs.copyFileSync('public/manifest.json', `${out}/manifest.json`);
// Service Worker mit Versionskennung (neuer Cache pro Build)
const swVersion = version.replace(/[^0-9A-Za-z]+/g, '-');
fs.writeFileSync(`${out}/sw.js`, fs.readFileSync('public/sw.js', 'utf8').replace('__BUILD__', swVersion));
fs.cpSync('public/icons', `${out}/icons`, { recursive: true });
fs.writeFileSync(`${out}/.nojekyll`, '');
console.log(`Gebaut: ${version}`);
