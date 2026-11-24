// Starea jucătorului: creare, valori derivate (Bani, Viitor, avere netă, fază), salvare.

import { bal, clamp, cloneaza, inBani, varstaLa, numeLuna } from './util.js';
import { creeazaFluxuri } from './rng.js';
import { CLASE_PIATA, baniDisponibili, contCurent, datorieProdus, facturiLunare, pret, valoareProdus } from './finance.js';
import { CHEI } from './storage.js';

export const VERSIUNE_SALVARE = 2;

// Migrările salvărilor: fiecare pas aduce o salvare de la versiunea `de` la `de + 1`, completând
// câmpurile noi cu valori neutre. Așa, un joc început pe GitHub Pages merge și după o actualizare.
const MIGRARI = {
  1: (s) => {
    s.timp = { an: Math.floor(s.luna / 12), folosit: 0, activitati: {} };
    s.rng.actiuni ??= creeazaFluxuri(`${s.seed}`).actiuni;
  },
};

export function migreaza(s) {
  if (!s || typeof s.versiune !== 'number' || s.versiune > VERSIUNE_SALVARE) return null;
  while (s.versiune < VERSIUNE_SALVARE) {
    const pas = MIGRARI[s.versiune];
    if (!pas) return null;
    pas(s);
    s.versiune += 1;
  }
  return s;
}

export function creeazaStare(ctx, { seed = Date.now(), nume = 'Alex' } = {}) {
  const s = { ...bal(ctx, 'start'), stilViata: bal(ctx, 'stilViata.start') };
  const state = {
    versiune: VERSIUNE_SALVARE,
    seed: String(seed),
    rng: creeazaFluxuri(seed),
    nume,
    luna: 0, // luna absolută care urmează să fie procesată; 0 = septembrie, 18 ani
    faza: 1,

    stat: { bani: 0, fericire: s.fericire, energie: s.energie, viitor: 0 },
    viitorAjustare: 0, // efectele „viitor” din evenimente; restul Viitorului se calculează
    ascunse: { skill: s.skill, scorCredit: s.scorCredit, retea: s.retea, reputatie: s.reputatie },

    numerar: inBani(s.numerar),
    produse: [],
    recurente: [],
    situatie: { studii: null, nivelStudii: 'liceu', locuinta: 'acasa', cauzaLocuinta: null },
    stilViata: s.stilViata,
    stilAnterior: null, // nivelul de dinainte de ultima schimbare (pentru rezumatul anului)
    pensie: { luniContributie: 0, pilon2: 0, pilon3: 0 },
    indicePreturi: 1,
    piete: Object.fromEntries(CLASE_PIATA.map((c) => [c, 100])),

    flaguri: {},
    urmari: [],
    istoricEvenimente: {},
    decizii: [],
    momente: { primulSalariu: false, primaRata: false, primaPoprire: false, primaPoprireCont: false, primulAnPePlus: false },

    an: null,        // anul în curs (sloturi, acumulatori); null între ani
    pendinte: null,  // oprirea afișată acum (eveniment, moment, rezumat, final)
    coada: [],       // opriri care așteaptă după cea curentă (momente-cheie, rezumat)
    jurnal: [],
    concepte: [],
    contoare: { id: 0, decizii: 0, luniFaliment: 0 },
    // Bugetul de timp al anului: câte acțiuni mari (activități, cursuri, căutat job) ai folosit.
    timp: { an: 0, folosit: 0, activitati: {} },
    final: null,
  };
  state.pendinte = {
    tip: 'eveniment',
    eveniment: s.evenimentStart,
    luna: 0,
    eticheta: 'Vara de după bac',
    variabile: {},
    cauza: null,
  };
  actualizeazaDerivate(state, ctx);
  return state;
}

// ---------- Flag-uri ----------

export function areFlag(state, nume) {
  const f = state.flaguri[nume];
  return !!f && (f.expiraLa == null || state.luna < f.expiraLa);
}

// „nume” sau „nume:12” (expiră după 12 luni)
export function seteazaFlag(state, spec) {
  const [nume, durata] = spec.split(':');
  state.flaguri[nume] = { setatLa: state.luna, expiraLa: durata ? state.luna + Number(durata) : null };
}

export function expiraFlaguri(state) {
  for (const [nume, f] of Object.entries(state.flaguri)) {
    if (f.expiraLa != null && state.luna >= f.expiraLa) delete state.flaguri[nume];
  }
}

// ---------- Valori derivate ----------

export function cheltuieliLunare(state, ctx) {
  let total = Math.round(pret(state, ctx, 'costTrai.mancareTransport') * multiplicatorStil(state, ctx));
  for (const suma of Object.values(facturiLunare(state, ctx))) total += suma;
  for (const r of state.recurente) if (r.tip === 'cheltuiala') total += r.suma;
  for (const p of state.produse) if (p.tip === 'credit' && p.stadiu === 'activ') total += Math.min(p.rata, p.rest);
  return total;
}

export function nivelStil(ctx, id) {
  return bal(ctx, 'stilViata.niveluri').find((n) => n.id === id);
}

export function multiplicatorStil(state, ctx, id = state.stilViata) {
  return nivelStil(ctx, id)?.multiplicator ?? 1;
}

// Schimbă stilul de viață (id sau +1/-1). Întoarce { schimbat, sus, nivel }.
export function schimbaStil(state, ctx, tinta) {
  const niveluri = bal(ctx, 'stilViata.niveluri');
  const i = niveluri.findIndex((n) => n.id === state.stilViata);
  const j = typeof tinta === 'number' ? clamp(i + tinta, 0, niveluri.length - 1) : niveluri.findIndex((n) => n.id === tinta);
  if (j < 0 || j === i) return { schimbat: false, nivel: niveluri[i] };
  state.stilAnterior = state.stilViata;
  state.stilViata = niveluri[j].id;
  // Adaptarea hedonică: efectul se estompează singur, pentru că Fericirea revine lunar spre țintă.
  const efect = bal(ctx, j > i ? 'stilViata.fericireLaCrestere' : 'stilViata.fericireLaScadere');
  state.stat.fericire = clamp(state.stat.fericire + efect, 0, 100);
  return { schimbat: true, sus: j > i, nivel: niveluri[j] };
}

export function datoriiTotale(state) {
  return state.produse.reduce((s, p) => s + datorieProdus(p), 0);
}

export function activeTotale(state) {
  return state.numerar + state.produse.reduce((s, p) => s + valoareProdus(p, state), 0) + state.pensie.pilon2 + (state.pensie.pilon3 ?? 0);
}

export const avereNeta = (state) => activeTotale(state) - datoriiTotale(state);

// Ce poți vinde sau retrage ca să plătești datoriile (fără contul curent și fără Pilonul II).
export function activeLichidabile(state) {
  return state.produse.filter((p) => p.tip !== 'contCurent').reduce((s, p) => s + valoareProdus(p, state), 0);
}

export function economiiLungTermen(state) {
  return state.produse
    .filter((p) => p.tip !== 'contCurent')
    .reduce((s, p) => s + valoareProdus(p, state), 0) + state.pensie.pilon2 + (state.pensie.pilon3 ?? 0);
}

export function calculeazaStatistici(state, ctx) {
  const b = bal(ctx, 'statistici');
  const cheltuieli = Math.max(1, cheltuieliLunare(state, ctx));
  const lichid = baniDisponibili(state);
  state.stat.bani = clamp(Math.round((lichid / cheltuieli / b.baniLuniPentru100) * 100), 0, 100);

  const luniEconomii = economiiLungTermen(state) / cheltuieli;
  const dinEconomii = Math.min(60, (luniEconomii / b.viitorLuniEconomiiPentru60) * 60);
  const dinStudii = b.viitorStudii[state.situatie.nivelStudii] ?? 0;
  const dinPensie = Math.min(b.viitorPensieMax, (state.pensie.luniContributie / (40 * 12)) * b.viitorPensieMax);
  const dinDatorii = Math.min(30, (datoriiTotale(state) / cheltuieli) * 2);
  state.stat.viitor = clamp(Math.round(dinEconomii + dinStudii + dinPensie - dinDatorii + state.viitorAjustare), 0, 100);

  state.stat.fericire = clamp(state.stat.fericire, 0, 100);
  state.stat.energie = clamp(state.stat.energie, 0, 100);
  for (const k of Object.keys(state.ascunse)) state.ascunse[k] = clamp(state.ascunse[k], 0, 100);
}

// Faza: după situație, cu vârsta ca prag minim. Nu scade niciodată.
export function calculeazaFaza(state, ctx) {
  const f = bal(ctx, 'faze');
  const varsta = varstaLa(state.luna);
  let faza = state.luna >= 12 ? 2 : 1;
  for (const [nr, varstaMin] of Object.entries(f.varstaMinima)) {
    if (varsta >= varstaMin) faza = Math.max(faza, Number(nr));
  }
  const contract = state.produse.find((p) => p.tip === 'contractMunca');
  const job = contract && ctx.joburi.get(contract.jobId);
  if (job?.program === 'full-time' && !state.situatie.studii) {
    faza = Math.max(faza, 3);
    if (varsta >= f.faza4VarstaMin && state.pensie.luniContributie >= f.faza4LuniVechime) faza = Math.max(faza, 4);
  }
  return Math.max(state.faza, faza);
}

export function actualizeazaDerivate(state, ctx) {
  calculeazaStatistici(state, ctx);
  state.faza = calculeazaFaza(state, ctx);
}

// extra: { tip: 'datorie', cauza: idDecizie } leagă intrarea de lanțul din „Ce s-a întâmplat?”.
export function adaugaJurnal(state, text, extra = {}) {
  const luna = extra.luna ?? state.luna;
  if (extra.tip === 'datorie') {
    // Aceeași consecință (fără sume) în ultimele 6 luni? Nu o mai repetăm: jurnalul rămâne lizibil.
    const cheie = text.replace(/[\d.,]+ lei/g, '');
    if (state.jurnal.some((j) => j.tip === 'datorie' && luna - j.luna < 6 && j.text.replace(/[\d.,]+ lei/g, '') === cheie)) return;
  }
  state.jurnal.push({ luna, varsta: varstaLa(luna), numeLuna: numeLuna(luna), text, ...(extra.tip ? { tip: extra.tip, cauza: extra.cauza ?? null } : {}) });
}

export function rezumatFinanciar(state, ctx) {
  return {
    numerar: state.numerar,
    contCurent: contCurent(state)?.sold ?? 0,
    disponibil: baniDisponibili(state),
    economii: economiiLungTermen(state),
    datorii: datoriiTotale(state),
    avereNeta: avereNeta(state),
    cheltuieliLunare: cheltuieliLunare(state, ctx),
  };
}

// ---------- Salvare ----------

export function salveazaJoc(storage, state) {
  return storage.scrie(CHEI.salvare, state);
}

export function incarcaJoc(storage) {
  return migreaza(storage.citeste(CHEI.salvare));
}

export function stergeJoc(storage) {
  storage.sterge(CHEI.salvare);
  storage.sterge(CHEI.checkpointuri);
}

// Checkpoint ÎNAINTE de o decizie. Se păstrează ultimele `recente` plus cele mai noi checkpoint-uri
// ale deciziilor care au deschis o datorie, în total cel mult `max`.
export function adaugaCheckpoint(storage, state, eticheta, { decizie = null, datorie = false, recente = 5, max = 10 } = {}) {
  const lista = storage.citeste(CHEI.checkpointuri, []);
  lista.push({ id: `c${state.luna}-${state.contoare.decizii}`, eticheta, decizie, datorie, luna: state.luna, varsta: varstaLa(state.luna), stare: cloneaza(state) });
  const pastrate = new Set(lista.slice(-recente));
  for (const cp of [...lista].reverse()) {
    if (pastrate.size >= max) break;
    if (cp.datorie) pastrate.add(cp);
  }
  storage.scrie(CHEI.checkpointuri, lista.filter((cp) => pastrate.has(cp)));
}

export function listaCheckpointuri(storage) {
  return storage.citeste(CHEI.checkpointuri, []).map(({ stare, ...rest }) => rest);
}

export function incarcaCheckpoint(storage, id) {
  const cp = storage.citeste(CHEI.checkpointuri, []).find((c) => c.id === id);
  return cp ? migreaza(cloneaza(cp.stare)) : null;
}

// Finalurile descoperite sunt globale (colecția). Întoarce true dacă finalul e nou.
export function deblocheazaFinal(storage, id) {
  const lista = storage.citeste(CHEI.achievements, []);
  if (lista.includes(id)) return false;
  storage.scrie(CHEI.achievements, [...lista, id]);
  return true;
}

// Clasament local: cele mai bune 10 vieți de pe acest dispozitiv, după averea în lei de azi.
export function adaugaInClasament(storage, intrare) {
  const lista = [...storage.citeste(CHEI.clasament, []), intrare].sort((a, b) => b.avereAzi - a.avereAzi).slice(0, 10);
  storage.scrie(CHEI.clasament, lista);
  return lista;
}

// Enciclopedia e globală (rămâne deblocată între vieți).
export function deblocheazaConcepteGlobal(storage, ids) {
  if (!ids.length) return;
  const toate = new Set(storage.citeste(CHEI.concepte, []));
  ids.forEach((id) => toate.add(id));
  storage.scrie(CHEI.concepte, [...toate]);
}
