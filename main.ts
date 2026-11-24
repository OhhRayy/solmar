// Solmar — entry program.
//
// Copies the playable game and its screenshots into the output directory
// and writes the dossier the scorer compares against its own rebuild.
// Run it from the repository root:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output. The program
// uses only the Node standard library and the kit's dossier builder.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const here = process.cwd();

// Start from a clean output directory so stale files never leak into a run.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The game and its screenshots, copied whole.
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The dossier, built from exactly what was just copied.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Solmar entry written to ${outDir} (${dossier.length} byte dossier).`);
