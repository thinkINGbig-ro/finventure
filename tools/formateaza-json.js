// Formatează JSON-urile de conținut în stilul proiectului: obiectele/listele scurte pe o linie.
// Folosire: node tools/formateaza-json.js data/events/urgente.json [alte fișiere...]
import { readFileSync, writeFileSync } from 'node:fs';

const LATIME = 110;

function format(v, indent) {
  const inline = JSON.stringify(v, null, 1)?.replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']');
  if (v === null || typeof v !== 'object' || indent.length + inline.length <= LATIME) return inline;
  const urm = indent + '  ';
  if (Array.isArray(v)) return `[\n${v.map((x) => urm + format(x, urm)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${urm}${JSON.stringify(k)}: ${format(x, urm)}`).join(',\n')}\n${indent}}`;
}

for (const f of process.argv.slice(2)) {
  writeFileSync(f, format(JSON.parse(readFileSync(f, 'utf8')), '') + '\n');
}
