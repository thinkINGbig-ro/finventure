// Rulează testele motorului în Node, fără dependențe:  node tests/run.js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ruleazaTeste } from './suite.js';

const radacina = fileURLToPath(new URL('../', import.meta.url));
const citeste = (cale) => readFile(radacina + cale, 'utf8');

const { picate } = await ruleazaTeste(citeste);
process.exit(picate.length ? 1 : 0);
