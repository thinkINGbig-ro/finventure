// Evenimente: condiții, variabile, selecție, aplicarea alegerilor, flag-uri, urmări programate.

import { bal, clamp, dupaCale, formateazaLei, inBani, inLei, varstaLa } from './util.js';
import { aleator, alegePonderat, intreg, sansa } from './rng.js';
import {
  baniDisponibili, cardDisponibil, contCurent, creeazaProdus, datorieProdus, fondUrgenta,
  incaseaza, plataMinimaCard, plateste, pret, valoareProdus, valoareVanzare,
} from './finance.js';
import { actualizeazaDerivate, adaugaJurnal, areFlag, seteazaFlag } from './state.js';

// ---------- Produse după selector ----------
// Selector: „cardCredit”, „credit:ifn” (tip:furnizor), „contCurent:tineri” (tip:pachet), „investitie:etf” (tip:clasa)

export function potrivesteProdus(p, selector) {
  const [tip, detaliu] = selector.split(':');
  if (p.tip !== tip) return false;
  return !detaliu || p.furnizor === detaliu || p.pachet === detaliu || p.clasa === detaliu;
}

export const gasesteProduse = (state, selector) => state.produse.filter((p) => potrivesteProdus(p, selector));
export const gasesteProdus = (state, selector) => gasesteProduse(state, selector)[0];

// ---------- Variabile ----------
// În JSON: „variabile”: { "suma": 2000 } (lei la prețurile de start, ajustați cu inflația),
// „config:cale”, „balans:cale” sau „stare:…” (vezi STARE). Se folosesc ca „{suma}” în text și în valori.

const STARE = {
  numerarCash: (s) => s.numerar,
  bani: (s) => baniDisponibili(s),
  fondUrgenta: (s) => fondUrgenta(s),
  datorie: (s, sel) => (gasesteProdus(s, sel) ? datorieProdus(gasesteProdus(s, sel)) : 0),
  restanta: (s, sel) => gasesteProdus(s, sel)?.restanta ?? 0,
  soldCard: (s) => gasesteProdus(s, 'cardCredit')?.soldScadent ?? 0,
  minimCard: (s, _sel, ctx) => plataMinimaCard(gasesteProdus(s, 'cardCredit')?.soldScadent ?? 0, ctx),
};
export const SURSE_STARE = Object.keys(STARE);
const RE_STARE = /^stare:([a-zA-Z]+)(?::([a-zA-Z]+(?::[a-zA-Z]+)?))?(?:\*([\d.]+))?$/;

function rotunjeste10(lei) {
  return Math.max(10, Math.round(lei / 10) * 10);
}

export function rezolvaVariabile(ev, state, ctx, suprascrieri = {}) {
  const vars = {};
  for (const [nume, def] of Object.entries(ev.variabile ?? {})) {
    if (nume in suprascrieri) continue;
    if (typeof def === 'number') {
      vars[nume] = rotunjeste10(def * state.indicePreturi);
    } else if (def.startsWith('stare:')) {
      const [, sursa, sel, mult] = def.match(RE_STARE);
      vars[nume] = Math.round(inLei(STARE[sursa](state, sel, ctx)) * (mult ? Number(mult) : 1));
    } else {
      vars[nume] = rezolvaValoare(def, {}, ctx);
    }
  }
  return { ...vars, ...suprascrieri };
}

// Valoare numerică dintr-un câmp JSON: număr, „{var}”, „-{var}”, „config:…”, „balans:…”.
export function rezolvaValoare(v, vars, ctx) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-)?\{(\w+)\}$/);
  if (m) {
    if (!(m[2] in vars)) throw new Error(`Variabilă nedefinită: ${m[2]}`);
    return m[1] ? -vars[m[2]] : vars[m[2]];
  }
  if (v.startsWith('config:')) return dupaCale(ctx.config, v.slice(7));
  if (v.startsWith('balans:')) return dupaCale(ctx.balans, v.slice(7));
  return v;
}

export function textCuVariabile(text, vars) {
  return text.replace(/\{(\w+)\}/g, (tot, nume) => (nume in vars ? formateazaLei(vars[nume]) : tot));
}

// ---------- Condiții ----------

const NUME_PRODUSE = {
  contCurent: 'cont curent', contEconomii: 'cont de economii', depozit: 'depozit', cardCredit: 'card de credit',
  credit: 'credit', investitie: 'investiții', poprire: 'poprire', contractMunca: 'job',
};
const MOTIVE_STAT = {
  skill: 'Nu ai destulă pregătire pentru asta.',
  scorCredit: 'Istoricul tău de credit nu te ajută.',
  retea: 'Nimeni din jur nu te poate ajuta acum.',
  reputatie: 'Nu ai încă reputația necesară.',
  fericire: 'Nu ai chef de așa ceva acum.',
  energie: 'Ești prea obosit pentru asta.',
  bani: 'Nu-ți permiți acum.',
  viitor: 'Nu ești pregătit pentru asta.',
};
const lei = (x) => `${formateazaLei(x)} lei`;

// Întoarce null dacă e îndeplinită, altfel motivul (text pentru jucător).
export function motivNeindeplinire(cond, state, ctx, vars = {}) {
  if (!cond) return null;
  const val = (v) => rezolvaValoare(v, vars, ctx);
  const varsta = varstaLa(state.luna);
  const contract = state.produse.find((p) => p.tip === 'contractMunca');
  const verificari = {
    varstaMin: (n) => varsta >= n || `Ai nevoie de cel puțin ${n} ani.`,
    varstaMax: (n) => varsta <= n || `Doar până la ${n} ani.`,
    faza: (lista) => lista.includes(state.faza) || 'Nu e momentul potrivit.',
    flag: (lista) => lista.every((f) => areFlag(state, f)) || 'Nu e cazul acum.',
    lipsaFlag: (lista) => lista.every((f) => !areFlag(state, f)) || 'Nu e cazul acum.',
    stat: (praguri) => verificaPraguri(praguri, state.stat),
    ascunse: (praguri) => verificaPraguri(praguri, state.ascunse),
    areProdus: (lista) => {
      const lipsa = lista.find((sel) => !gasesteProdus(state, sel));
      return !lipsa || `Nu ai ${NUME_PRODUSE[lipsa.split(':')[0]] ?? lipsa}.`;
    },
    lipsaProdus: (lista) => {
      const are = lista.find((sel) => gasesteProdus(state, sel));
      return !are || `Ai deja ${NUME_PRODUSE[are.split(':')[0]] ?? are}.`;
    },
    job: (lista) => {
      const ok = lista.includes(contract?.jobId) || (lista.includes('orice') && !!contract) || (lista.includes('niciunul') && !contract);
      return ok || (contract ? 'Nu se potrivește cu jobul tău.' : 'Ai nevoie de un job.');
    },
    studii: (lista) => lista.includes(state.situatie.studii?.id) || lista.includes(state.situatie.nivelStudii) || 'Nu se potrivește cu studiile tale.',
    locuinta: (lista) => lista.includes(state.situatie.locuinta) || 'Nu se potrivește cu locul unde stai.',
    numerarMin: (v) => state.numerar >= inBani(val(v)) || `Nu ai ${lei(val(v))} cash.`,
    baniMin: (v) => baniDisponibili(state) >= inBani(val(v)) || `Nu ai ${lei(val(v))} disponibili.`,
    fondUrgentaMin: (v) => {
      if (!state.produse.some((p) => p.tip === 'contEconomii' && p.fondUrgenta)) return 'Nu ai un fond de urgență.';
      return fondUrgenta(state) >= inBani(val(v)) || `Fondul de urgență nu ajunge (ai ${lei(inLei(fondUrgenta(state)))}).`;
    },
    depoziteMin: (v) => {
      const total = gasesteProduse(state, 'depozit').reduce((s, d) => s + d.sold, 0);
      if (!total) return 'Nu ai niciun depozit.';
      return total >= inBani(val(v)) || `Depozitele tale nu ajung (ai ${lei(inLei(total))}).`;
    },
    cardDisponibilMin: (v) => {
      const card = gasesteProdus(state, 'cardCredit');
      if (!card) return 'Nu ai card de credit.';
      return cardDisponibil(card) >= inBani(val(v)) || 'Limita cardului nu ajunge.';
    },
    poateRambursa: (sel) => {
      const p = gasesteProdus(state, sel);
      if (!p) return `Nu ai ${NUME_PRODUSE[sel.split(':')[0]] ?? sel}.`;
      return baniDisponibili(state) >= datorieProdus(p) || `Nu ai ${lei(inLei(datorieProdus(p)))} disponibili.`;
    },
    sau: (variante) => variante.some((c) => motivNeindeplinire(c, state, ctx, vars) == null) || 'Nu e cazul acum.',
  };
  for (const [cheie, valoare] of Object.entries(cond)) {
    if (cheie === 'motiv') continue;
    const r = verificari[cheie](valoare);
    if (r !== true) return cond.motiv ? textCuVariabile(cond.motiv, vars) : r;
  }
  return null;
}

function verificaPraguri(praguri, valori) {
  for (const [k, { min, max }] of Object.entries(praguri)) {
    if ((min != null && valori[k] < min) || (max != null && valori[k] > max)) return MOTIVE_STAT[k] ?? 'Nu e cazul acum.';
  }
  return true;
}

export const conditiiIndeplinite = (cond, state, ctx, vars) => motivNeindeplinire(cond, state, ctx, vars) == null;

// ---------- Selecție ----------

export function eEligibil(ev, state, ctx) {
  if (ev.doarUrmare || !ev.faza.includes(state.faza)) return false;
  const istoric = state.istoricEvenimente[ev.id] ?? [];
  if (ev.maxAparitii != null && istoric.length >= ev.maxAparitii) return false;
  const cooldown = ev.cooldownLuni ?? bal(ctx, 'evenimente.cooldownImplicitLuni');
  if (istoric.length && state.luna - istoric[istoric.length - 1] < cooldown) return false;
  return conditiiIndeplinite(ev.conditii, state, ctx, rezolvaVariabile(ev, state, ctx));
}

export function alegeEvenimentAleator(state, ctx) {
  const eligibile = [...ctx.evenimente.values()].filter((ev) => eEligibil(ev, state, ctx));
  return alegePonderat(state, 'evenimente', eligibile, (ev) => ev.pondere ?? 1);
}

// Construiește oprirea pentru un eveniment (variabilele se fixează acum, ca textul să nu se schimbe).
export function creeazaOprireEveniment(ev, state, ctx, { cauza = null, variabile = {} } = {}) {
  return { tip: 'eveniment', eveniment: ev.id, luna: state.luna, variabile: rezolvaVariabile(ev, state, ctx, variabile), cauza };
}

// Ce vede UI-ul: textul final și alegerile, cu cele indisponibile marcate.
export function descrieOprire(oprire, state, ctx) {
  const ev = ctx.evenimente.get(oprire.eveniment);
  const vars = oprire.variabile;
  return {
    ...oprire,
    titlu: ev.titlu ? textCuVariabile(ev.titlu, vars) : null,
    text: textCuVariabile(ev.text, vars),
    alegeri: ev.alegeri.map((a) => {
      const motiv = motivNeindeplinire(a.cere, state, ctx, vars);
      return { id: a.id, eticheta: textCuVariabile(a.eticheta, vars), disponibil: motiv == null, motiv };
    }),
  };
}

// ---------- Urmări ----------

export function programeazaUrmare(state, ctx, spec, cauza, vars = {}) {
  const dupa = Array.isArray(spec.dupaLuni) ? intreg(state, 'evenimente', spec.dupaLuni[0], spec.dupaLuni[1]) : (spec.dupaLuni ?? 1);
  const variabile = {};
  for (const [k, v] of Object.entries(spec.variabile ?? {})) variabile[k] = rezolvaValoare(v, vars, ctx);
  state.urmari.push({ eveniment: spec.eveniment, luna: state.luna + dupa, probabilitate: spec.probabilitate ?? 1, variabile, cauza });
}

// Prima urmare scadentă care trece de probabilitate și de condiții (urmările ignoră faza și cooldown-ul).
export function extrageUrmareScadenta(state, ctx) {
  state.urmari.sort((a, b) => a.luna - b.luna);
  while (state.urmari.length && state.urmari[0].luna <= state.luna) {
    const u = state.urmari.shift();
    const ev = ctx.evenimente.get(u.eveniment);
    if (!ev || !sansa(state, 'evenimente', u.probabilitate)) continue;
    const vars = rezolvaVariabile(ev, state, ctx, u.variabile);
    if (!conditiiIndeplinite(ev.conditii, state, ctx, vars)) continue;
    return { tip: 'eveniment', eveniment: ev.id, luna: state.luna, variabile: vars, cauza: u.cauza };
  }
  return null;
}

export function areUrmareScadenta(state) {
  return state.urmari.some((u) => u.luna <= state.luna);
}

// ---------- Aplicarea unei alegeri ----------

const CAMPURI_REZULTAT = ['efecte', 'sursaPlata', 'flaguri', 'stergeFlaguri', 'produsNou', 'lichideaza', 'ramburseaza',
  'seteazaProdus', 'transferaInCont', 'job', 'situatie', 'recurente', 'urmari', 'lectie', 'concepte', 'jurnal'];

export function aplicaAlegere(state, ctx, oprire, idAlegere) {
  const ev = ctx.evenimente.get(oprire.eveniment);
  const alegere = ev.alegeri.find((a) => a.id === idAlegere);
  if (!alegere) throw new Error(`Alegere inexistentă: ${oprire.eveniment}/${idAlegere}`);
  const vars = oprire.variabile;
  const motiv = motivNeindeplinire(alegere.cere, state, ctx, vars);
  if (motiv) throw new Error(`Alegere indisponibilă (${ev.id}/${idAlegere}): ${motiv}`);

  const decizie = { id: `d${++state.contoare.decizii}`, luna: state.luna, eveniment: ev.id, alegere: idAlegere, cauza: oprire.cauza };
  state.decizii.push(decizie);
  (state.istoricEvenimente[ev.id] ??= []).push(state.luna);

  let pachet = alegere;
  if (alegere.rezultate) {
    const r = alegePonderat(state, 'evenimente', alegere.rezultate, (x) => x.pondere ?? 1);
    pachet = { ...alegere };
    for (const c of CAMPURI_REZULTAT) if (c in r) pachet[c] = r[c];
    decizie.rezultat = alegere.rezultate.indexOf(r);
  }

  const rezultat = aplicaPachet(state, ctx, pachet, vars, decizie.id);
  actualizeazaDerivate(state, ctx);
  return { decizie, ...rezultat };
}

function aplicaPachet(state, ctx, p, vars, idDecizie) {
  const val = (v) => rezolvaValoare(v, vars, ctx);
  const rezultat = { lectie: null, concepteNoi: [], jurnal: null, neplatit: 0 };

  if (p.lichideaza) {
    for (const prod of gasesteProduse(state, p.lichideaza)) lichideaza(state, ctx, prod);
  }
  for (const spec of [p.produsNou ?? []].flat()) {
    deschideProdus(state, ctx, rezolvaSpec(spec, val), idDecizie);
  }
  if (p.ramburseaza) {
    const prod = gasesteProdus(state, p.ramburseaza);
    if (prod) ramburseaza(state, prod);
  }

  const e = p.efecte ?? {};
  if (e.numerar) {
    const suma = inBani(val(e.numerar));
    if (suma > 0) incaseaza(state, suma, { cash: p.sursaPlata === 'cash' });
    else rezultat.neplatit = -suma - plateste(state, -suma, p.sursaPlata ?? 'portofel');
  }
  for (const k of ['fericire', 'energie']) if (e[k]) state.stat[k] = clamp(state.stat[k] + val(e[k]), 0, 100);
  for (const k of ['skill', 'scorCredit', 'retea', 'reputatie']) if (e[k]) state.ascunse[k] = clamp(state.ascunse[k] + val(e[k]), 0, 100);
  if (e.viitor) state.viitorAjustare += val(e.viitor);

  for (const [sel, campuri] of Object.entries(p.seteazaProdus ?? {})) {
    for (const prod of gasesteProduse(state, sel)) Object.assign(prod, campuri);
  }
  if (p.transferaInCont) {
    const cont = contCurent(state);
    if (cont) {
      const suma = p.transferaInCont === 'tot' ? state.numerar : Math.min(state.numerar, inBani(val(p.transferaInCont)));
      state.numerar -= suma;
      cont.sold += suma;
    }
  }
  if (p.job !== undefined) schimbaJob(state, ctx, p.job, idDecizie);
  if (p.situatie) aplicaSituatie(state, ctx, p.situatie);
  for (const r of p.recurente ?? []) {
    state.recurente.push({ tip: r.tip, suma: inBani(val(r.suma)), luniRamase: r.luni ?? null, eticheta: r.eticheta, cauza: idDecizie });
  }
  for (const f of p.flaguri ?? []) seteazaFlag(state, f);
  for (const f of p.stergeFlaguri ?? []) delete state.flaguri[f];
  for (const u of p.urmari ?? []) programeazaUrmare(state, ctx, u, idDecizie, vars);

  for (const c of p.concepte ?? []) {
    if (!state.concepte.includes(c)) {
      state.concepte.push(c);
      rezultat.concepteNoi.push(c);
    }
  }
  if (p.jurnal) {
    rezultat.jurnal = textCuVariabile(p.jurnal, vars);
    adaugaJurnal(state, rezultat.jurnal);
  }
  if (p.lectie) rezultat.lectie = textCuVariabile(p.lectie, vars);
  return rezultat;
}

function rezolvaSpec(spec, val) {
  const r = {};
  for (const [k, v] of Object.entries(spec)) r[k] = typeof v === 'string' ? val(v) : v;
  if (r.suma != null) r.suma = inBani(r.suma);
  if (r.limita != null) r.limita = inBani(r.limita);
  return r;
}

// Deschide un produs dintr-un eveniment sau din meniu. Creditele se încasează,
// depozitele și investițiile se plătesc din portofel.
export function deschideProdus(state, ctx, spec, cauza = null) {
  const sePlateste = ['depozit', 'investitie', 'contEconomii'].includes(spec.tip) && spec.suma > 0;
  if (sePlateste && baniDisponibili(state) < spec.suma) return null;
  const prod = creeazaProdus({ ...spec, cauza }, state, ctx);
  if (sePlateste) plateste(state, spec.suma);
  if (prod.tip === 'credit') {
    incaseaza(state, prod.sumaInitiala);
    if (prod.flag) seteazaFlag(state, prod.flag);
  }
  state.produse.push(prod);
  return prod;
}

// Depozit spart înainte de termen: primești doar suma depusă, dobânda acumulată se pierde.
// Investiție de piață: comision de vânzare + impozit pe câștig.
export function lichideaza(state, ctx, prod) {
  const suma = prod.tip === 'investitie' && prod.clasa !== 'titluriStat' ? valoareVanzare(prod, state, ctx).net : valoareProdus(prod, state);
  incaseaza(state, suma);
  state.produse = state.produse.filter((p) => p !== prod);
  return suma;
}

export function ramburseaza(state, prod) {
  const datorie = datorieProdus(prod);
  const platit = plateste(state, datorie);
  if (prod.tip === 'credit') {
    prod.totalPlatit += platit;
    const dinRestanta = Math.min(prod.restanta, platit);
    prod.restanta -= dinRestanta;
    prod.rest -= platit - dinRestanta;
    if (datorieProdus(prod) === 0) inchideCredit(state, prod);
  } else if (prod.tip === 'cardCredit') {
    const dinScadent = Math.min(prod.soldScadent, platit);
    prod.soldScadent -= dinScadent;
    prod.soldNou -= platit - dinScadent;
    if (datorieProdus(prod) === 0) prod.luniRestanta = 0;
  } else if (prod.tip === 'poprire') {
    prod.datorie -= platit;
    if (prod.datorie === 0) state.produse = state.produse.filter((p) => p !== prod);
  }
  return platit;
}

export function inchideCredit(state, credit) {
  state.produse = state.produse.filter((p) => p !== credit);
  if (credit.flag && !state.produse.some((p) => p.flag === credit.flag)) delete state.flaguri[credit.flag.split(':')[0]];
  if (credit.stadiu === 'activ') {
    adaugaJurnal(state, `Ai terminat de plătit creditul de ${lei(inLei(credit.sumaInitiala))}. Ai dat înapoi în total ${lei(inLei(credit.totalPlatit))}.`);
  }
}

function schimbaJob(state, ctx, spec, cauza) {
  state.produse = state.produse.filter((p) => p.tip !== 'contractMunca');
  if (!spec) return;
  const job = ctx.joburi.get(spec.id);
  const brut = pret(state, ctx, job.salariu);
  state.produse.push(creeazaProdus({ tip: 'contractMunca', jobId: job.id, contract: spec.contract, brut, cauza }, state, ctx));
}

function aplicaSituatie(state, ctx, sit) {
  if (sit.locuinta) state.situatie.locuinta = sit.locuinta;
  if (sit.studii !== undefined) {
    state.situatie.studii = sit.studii
      ? { id: sit.studii, luniRamase: dupaCale(ctx.config, `studii.${sit.studii}.durataLuni`), inceputLa: state.luna }
      : null;
  }
}

// ---------- Lanțul de decizii („Ce s-a întâmplat?”) ----------

export function lantDecizii(state, idDecizie) {
  const dupaId = new Map(state.decizii.map((d) => [d.id, d]));
  const lant = [];
  for (let d = dupaId.get(idDecizie); d; d = dupaId.get(d.cauza)) lant.unshift(d);
  return lant;
}

// Folosit la planificarea anului: lunile (absolute) ale sloturilor de eveniment.
export function planificaSloturi(state, ctx, startAn) {
  const { sloturiMin, sloturiMax } = bal(ctx, 'evenimente');
  const n = intreg(state, 'evenimente', sloturiMin, sloturiMax);
  const luni = new Set();
  while (luni.size < n) luni.add(startAn + Math.floor(aleator(state, 'evenimente') * 12));
  return [...luni].sort((a, b) => a - b);
}
