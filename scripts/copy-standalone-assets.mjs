import { cpSync, rmSync } from 'node:fs';

const targets = [
  { src: '.next/static', dest: '.next/standalone/.next/static' },
  { src: 'public', dest: '.next/standalone/public' },
];

for (const { src, dest } of targets) {
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${src} → ${dest}`);
}
