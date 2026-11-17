// Node 22 entrypoint for the VOWLIGHT submission: copy game/ and screenshots/ into the output directory
// and write the make.fun dossier beside them. Standard library only, so `node main.ts` runs with no install.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
// Byte-for-byte deterministic: deletes stale copies, keeps only game/, screenshots/ and dossier.json.
const quiet = process.argv.includes('--quiet');

const log = (line: string): void => {
  if (!quiet) console.log(line);
};

/** Copy one directory from beside this file into the output directory, fresh each run. */
function publish(name: string): void {
  const from = join(here, name);
  if (!existsSync(from)) throw new Error(`main.ts: ${name}/ is missing beside the entrypoint`);
  const to = join(out, name);
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  log(`copied ${name}/ -> ${to}`);
}

/** The dossier caps the bounty's gate.json names. */
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
publish('game');
publish('screenshots');

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);
log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
