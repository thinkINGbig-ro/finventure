// Simulare de echilibru:  node tests/simulare.js [--n 1000] [--seed sim]
// Raportează distribuția finalurilor, vârsta medie la final, cauzele de game over,
// evenimentele care nu apar niciodată și alegerile pe care nu le alege nimeni.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formateazaEroare, incarcaContinut } from '../js/content.js';
import { formateazaRaport, simuleazaVieti } from '../js/simulare.js';

const arg = (nume, implicit) => {
  const i = process.argv.indexOf(`--${nume}`);
  return i > 0 ? process.argv[i + 1] : implicit;
};

const radacina = fileURLToPath(new URL('../', import.meta.url));
const { ctx, erori } = await incarcaContinut((cale) => readFile(radacina + cale, 'utf8'));
if (erori.length) {
  console.error(`Conținutul are ${erori.length} erori (evenimentele invalide sunt excluse):`);
  erori.forEach((e) => console.error(`  ${formateazaEroare(e)}`));
  console.error('');
}

const n = Number(arg('n', 1000));
const start = Date.now();
const raport = simuleazaVieti(ctx, { n, seed: arg('seed', 'sim') });
console.log(formateazaRaport(raport));
console.log(`\n(${((Date.now() - start) / 1000).toFixed(1)} s)`);
