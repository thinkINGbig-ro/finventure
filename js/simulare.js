// Simulare automată: multe vieți jucate de „profiluri” de jucător, pentru echilibrare
// și ca dovadă că jocul învață ceva (prudentul trebuie să o ducă mult mai bine decât riscantul).
// Folosită de tests/simulare.js (Node) și, mai târziu, de modul debug din browser.

import { actiune, alege, avanseaza, continua, jocNou } from './engine.js';
import { gasesteAlegere, gasesteProduse, lantDecizii } from './events.js';
import { baniDisponibili, contCurent, fondUrgenta } from './finance.js';
import { hashSeed } from './rng.js';
import { areFlag, avereNeta, cheltuieliLunare } from './state.js';
import { areJobFullTime, contractCurent } from './cariera.js';
import { inLei, varstaLa } from './util.js';

// ---------- Generator aleator al strategiei (separat de RNG-ul jocului) ----------

function creeazaRnd(seed) {
  let x = hashSeed(`strategie/${seed}`); // seed-uri consecutive -> secvențe necorelate
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296; // biții de sus: cei de jos ai unui LCG au perioadă scurtă
  };
}

// Toate căile finale disponibile („id” sau „grup/sub”) dintr-o oprire descrisă.
function caiDisponibile(oprire) {
  const cai = [];
  for (const a of oprire.alegeri) {
    if (!a.disponibil) continue;
    if (a.grup) a.subalegeri.filter((s) => s.disponibil).forEach((s) => cai.push(s.cale));
    else cai.push(a.cale);
  }
  return cai;
}

// ---------- Cum „vede” un profil o alegere: trăsături citite din JSON ----------

function trasaturi(def) {
  const toate = [def, ...(def.rezultate ?? [])];
  const t = {};
  const pune = (k, v = 1) => { t[k] = (t[k] ?? 0) + v; };
  for (const x of toate) {
    for (const p of [x.produsNou ?? []].flat()) if (p.tip === 'credit') pune(p.furnizor === 'ifn' ? 'ifn' : 'credit');
    if (x.job?.contract) pune(x.job.contract);
    if (x.job === null) pune('demisie');
    if (x.acceptaOferta) pune('oferta');
    if (x.negociazaOferta) pune('negociaza');
    for (const v of Object.values(x.seteazaProdus ?? {})) {
      if (v.plata === 'minim') pune('cardMinim');
      if (v.plata === 'integral') pune('cardIntegral');
    }
    if (x.ramburseaza) pune('ramburseaza');
    if (x.sursaPlata === 'fondUrgenta') pune('fond');
    if (x.sursaPlata === 'cardCredit') pune('card');
    if (x.lichideaza) pune('lichideaza');
    if (x.situatie?.studii) pune('studii');
    if ((x.flaguri ?? []).some((f) => f.startsWith('cv_umflat'))) pune('minciuna');
    if (x.cereMarire) pune('marire');
    if (x.promovare) pune('promovare');
    for (const e of x.etichete ?? []) pune(e);
    if (typeof x.stilViata === 'number') pune(x.stilViata > 0 ? 'stilSus' : 'stilJos');
    if (x.situatie?.locuinta === 'chirieSingur') pune('chirieScumpa');
    if (x.situatie?.locuinta === 'chirieColegi') pune('chirieIeftina');
    if ((x.urmari ?? []).some((u) => u.eveniment === 'cv-start')) pune('cautaJob');
    for (const k of ['viitor', 'skill', 'retea', 'fericire', 'energie', 'reputatie']) {
      const v = x.efecte?.[k];
      if (typeof v === 'number') pune(k, v / toate.length);
    }
  }
  if (['ignor', 'refuz', 'nu', 'astept', 'cash'].includes(def.id)) pune('ignora');
  return t;
}

function alegePrinScor(ponderiSauFunctie) {
  return (oprire, state, ctx, rnd) => {
    const ponderi = typeof ponderiSauFunctie === 'function' ? ponderiSauFunctie(state, ctx) : ponderiSauFunctie;
    const ev = ctx.evenimente.get(oprire.eveniment);
    let best = null;
    for (const cale of caiDisponibile(oprire)) {
      const t = trasaturi(gasesteAlegere(ev, cale).alegere);
      const scor = Object.entries(t).reduce((s, [k, v]) => s + (ponderi[k] ?? 0) * v, 0) + rnd();
      if (!best || scor > best.scor) best = { cale, scor };
    }
    return best.cale;
  };
}

// ---------- Meniuri: ce face fiecare profil între „Avansează”-uri ----------

const lei = (bani) => inLei(bani);

function asiguraCont(state, ctx) {
  if (!contCurent(state)) actiune(state, ctx, 'deschide', { tip: 'contCurent', pachet: varstaLa(state.luna) <= 25 ? 'tineri' : 'standard' });
  const cont = contCurent(state);
  if (cont && state.numerar > 0) actiune(state, ctx, 'depune', { id: cont.id, suma: lei(state.numerar) });
}

function cautaJobDacaTrebuie(state, ctx) {
  if (areJobFullTime(state, ctx) || state.situatie.studii || areFlag(state, 'cautare_job')) return null;
  const r = actiune(state, ctx, 'cautaJob');
  return r.ok ? r.oprire : null;
}

function cereMarireAnual(state, ctx) {
  const c = contractCurent(state);
  if (c && c.contract !== 'negru' && (c.luniDeLaMarire ?? 0) >= 12) actiune(state, ctx, 'cereMarire');
}

function inchideRestanteDinEconomii(state, ctx) {
  for (const d of state.produse.filter((p) => (p.tip === 'factura' || p.tip === 'poprire' || (p.tip === 'credit' && p.restanta > 0)))) {
    const datorie = d.tip === 'credit' ? d.rest + d.restanta : d.tip === 'poprire' ? d.datorie : d.restanta;
    const lipsa = datorie - baniDisponibili(state);
    for (const e of gasesteProduse(state, 'contEconomii')) {
      if (lipsa <= 0) break;
      const suma = Math.min(e.sold, lipsa);
      if (suma > 0) actiune(state, ctx, 'retrage', { id: e.id, suma: lei(suma) });
    }
    actiune(state, ctx, 'ramburseaza', { id: d.id });
  }
}

// Prudent: cont, fond de urgență de 6 luni, restul investit în ETF, cere măriri, caută job full-time.
function meniuPrudent(state, ctx) {
  asiguraCont(state, ctx);
  inchideRestanteDinEconomii(state, ctx);
  const lunar = cheltuieliLunare(state, ctx);
  let fond = state.produse.find((p) => p.tip === 'contEconomii' && p.fondUrgenta);
  if (!fond) {
    const r = actiune(state, ctx, 'deschide', { tip: 'contEconomii' });
    if (r.ok) actiune(state, ctx, 'seteaza', { id: r.produs.id, campuri: { fondUrgenta: true } });
    fond = r.produs;
  }
  const surplus = baniDisponibili(state) - 2 * lunar;
  if (fond && surplus > 0) {
    const pentruFond = Math.min(surplus, Math.max(0, 6 * lunar - fondUrgenta(state)));
    if (pentruFond > 100) actiune(state, ctx, 'depune', { id: fond.id, suma: lei(pentruFond) });
  }
  const deInvestit = baniDisponibili(state) - 3 * lunar;
  if (fondUrgenta(state) >= 6 * lunar && deInvestit > 50000) {
    actiune(state, ctx, 'deschide', { tip: 'investitie', clasa: 'etf', suma: lei(Math.round(deInvestit * 0.7)) });
  }
  if (state.stilViata !== 'modest' && fondUrgenta(state) < 6 * lunar) actiune(state, ctx, 'stilViata', { nivel: 'modest' });
  cereMarireAnual(state, ctx);
  return cautaJobDacaTrebuie(state, ctx);
}

// Riscant: card de credit pe minim cu cumpărăturile pe el, cheltuie aproape tot, nu economisește.
function meniuRiscant(state, ctx, rnd) {
  asiguraCont(state, ctx);
  if (areJobFullTime(state, ctx)) actiune(state, ctx, 'stilViata', { nivel: 'lux' });
  let card = gasesteProduse(state, 'cardCredit')[0];
  if (!card) {
    const r = actiune(state, ctx, 'deschide', { tip: 'cardCredit' });
    if (r.ok) card = r.produs;
  }
  if (card) actiune(state, ctx, 'seteaza', { id: card.id, campuri: { plata: 'minim', cumparaturiPeCard: true } });
  const lunar = cheltuieliLunare(state, ctx);
  const deCheltuit = baniDisponibili(state) - lunar;
  if (deCheltuit > 10000) actiune(state, ctx, 'cumpara', { suma: lei(Math.round(deCheltuit * 0.8)), fericire: 5 });
  if (card && rnd() < 0.5) {
    const peCard = Math.round(card.limita * 0.3);
    actiune(state, ctx, 'cumpara', { suma: lei(peCard), fericire: 3, peCard: true });
  }
  return cautaJobDacaTrebuie(state, ctx);
}

// Aleator: în fiecare an, 0–3 acțiuni de meniu luate la întâmplare, bune sau proaste.
const ACTIUNI_ALEATOARE = [
  (state, ctx) => actiune(state, ctx, 'deschide', { tip: 'contCurent', pachet: varstaLa(state.luna) <= 25 ? 'tineri' : 'standard' }),
  (state, ctx, rnd) => actiune(state, ctx, 'stilViata', { nivel: ['modest', 'confortabil', 'lux'][Math.floor(rnd() * 3)] }),
  (state, ctx, rnd) => {
    let e = gasesteProduse(state, 'contEconomii')[0];
    if (!e) e = actiune(state, ctx, 'deschide', { tip: 'contEconomii' }).produs;
    if (e) actiune(state, ctx, 'depune', { id: e.id, suma: lei(Math.round(baniDisponibili(state) * rnd() * 0.5)) });
    if (e && rnd() < 0.5) actiune(state, ctx, 'seteaza', { id: e.id, campuri: { fondUrgenta: true } });
  },
  (state, ctx, rnd) => {
    const e = gasesteProduse(state, 'contEconomii')[0];
    if (e) actiune(state, ctx, 'retrage', { id: e.id, suma: lei(Math.round(e.sold * rnd())) });
  },
  (state, ctx, rnd) => actiune(state, ctx, 'deschide', { tip: 'depozit', suma: lei(Math.round(baniDisponibili(state) * (0.2 + rnd() * 0.3))) }),
  (state, ctx) => {
    const d = gasesteProduse(state, 'depozit')[0];
    if (d) actiune(state, ctx, 'lichideaza', { id: d.id });
  },
  (state, ctx, rnd) => actiune(state, ctx, 'deschide', { tip: 'investitie', clasa: 'etf', suma: lei(Math.round(baniDisponibili(state) * (0.1 + rnd() * 0.4))) }),
  (state, ctx, rnd) => actiune(state, ctx, 'deschide', { tip: 'investitie', clasa: 'crypto', suma: lei(Math.round(baniDisponibili(state) * (0.05 + rnd() * 0.25))) }),
  (state, ctx, rnd) => {
    const inv = gasesteProduse(state, 'investitie').filter((p) => p.clasa !== 'titluriStat');
    if (inv.length) actiune(state, ctx, 'lichideaza', { id: inv[Math.floor(rnd() * inv.length)].id });
  },
  (state, ctx, rnd) => {
    let card = gasesteProduse(state, 'cardCredit')[0];
    if (!card) card = actiune(state, ctx, 'deschide', { tip: 'cardCredit' }).produs;
    if (card) actiune(state, ctx, 'seteaza', { id: card.id, campuri: { plata: rnd() < 0.5 ? 'minim' : 'integral', cumparaturiPeCard: rnd() < 0.5 } });
  },
  (state, ctx, rnd) => actiune(state, ctx, 'cumpara', { suma: lei(Math.round(baniDisponibili(state) * (0.1 + rnd() * 0.5))), fericire: 4 }),
  (state, ctx) => actiune(state, ctx, 'cereMarire'),
  (state, ctx) => actiune(state, ctx, 'cautaJob'),
];

function meniuAleator(state, ctx, rnd) {
  const n = Math.floor(rnd() * 4);
  let oprire = null;
  for (let i = 0; i < n; i++) {
    const r = ACTIUNI_ALEATOARE[Math.floor(rnd() * ACTIUNI_ALEATOARE.length)](state, ctx, rnd);
    if (r?.oprire) oprire = r.oprire; // „caută job” deschide CV-ul
  }
  return oprire;
}

function alegeAleator(oprire, state, ctx, rnd) {
  const disp = oprire.alegeri.filter((a) => a.disponibil);
  const a = disp[Math.floor(rnd() * disp.length)];
  if (!a.grup) return a.cale;
  const sub = a.subalegeri.filter((s) => s.disponibil);
  return sub[Math.floor(rnd() * sub.length)].cale;
}

export const PROFILURI = {
  aleator: { nume: 'aleator', descriere: 'alegeri și acțiuni din meniuri la întâmplare, bune și proaste', alege: alegeAleator, meniu: meniuAleator },
  prudent: {
    nume: 'prudent',
    descriere: 'fond de urgență, fără IFN, contract de muncă, economisește și investește',
    alege: alegePrinScor((state, ctx) => ({
      ifn: -10, credit: -3, negru: -8, cim: 5, pfa: 2, oferta: 3, negociaza: areJobFullTime(state, ctx) ? 4 : -1, cardMinim: -6, cardIntegral: 5, ramburseaza: 5,
      fond: 6, lichideaza: 2, card: -3, studii: 4, minciuna: -6, marire: 4, promovare: 5, cautaJob: 3, ignora: -5, demisie: -5,
      viitor: 0.5, skill: 0.3, retea: 0.3, reputatie: 0.2, fericire: 0.15, energie: 0.15,
      inselatorie: -15, pariu: -6, stilSus: -6, stilJos: 4, rate: -4, investitieRiscanta: -3, chirieScumpa: -1, chirieIeftina: 2,
    })),
    meniu: meniuPrudent,
  },
  riscant: {
    nume: 'riscant',
    descriere: 'IFN, la negru, card pe minim, cheltuie tot',
    alege: alegePrinScor({
      ifn: 8, credit: 3, negru: 6, cim: -2, cardMinim: 6, cardIntegral: -4, ramburseaza: -5, fond: -4, card: 4, studii: -3,
      minciuna: 5, marire: -1, cautaJob: 1, ignora: 4, fericire: 0.4, viitor: -0.3, energie: 0.1,
      inselatorie: 3, pariu: 6, stilSus: 6, stilJos: -4, rate: 5, investitieRiscanta: 6, chirieScumpa: 3,
    }),
    meniu: meniuRiscant,
  },
};

// Strategia aleatoare simplă (doar evenimente), folosită în teste.
export function strategieAleatoare(seed) {
  const rnd = creeazaRnd(seed);
  return (oprire) => alegeAleator(oprire, null, null, rnd);
}

// ---------- O viață / multe vieți ----------

export function simuleazaViata(ctx, seed, profil = PROFILURI.aleator, { aniMax = 60, laSfarsitDeAn } = {}) {
  const state = jocNou(ctx, { seed });
  const rnd = creeazaRnd(`${profil.nume}/${seed}`);
  const alese = [];
  const consuma = (oprire) => {
    while (oprire && oprire.tip !== 'final') {
      if (oprire.tip === 'eveniment') {
        const cale = profil.alege(oprire, state, ctx, rnd);
        alese.push(`${oprire.eveniment} › ${cale}`);
        oprire = alege(state, ctx, cale).oprire;
      } else {
        oprire = continua(state, ctx);
      }
    }
  };
  let primulSalariu = null; // primul salariu full-time: { brut, luna, indice }
  const noteazaSalariu = () => {
    const c = contractCurent(state);
    if (!primulSalariu && c && areJobFullTime(state, ctx)) primulSalariu = { brut: c.brut, luna: state.luna, indice: state.indicePreturi };
  };
  consuma(avanseaza(state, ctx));
  for (let an = 0; an < aniMax && !state.final; an++) {
    consuma(profil.meniu(state, ctx, rnd)); // acțiunile din meniuri pot deschide un card (ex. CV-ul)
    consuma(avanseaza(state, ctx));
    noteazaSalariu();
    laSfarsitDeAn?.(state);
  }
  return { state, alese, primulSalariu };
}

export function simuleazaVieti(ctx, { n = 1000, seed = 'sim', profil = 'aleator', aniMax = 60, laSfarsitDeAn } = {}) {
  const p = typeof profil === 'string' ? PROFILURI[profil] : profil;
  const finaluri = {};
  const cauze = {};
  const varste = { toate: [], gameOver: [] };
  const averi = [];
  const averiAzi = [];
  const medii = { inflatie: [], etf: [], salariu: [], salariuReal: [] };
  const aparitii = Object.fromEntries([...ctx.evenimente.keys()].map((id) => [id, 0]));
  const alegeriVazute = new Set();

  for (let i = 0; i < n; i++) {
    const { state, alese, primulSalariu } = simuleazaViata(ctx, `${seed}-${i}`, p, { aniMax, laSfarsitDeAn });
    const ani = state.luna / 12;
    if (ani >= 5) {
      medii.inflatie.push(Math.pow(state.indicePreturi, 1 / ani) - 1);
      medii.etf.push(Math.pow(state.piete.etf / 100, 1 / ani) - 1);
      const c = contractCurent(state);
      const aniSalariu = primulSalariu ? (state.luna - primulSalariu.luna) / 12 : 0;
      if (c && aniSalariu >= 5) {
        medii.salariu.push(Math.pow(c.brut / primulSalariu.brut, 1 / aniSalariu) - 1);
        medii.salariuReal.push(Math.pow((c.brut / state.indicePreturi) / (primulSalariu.brut / primulSalariu.indice), 1 / aniSalariu) - 1);
      }
    }
    alese.forEach((a) => alegeriVazute.add(a));
    for (const [id, luni] of Object.entries(state.istoricEvenimente)) aparitii[id] += luni.length;

    const motiv = state.final?.motiv ?? 'neterminat';
    finaluri[motiv] = (finaluri[motiv] ?? 0) + 1;
    const varsta = varstaLa(state.final?.luna ?? state.luna);
    varste.toate.push(varsta);
    averi.push(inLei(avereNeta(state)));
    averiAzi.push(inLei(avereNeta(state)) / state.indicePreturi);
    if (motiv !== 'pensie' && motiv !== 'neterminat') {
      varste.gameOver.push(varsta);
      const lant = state.final.cauza ? lantDecizii(state, state.final.cauza) : [];
      const radacina = lant[0] ? `${lant[0].eveniment} › ${lant[0].alegere}` : 'fără decizie în lanț (ex. venit prea mic)';
      const cheie = `${motiv}: ${radacina}`;
      cauze[cheie] = (cauze[cheie] ?? 0) + 1;
    }
  }

  const toateAlegerile = [];
  for (const ev of ctx.evenimente.values()) {
    for (const a of ev.alegeri) {
      if (a.subalegeri) a.subalegeri.forEach((s) => toateAlegerile.push(`${ev.id} › ${a.id}/${s.id}`));
      else toateAlegerile.push(`${ev.id} › ${a.id}`);
    }
  }

  return {
    profil: p.nume,
    descriere: p.descriere,
    n,
    finaluri,
    procente: Object.fromEntries(Object.entries(finaluri).map(([m, k]) => [m, Math.round((k / n) * 1000) / 10])),
    varstaMedie: medie(varste.toate),
    varstaMedieGameOver: medie(varste.gameOver),
    avereMediana: mediana(averi),
    avereMedianaAzi: mediana(averiAzi),
    mediiAnuale: Object.fromEntries(Object.entries(medii).map(([k, xs]) => [k, xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10000) / 100 : null])),
    cauzeGameOver: Object.entries(cauze).sort((a, b) => b[1] - a[1]),
    evenimenteNeaparute: Object.entries(aparitii).filter(([, k]) => k === 0).map(([id]) => id),
    alegeriNealese: toateAlegerile.filter((a) => !alegeriVazute.has(a)),
    aparitii,
  };
}

const medie = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
}

// ---------- Raport ----------

const NUME_FINALURI = { pensie: 'pensie (65 de ani)', faliment: 'faliment personal', burnout: 'burnout', renuntare: 'renunțare', neterminat: 'neterminat' };
const ORDINE_FINALURI = ['pensie', 'faliment', 'burnout', 'renuntare', 'neterminat'];

// 3.200.000 -> „3,2 mil. lei”, 980.000 -> „980.000 lei”
export function sumaMare(lei) {
  if (lei == null) return '-';
  if (Math.abs(lei) >= 1e6) return `${(lei / 1e6).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} mil. lei`;
  return `${Math.round(lei).toLocaleString('ro-RO')} lei`;
}

export function formateazaRaport(rapoarte) {
  const lista = Array.isArray(rapoarte) ? rapoarte : [rapoarte];
  const pct = (r, m) => `${(r.procente[m] ?? 0).toFixed(1)}%`;
  const linii = [
    `Simulare: ${lista.map((r) => `${r.n} × ${r.profil}`).join(', ')}`,
    '',
    `${'Profil'.padEnd(10)}${ORDINE_FINALURI.slice(0, 4).map((m) => m.padStart(11)).join('')}   vârsta medie   avere mediană (în lei de azi)`,
    ...lista.map((r) => `${r.profil.padEnd(10)}${ORDINE_FINALURI.slice(0, 4).map((m) => pct(r, m).padStart(11)).join('')}   ${String(r.varstaMedie).padStart(12)}   ${sumaMare(r.avereMediana)} (≈ ${sumaMare(r.avereMedianaAzi)} de azi)`),
    '',
    'Medii anuale (pe viață): inflație / randament ETF / salariu nominal / salariu real',
    ...lista.map((r) => `${r.profil.padEnd(10)}${['inflatie', 'etf', 'salariu', 'salariuReal'].map((k) => `${r.mediiAnuale[k] ?? '-'}%`.padStart(9)).join('   ')}`),
  ];
  for (const r of lista) {
    linii.push('', `── ${r.profil}: ${r.descriere}`,
      ...ORDINE_FINALURI.filter((m) => r.finaluri[m]).map((m) => `  ${NUME_FINALURI[m].padEnd(22)} ${String(r.finaluri[m]).padStart(5)}  ${pct(r, m)}`),
      `  vârsta medie la game over: ${r.varstaMedieGameOver ?? '-'}`,
      '  cauze game over (prima decizie din lanț):',
      ...(r.cauzeGameOver.length ? r.cauzeGameOver.slice(0, 8).map(([c, k]) => `    ${String(k).padStart(5)}  ${c}`) : ['    (niciunul)']));
  }
  const intersectie = (seturi) => seturi.reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  const neaparute = intersectie(lista.map((r) => new Set(r.evenimenteNeaparute)));
  const nealese = intersectie(lista.map((r) => new Set(r.alegeriNealese)));
  linii.push('', `Evenimente care n-au apărut la niciun profil (${neaparute.size}):`, ...(neaparute.size ? [...neaparute].map((x) => `  ${x}`) : ['  (niciunul)']));
  linii.push('', `Alegeri pe care nu le-a ales niciun profil (${nealese.size}):`, ...(nealese.size ? [...nealese].map((x) => `  ${x}`) : ['  (niciuna)']));
  return linii.join('\n');
}

// Pentru grafic (tests/simulare.js --json): doar ce trebuie pentru comparația dintre profiluri.
export function raportJson(rapoarte, extra = {}) {
  return {
    ...extra,
    profiluri: Object.fromEntries(rapoarte.map((r) => [r.profil, {
      descriere: r.descriere,
      n: r.n,
      procente: Object.fromEntries(ORDINE_FINALURI.slice(0, 4).map((m) => [m, r.procente[m] ?? 0])),
      varstaMedie: r.varstaMedie,
      varstaMedieGameOver: r.varstaMedieGameOver,
      avereMedianaLei: r.avereMediana,
      avereMedianaLeiDeAzi: r.avereMedianaAzi,
      mediiAnualeProcent: r.mediiAnuale,
      cauzeGameOver: r.cauzeGameOver.slice(0, 10).map(([cauza, numar]) => ({ cauza, numar })),
    }])),
  };
}
