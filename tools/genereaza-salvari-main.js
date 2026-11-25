// Generează salvări reale cu codul de pe `main` (dintr-un worktree), exact cum le scrie localStorage-ul
// (cheie „finventure.*” → text JSON). Ieșirea e fixture-ul testului de migrare de pe `extindere`
// („migrare: salvările reale de pe main…” din tests/loturi.js).
// Folosire (din rădăcina repo-ului):
//   git worktree add --detach ../finventure-main main
//   node tools/genereaza-salvari-main.js ../finventure-main tests/fixtures/salvari-main-v1.json
//   git worktree remove ../finventure-main
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [radacinaArg, iesire] = process.argv.slice(2);
if (!radacinaArg || !iesire) {
  console.error('Folosire: node tools/genereaza-salvari-main.js <worktree-main> <fisier-iesire>');
  process.exit(1);
}
const radacina = resolve(radacinaArg);
const imp = (p) => import(pathToFileURL(`${radacina}/${p}`).href);
const { incarcaContinut } = await imp('js/content.js');
const { PROFILURI, simuleazaViata } = await imp('js/simulare.js');
const { salveazaJoc, adaugaCheckpoint, VERSIUNE_SALVARE } = await imp('js/state.js');
const { creeazaStorage } = await imp('js/storage.js');
const { jocNou, avanseaza, alege, continua, oprireCurenta } = await imp('js/engine.js');
const { ctx } = await incarcaContinut((p) => readFile(`${radacina}/${p}`, 'utf8'));

const storageNou = () => {
  const date = new Map();
  const storage = creeazaStorage({ tip: 'memorie', getItem: (k) => date.get(k) ?? null, setItem: (k, v) => date.set(k, String(v)), removeItem: (k) => date.delete(k) });
  return { date, storage };
};
const rezultat = { generatCu: `main, VERSIUNE_SALVARE = ${VERSIUNE_SALVARE}`, cazuri: {} };

// 1. Salvări la sfârșit de an, pe profiluri: credite, card, investiții, depozite, casă, popriri, restanțe.
const CAZURI = [
  { id: 'prudent-32', profil: 'prudent', seed: 'mig-1', varsta: 32 },
  { id: 'prudent-50', profil: 'prudent', seed: 'mig-2', varsta: 50 },
  { id: 'frugal-40', profil: 'frugal', seed: 'mig-3', varsta: 40 },
  { id: 'aleator-20', profil: 'aleator', seed: 'mig-4', varsta: 20 },
  { id: 'aleator-35', profil: 'aleator', seed: 'mig-5', varsta: 35 },
  { id: 'riscant-20', profil: 'riscant', seed: 'mig-6', varsta: 20 },
  { id: 'riscant-final', profil: 'riscant', seed: 'mig-7', varsta: 99 }, // jocul se termină înainte: salvarea de game over
];
for (const caz of CAZURI) {
  const { date, storage } = storageNou();
  let salvat = false;
  const { state } = simuleazaViata(ctx, caz.seed, PROFILURI[caz.profil], {
    laSfarsitDeAn: (s) => {
      const varsta = 18 + Math.floor(s.luna / 12);
      if (varsta === caz.varsta - 2) adaugaCheckpoint(storage, s, 'checkpoint mai vechi');
      if (!salvat && varsta >= caz.varsta) {
        salveazaJoc(storage, s);
        adaugaCheckpoint(storage, s, 'checkpoint la salvare');
        salvat = true;
      }
    },
  });
  if (!salvat) salveazaJoc(storage, state);
  rezultat.cazuri[caz.id] = { profil: caz.profil, varsta: caz.varsta, finalulVietii: state.final?.motiv ?? null, localStorage: Object.fromEntries(date) };
}

// 2. Salvări în mijlocul anului, cu un card de eveniment deschis (jocul real salvează după fiecare pas).
for (const [id, seed, aniInainte] of [['mijloc-an-19', 'mig-8', 1], ['mijloc-an-27', 'mig-9', 9], ['mijloc-an-38', 'mig-10', 20]]) {
  const { date, storage } = storageNou();
  const state = jocNou(ctx, { seed, nume: 'Test' });
  let x = 7;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const alegeLaIntamplare = (o) => {
    const disp = o.alegeri.filter((a) => a.disponibil);
    const a = disp[Math.floor(rnd() * disp.length)];
    if (!a.grup) return a.cale;
    const sub = a.subalegeri.filter((s) => s.disponibil);
    return sub[Math.floor(rnd() * sub.length)].cale;
  };
  let oprire = alege(state, ctx, alegeLaIntamplare(oprireCurenta(state, ctx))).oprire;
  let ani = 0;
  let gata = false;
  while (!gata && !state.final) {
    oprire = oprire ?? avanseaza(state, ctx);
    while (oprire && oprire.tip !== 'final') {
      if (oprire.tip === 'eveniment' && ani >= aniInainte && state.an) {
        salveazaJoc(storage, state);
        gata = true;
        break;
      }
      oprire = oprire.tip === 'eveniment' ? alege(state, ctx, alegeLaIntamplare(oprire)).oprire : continua(state, ctx);
    }
    oprire = null;
    ani++;
  }
  const s = JSON.parse(date.get('finventure.salvare') ?? 'null');
  rezultat.cazuri[id] = { profil: 'la întâmplare', varsta: s ? 18 + Math.floor(s.luna / 12) : null, cardDeschis: s?.pendinte?.eveniment ?? null, localStorage: Object.fromEntries(date) };
}

await writeFile(iesire, `${JSON.stringify(rezultat)}\n`);
console.log(Object.entries(rezultat.cazuri).map(([k, v]) => `${k}: ${Object.keys(v.localStorage).length} chei`).join('\n'));
