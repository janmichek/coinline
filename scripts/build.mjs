import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const src = join(root, 'src');
const dist = join(root, 'dist');

const SHARED = ['background.js', 'content.js'];
const CHROME_ICONS = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
const TARGETS = ['chrome', 'firefox'];

const args = process.argv.slice(2);
const zip = args.includes('--zip');
const requested = args.filter((a) => a !== '--zip');
const targets = requested.length ? requested : TARGETS;

for (const target of targets) {
  if (!TARGETS.includes(target)) {
    console.error(`Unknown target "${target}". Use chrome or firefox.`);
    process.exit(1);
  }
}

mkdirSync(dist, { recursive: true });

for (const target of targets) {
  const out = join(dist, target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const file of SHARED) {
    cpSync(join(src, file), join(out, file));
  }

  if (target === 'chrome') {
    for (const file of CHROME_ICONS) {
      cpSync(join(src, file), join(out, file));
    }
  } else {
    cpSync(join(src, 'icon.svg'), join(out, 'icon.svg'));
  }

  const manifest = readFileSync(join(src, `manifest.${target}.json`), 'utf8');
  writeFileSync(join(out, 'manifest.json'), manifest);

  console.log(`Built dist/${target}`);

  if (zip) {
    const zipName = `coinline-${target}.zip`;
    const zipPath = join(dist, zipName);
    rmSync(zipPath, { force: true });
    execFileSync('zip', ['-r', '-X', zipPath, '.'], { cwd: out, stdio: 'inherit' });
    console.log(`Exported dist/${zipName}`);
  }
}
