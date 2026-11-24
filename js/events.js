// Evenimente: condiții, variabile, selecție, aplicarea alegerilor, flag-uri, urmări programate.

import { bal, cfg, clamp, dupaCale, formateazaLei, inBani, inLei, varstaLa } from './util.js';
import { aleator, alegePonderat, intreg, sansa } from './rng.js';
import {
  baniDisponibili, cardDisponibil, fluturas, contCurent, creeazaProdus, datorieProdus, fondUrgenta,
  incaseaza, ircc, luniCreditDupaVarsta, plataMinimaCard, plateste, pret, rataAnuitate, rataLunara, valoareProdus, valoareVanzare,
} from './finance.js';
import { actualizeazaDerivate, adaugaJurnal, areFlag, cheltuieliLunare, schimbaStil, seteazaFlag } from './state.js';
import { estimeazaPensie, inregistreazaDecizie, venitPasivLunar } from './bilant.js';
import {
  areJobFullTime, cereMarire, descriereOferta, genereazaOferte, jobCurent, negociaza, promovareDisponibila, promoveaza, schimbaJob,
} from './cariera.js';

// ---------- Produse după selector ----------
// Selector: „cardCredit”, „credit:ifn” (tip:furnizor), „contCurent:tineri” (tip:pachet), „investitie:etf” (tip:clasa)

export function potrivesteProdus(p, selector) {
  const [tip, detaliu] = selector.split(':');
  if (p.tip !== tip) return false;
  return !detaliu || p.furnizor === detaliu || p.pachet === detaliu || p.clasa === detaliu;
}

// Asigurat medical: contract de muncă sau PFA (plătești CASS), student, sau imediat după concediere (șomaj).
export function gradIndatorare(state, ctx, { suma, luni, dae }) {
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  const net = c && c.contract !== 'negru' ? fluturas(c.brut, c.contract, ctx).net : 0;
  const daeEfectiv = dae ?? cfg(ctx, 'ipotecar.marjaVariabila') + ircc(state, ctx);
  const rataNoua = rataAnuitate(suma, rataLunara(daeEfectiv), luniCreditDupaVarsta(state, ctx, luni));
  // Ratele existente: toate creditele (și IFN-urile, banca le vede la Biroul de Credit) și plata minimă la card.
  const existente = state.produse.reduce((t, p) => t
    + (p.tip === 'credit' && p.stadiu === 'activ' ? Math.min(p.rata, p.rest) : 0)
    + (p.tip === 'cardCredit' ? plataMinimaCard(p.soldScadent, ctx) : 0), 0);
  return { net, rataNoua, grad: net ? (existente + rataNoua) / net : Infinity };
}

export function esteAsigurat(state) {
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  return (c && c.contract !== 'negru') || !!state.situatie.studii || areFlag(state, 'somaj');
}

export const gasesteProduse = (state, selector) => state.produse.filter((p) => potrivesteProdus(p, selector));
export const economii = (state) => gasesteProduse(state, 'contEconomii').reduce((s, p) => s + p.sold, 0);
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
  salariuNet: (s, _sel, ctx) => {
    const c = s.produse.find((p) => p.tip === 'contractMunca');
    return c ? fluturas(c.brut, c.contract, ctx).net : 0;
  },
  venitPasiv: (s, _sel, ctx) => venitPasivLunar(s, ctx),
  cheltuieli: (s, _sel, ctx) => cheltuieliLunare(s, ctx),
  dobandaIpoteca: (s) => gasesteProduse(s, 'credit:banca').filter((c) => c.luni >= 240).reduce((t, c) => t + Math.max(0, c.rata * c.luniRamase - c.rest), 0),
  pensieEstimata: (s, _sel, ctx) => estimeazaPensie(s, ctx).pilon1,
  datorieFacturi: (s) => gasesteProduse(s, 'factura').reduce((t, f) => t + f.restanta, 0),
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
    } else if (def.startsWith('pret:')) {
      // „pret:cale” sau „pret:cale*0.15”: valoare din config.json, la prețurile de azi din joc (cu inflația)
      const [cale, factor] = def.slice(5).split('*');
      vars[nume] = rotunjeste10(dupaCale(ctx.config, cale) * (factor ? Number(factor) : 1) * state.indicePreturi);
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
  return text.replace(/\{(\w+)\}/g, (tot, nume) => (nume in vars ? (typeof vars[nume] === 'string' ? vars[nume] : formateazaLei(vars[nume])) : tot));
}

// ---------- Condiții ----------

const NUME_PRODUSE = {
  contCurent: 'cont curent', contEconomii: 'cont de economii', depozit: 'depozit', cardCredit: 'card de credit',
  credit: 'credit', investitie: 'investiții', poprire: 'poprire', contractMunca: 'job', factura: 'facturi restante',
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
    economiiMin: (v) => economii(state) >= inBani(val(v)) || `N-ai ${lei(val(v))} puși deoparte.`,
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
    areOferta: (n) => vars[`brut${n}`] != null || 'CV-ul n-a convins destui angajatori pentru încă o ofertă.',
    jobProgram: (lista) => lista.includes(jobCurent(state, ctx)?.program ?? 'niciunul') || 'Nu se potrivește cu programul tău de lucru.',
    inStudii: (da) => !!state.situatie.studii === da || (da ? 'Nu ești la studii.' : 'Încă ești la studii.'),
    // Gradul de îndatorare: (ratele existente + rata creditului nou) / venitul net din salariu.
    indatorare: (spec) => {
      const r = gradIndatorare(state, ctx, { suma: inBani(val(spec.suma)), luni: spec.luni, dae: spec.variabila ? null : val(spec.dae) });
      if (r.net === 0) return 'Banca te refuză: n-ai un venit din salariu pe care să-l poată verifica.';
      const max = cfg(ctx, 'indatorare.gradMaxim');
      return r.grad <= max || `Banca te refuză: rata ar fi ${lei(Math.round(inLei(r.rataNoua)))}, iar toate ratele ar lua ${Math.round(r.grad * 100)}% din venitul tău net (maximul e ${Math.round(max * 100)}%).`;
    },
    asigurat: (da) => esteAsigurat(state, ctx) === da || (da ? 'Nu ești asigurat medical: lucrezi fără contract.' : 'Ești asigurat medical.'),
    stilViata: (lista) => lista.includes(state.stilViata) || 'Nu se potrivește cu stilul tău de viață.',
    promovareDisponibila: (da) => promovareDisponibila(state, ctx) === da || 'Nu e momentul pentru o promovare.',
    sau: (variante) => variante.some((c) => motivNeindeplinire(c, state, ctx, vars) == null) || 'Nu e cazul acum.',
  };
  for (const [cheie, valoare] of Object.entries(cond)) {
    if (cheie === 'motiv') continue;
    const r = verificari[cheie](valoare);
    // Îndatorarea are mereu mesajul ei, cu cifre; „motiv” din JSON acoperă doar celelalte condiții.
    if (r !== true) return cond.motiv && cheie !== 'indatorare' ? textCuVariabile(cond.motiv, vars) : r;
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
  const oprire = { tip: 'eveniment', eveniment: ev.id, luna: state.luna, variabile: rezolvaVariabile(ev, state, ctx, variabile), cauza };
  if (ev.oferte) adaugaOferte(oprire, state, ctx);
  return oprire;
}

// Evenimentele cu "oferte": true primesc 0–3 oferte generate din CV, ca variabile {oferta1}, {brut1} ...
function adaugaOferte(oprire, state, ctx) {
  oprire.oferte = genereazaOferte(state, ctx);
  oprire.oferte.forEach((o, i) => {
    oprire.variabile[`oferta${i + 1}`] = descriereOferta(o);
    oprire.variabile[`brut${i + 1}`] = Math.round(o.brut / 100);
  });
}

// Ce vede UI-ul: textul final și alegerile, cu cele indisponibile marcate.
// O alegere cu „subalegeri” e un grup: se deschide al doilea pas, iar calea finală e „grup/sub”.
export function descrieOprire(oprire, state, ctx) {
  const ev = ctx.evenimente.get(oprire.eveniment);
  const vars = oprire.variabile;
  const descrie = (a, prefix = '') => {
    const motivPropriu = motivNeindeplinire(a.cere, state, ctx, vars);
    const baza = { id: a.id, cale: prefix + a.id, eticheta: textCuVariabile(a.eticheta, vars) };
    if (!a.subalegeri) return { ...baza, disponibil: motivPropriu == null, motiv: motivPropriu };
    const sub = a.subalegeri.map((s) => descrie(s, `${a.id}/`));
    if (motivPropriu) sub.forEach((s) => Object.assign(s, { disponibil: false, motiv: s.motiv ?? motivPropriu }));
    const oricare = sub.some((s) => s.disponibil);
    return {
      ...baza, grup: true, subalegeri: sub, disponibil: oricare,
      motiv: oricare ? null : motivPropriu ?? (sub.length === 1 ? sub[0].motiv : 'Nicio variantă nu e posibilă acum.'),
    };
  };
  return {
    ...oprire,
    titlu: ev.titlu ? textCuVariabile(ev.titlu, vars) : null,
    text: textCuVariabile(ev.text, vars),
    alegeri: ev.alegeri.map((a) => descrie(a)),
  };
}

// „id” sau „grup/sub” -> { alegere, cereri: [cere grup, cere alegere] }
export function gasesteAlegere(ev, cale) {
  const [idPrim, idSub] = String(cale).split('/');
  const prim = ev.alegeri.find((a) => a.id === idPrim);
  if (!prim) return null;
  if (!prim.subalegeri) return idSub ? null : { alegere: prim, cereri: [prim.cere] };
  const sub = prim.subalegeri.find((s) => s.id === idSub);
  return sub ? { alegere: sub, cereri: [prim.cere, sub.cere] } : null;
}

// ---------- Urmări ----------

export function programeazaUrmare(state, ctx, spec, cauza, vars = {}) {
  const dupa = Array.isArray(spec.dupaLuni) ? intreg(state, 'evenimente', spec.dupaLuni[0], spec.dupaLuni[1]) : (spec.dupaLuni ?? 1);
  const variabile = {};
  for (const [k, v] of Object.entries(spec.variabile ?? {})) variabile[k] = rezolvaValoare(v, vars, ctx);
  // dupaLuni: 0 = lanț imediat (ex. pașii CV-ului): cardul următor apare direct după decizie.
  state.urmari.push({ eveniment: spec.eveniment, luna: state.luna + dupa, probabilitate: spec.probabilitate ?? 1, variabile, cauza, imediat: dupa === 0 });
}

// Prima urmare scadentă care trece de probabilitate și de condiții (urmările ignoră faza și cooldown-ul).
export function extrageUrmareScadenta(state, ctx, { doarImediate = false } = {}) {
  state.urmari.sort((a, b) => a.luna - b.luna);
  for (;;) {
    const i = state.urmari.findIndex((u) => u.luna <= state.luna && (!doarImediate || u.imediat));
    if (i < 0) return null;
    const [u] = state.urmari.splice(i, 1);
    const ev = ctx.evenimente.get(u.eveniment);
    if (!ev || !sansa(state, 'evenimente', u.probabilitate)) continue;
    const vars = rezolvaVariabile(ev, state, ctx, u.variabile);
    if (!conditiiIndeplinite(ev.conditii, state, ctx, vars)) continue;
    const oprire = { tip: 'eveniment', eveniment: ev.id, luna: state.luna, variabile: vars, cauza: u.cauza };
    if (ev.oferte) adaugaOferte(oprire, state, ctx);
    return oprire;
  }
}

export function areUrmareScadenta(state) {
  return state.urmari.some((u) => u.luna <= state.luna);
}

// ---------- Aplicarea unei alegeri ----------

const CAMPURI_REZULTAT = ['efecte', 'sursaPlata', 'flaguri', 'stergeFlaguri', 'produsNou', 'lichideaza', 'ramburseaza',
  'seteazaProdus', 'transferaInCont', 'job', 'situatie', 'recurente', 'urmari', 'lectie', 'concepte', 'jurnal',
  'acceptaOferta', 'negociazaOferta', 'cereMarire', 'promovare', 'stilViata', 'etichete', 'retrageEconomii', 'retragere'];

export function aplicaAlegere(state, ctx, oprire, idAlegere) {
  const ev = ctx.evenimente.get(oprire.eveniment);
  const gasit = gasesteAlegere(ev, idAlegere);
  if (!gasit) throw new Error(`Alegere inexistentă: ${oprire.eveniment} › ${idAlegere} (pentru un grup folosește „grup/sub”)`);
  const { alegere } = gasit;
  const vars = oprire.variabile;
  for (const cere of gasit.cereri) {
    const motiv = motivNeindeplinire(cere, state, ctx, vars);
    if (motiv) throw new Error(`Alegere indisponibilă (${ev.id} › ${idAlegere}): ${motiv}`);
  }

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

  // Pentru „Ce s-a întâmplat?”: ce scria pe card, la momentul deciziei.
  const prim = ev.alegeri.find((a) => a.id === String(idAlegere).split('/')[0]);
  decizie.titlu = ev.titlu ?? ev.id;
  decizie.eticheta = [prim !== alegere ? prim.eticheta : null, alegere.eticheta].filter(Boolean).map((t) => textCuVariabile(t, vars)).join(' › ');
  const rezultat = aplicaPachet(state, ctx, pachet, vars, decizie.id, oprire);
  decizie.jurnal = rezultat.jurnal;
  inregistreazaDecizie(state, ev, String(idAlegere), pachet);
  actualizeazaDerivate(state, ctx);
  return { decizie, ...rezultat };
}

function aplicaPachet(state, ctx, p, vars, idDecizie, oprire = {}) {
  const val = (v) => rezolvaValoare(v, vars, ctx);
  const rezultat = { lectie: null, concepteNoi: [], jurnal: null, neplatit: 0 };

  if (p.lichideaza) {
    for (const sel of [p.lichideaza].flat()) for (const prod of gasesteProduse(state, sel)) lichideaza(state, ctx, prod);
  }
  for (const spec of [p.produsNou ?? []].flat()) {
    deschideProdus(state, ctx, rezolvaSpec(spec, val), idDecizie);
  }
  if (p.retrageEconomii) {
    // Mută bani din conturile de economii în portofel (întâi cele care nu sunt fond de urgență).
    let deScos = inBani(val(p.retrageEconomii));
    const conturi = gasesteProduse(state, 'contEconomii').sort((a, b) => Number(a.fondUrgenta) - Number(b.fondUrgenta));
    for (const cont of conturi) {
      const luat = Math.min(deScos, cont.sold);
      cont.sold -= luat;
      deScos -= luat;
      incaseaza(state, luat);
    }
  }
  if (p.ramburseaza) {
    // Facturile se achită toate (chirie, utilități, telefon); la celelalte, doar primul produs găsit
    // (ex. „credit:ifn” = cel mai vechi IFN, cel pe care îl acoperă al doilea IFN).
    const produse = p.ramburseaza.startsWith('factura') ? gasesteProduse(state, p.ramburseaza) : [gasesteProdus(state, p.ramburseaza)];
    for (const prod of produse.filter(Boolean)) ramburseaza(state, prod);
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
  const mesajeCariera = aplicaCariera(state, ctx, p, oprire, idDecizie);
  if (p.situatie) aplicaSituatie(state, ctx, p.situatie, idDecizie);
  for (const r of p.recurente ?? []) {
    state.recurente.push({ tip: r.tip, suma: inBani(val(r.suma)), luniRamase: r.luni ?? null, eticheta: r.eticheta, locuinta: r.locuinta ?? null, destinatie: r.destinatie ?? null, cauza: idDecizie });
  }
  if (p.stilViata !== undefined) schimbaStil(state, ctx, p.stilViata);
  if (p.retragere) state.final = { tip: 'final', motiv: 'independenta', luna: state.luna, cauza: idDecizie };
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
  // Rezultatul negocierii / măririi se știe abia acum: jurnalul și lecția vin din motor.
  if (mesajeCariera) {
    adaugaJurnal(state, mesajeCariera.jurnal);
    rezultat.jurnal = mesajeCariera.jurnal;
    if (mesajeCariera.lectie) rezultat.lectie = mesajeCariera.lectie;
  }
  return rezultat;
}

function aplicaCariera(state, ctx, p, oprire, idDecizie) {
  const oferta = (n) => oprire.oferte?.[n - 1];
  if (p.acceptaOferta) {
    const o = oferta(p.acceptaOferta);
    schimbaJob(state, ctx, { id: o.jobId, contract: o.contract, brut: o.brut }, idDecizie);
    return { jurnal: `Te-ai angajat ${o.titlu}, cu ${lei(inLei(o.brut))} brut (${o.oras}).` };
  }
  if (p.negociazaOferta) {
    const o = oferta(p.negociazaOferta);
    const r = negociaza(state, ctx, o);
    if (r.rezultat === 'retras') {
      return {
        jurnal: `Ai negociat pentru postul de ${o.titlu}, dar firma și-a retras oferta.`,
        lectie: 'Negocierea are și un risc: fără argumente (experiență, skill-uri), angajatorul poate alege pe altcineva.',
      };
    }
    const nou = schimbaJob(state, ctx, { id: o.jobId, contract: o.contract, brut: r.brut }, idDecizie);
    nou.plusNegociat = r.brut - o.brut;
    return r.rezultat === 'succes'
      ? { jurnal: `Ai negociat și te-ai angajat ${o.titlu} cu ${lei(inLei(r.brut))} brut, nu ${lei(inLei(o.brut))}.`, lectie: 'Ai cerut și ai primit. O mărire la angajare contează în fiecare an care urmează.' }
      : { jurnal: `Ai negociat, n-au cedat, dar te-ai angajat ${o.titlu} cu ${lei(inLei(r.brut))} brut.`, lectie: 'N-a mers de data asta, dar ai aflat limita lor. Să întrebi politicos nu te costă oferta de obicei.' };
  }
  if (p.cereMarire) {
    const r = cereMarire(state, ctx);
    return {
      jurnal: r.text,
      lectie: r.succes ? 'Fără mărire, inflația îți mănâncă din salariu în fiecare an. Ai cerut la momentul potrivit.' : 'Un „nu” azi nu e definitiv. Crește-ți skill-urile și mai încearcă, sau caută o ofertă mai bună.',
    };
  }
  if (p.promovare && promovareDisponibila(state, ctx)) return { jurnal: promoveaza(state, ctx, idDecizie).text };
  return null;
}

function rezolvaSpec(spec, val) {
  const r = {};
  for (const [k, v] of Object.entries(spec)) r[k] = typeof v === 'string' ? val(v) : v;
  if (r.suma != null) r.suma = inBani(r.suma);
  if (r.limita != null) r.limita = inBani(r.limita);
  if (r.valoare != null) r.valoare = inBani(r.valoare);
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
  if (prod.tip === 'investitie' && state.bilant) state.bilant.castigRealizat = (state.bilant.castigRealizat ?? 0) + (suma - (prod.cost ?? 0));
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
  } else if (prod.tip === 'factura') {
    prod.restanta -= platit;
    if (prod.restanta === 0) inchideFactura(state, prod);
  }
  return platit;
}

// Flag-ul pus de fiecare categorie de factură când restanța se agravează.
export const FLAG_FACTURA = { utilitati: 'deconectat', telefon: 'telefon_suspendat', chirie: 'somatie_chirie' };

export function inchideFactura(state, f) {
  state.produse = state.produse.filter((p) => p !== f);
  delete state.flaguri[FLAG_FACTURA[f.furnizor]];
  if (f.luniRestanta > 0) adaugaJurnal(state, `Ai achitat restanțele la ${NUME_FACTURI[f.furnizor]}.`);
}

export const NUME_FACTURI = { chirie: 'chirie', utilitati: 'utilități', telefon: 'telefon' };

export function inchideCredit(state, credit) {
  state.produse = state.produse.filter((p) => p !== credit);
  if (credit.flag && !state.produse.some((p) => p.flag === credit.flag)) delete state.flaguri[credit.flag.split(':')[0]];
  if (credit.stadiu === 'activ') {
    adaugaJurnal(state, `Ai terminat de plătit creditul de ${lei(inLei(credit.sumaInitiala))}. Ai dat înapoi în total ${lei(inLei(credit.totalPlatit))}.`);
  }
}

function aplicaSituatie(state, ctx, sit, idDecizie) {
  if (sit.locuinta) {
    state.situatie.locuinta = sit.locuinta;
    state.situatie.cauzaLocuinta = idDecizie; // restanțele la chirie/utilități pornesc de aici
  }
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
