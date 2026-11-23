// Simulare de echilibru, pe profiluri de jucător:
//   node tests/simulare.js [--n 500] [--profil aleator,prudent,riscant] [--seed sim] [--json raport.json]
// --n = vieți per profil. --json scrie procentele pe profil într-un fișier (pentru grafice).
// Raportul folosit în prezentare: node tests/simulare.js --n 500 --json docs/raport-simulare.json
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formateazaEroare, incarcaContinut } from '../js/content.js';
import { PROFILURI, formateazaRaport, raportJson, simuleazaVieti } from '../js/simulare.js';

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

const n = Number(arg('n', 500));
const seed = arg('seed', 'sim');
const profiluri = arg('profil', Object.keys(PROFILURI).join(',')).split(',');
const start = Date.now();
const rapoarte = profiluri.map((profil) => simuleazaVieti(ctx, { n, seed, profil }));
console.log(formateazaRaport(rapoarte));
console.log(`\n(${((Date.now() - start) / 1000).toFixed(1)} s)`);

const fisierJson = arg('json');
if (fisierJson) {
  const json = raportJson(rapoarte, { generat: new Date().toISOString(), seed, vietiPeProfil: n, evenimente: ctx.evenimente.size });
  await writeFile(fisierJson, JSON.stringify(json, null, 2) + '\n');
  console.log(`Raport JSON scris în ${fisierJson}`);
}
