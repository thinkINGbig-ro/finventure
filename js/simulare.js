// Simulare automată: multe vieți jucate de „profiluri” de jucător, pentru echilibrare
// și ca dovadă că jocul învață ceva (prudentul trebuie să o ducă mult mai bine decât riscantul).
// Folosită de tests/simulare.js (Node) și, mai târziu, de modul debug din browser.

import { actiune, alege, avanseaza, continua, jocNou } from './engine.js';
import { gasesteAlegere, gasesteProduse, lantDecizii } from './events.js';
import { baniDisponibili, contCurent, fluturas, fondUrgenta, pret } from './finance.js';
import { hashSeed } from './rng.js';
import { areFlag, avereNeta, cheltuieliLunare, multiplicatorStil } from './state.js';
import { areJobFullTime, contractCurent } from './cariera.js';
import { bal, cfg, inLei, varstaLa } from './util.js';
import { timpRamas } from './activitati.js';
import { consolidabile } from './datorii.js';
import { rezumatViata } from './bilant.js';
import { alegeFinal } from './finaluri.js';

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
    // Ipoteca (credit + proprietate) nu e un credit de consum: o vede trăsătura „cumparaCasa”.
    const cumparaCasa = [x.produsNou ?? []].flat().some((p) => p.tip === 'proprietate');
    for (const p of [x.produsNou ?? []].flat()) if (p.tip === 'credit' && !cumparaCasa) pune(p.furnizor === 'ifn' ? 'ifn' : 'credit');
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
    if (x.situatie?.locuinta?.startsWith('chirie')) pune('muta');
    if (x.situatie?.locuinta) pune(`locuinta:${x.situatie.locuinta}`);
    if ((x.flaguri ?? []).some((f) => f.startsWith('amanat_mutarea')) || (x.recurente ?? []).some((r) => r.locuinta === 'acasa')) pune('amanaMutarea');
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

// Activitățile din meniu, în ordinea preferată a profilului, cât mai e timp în an.
// Păstrează o acțiune de timp pentru căutatul unui job, dacă profilul o să caute.
function faActivitati(state, ctx, ids) {
  const rezerva = !areJobFullTime(state, ctx) && !state.situatie.studii && !areFlag(state, 'cautare_job') ? bal(ctx, 'timp.costCautareJob') : 0;
  for (const id of ids) {
    if (timpRamas(state, ctx) - (ctx.activitati.get(id)?.timp ?? 1) < rezerva) break;
    actiune(state, ctx, 'activitate', { activitate: id });
  }
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

// Datoriile, ca un jucător atent: eșalonează ce a ajuns la recuperatori (dacă n-o poate plăti tot)
// și dă banii în plus pe datoria cu cea mai mare DAE (avalanșă), înainte să investească.
function gestioneazaDatoriiAtent(state, ctx, rezerva) {
  for (const c of gasesteProduse(state, 'credit').filter((p) => p.stadiu === 'cesionat')) {
    if (baniDisponibili(state) >= c.restanta) actiune(state, ctx, 'ramburseaza', { id: c.id });
    else actiune(state, ctx, 'esaloneaza', { id: c.id, luni: 12 });
  }
  const scumpe = gasesteProduse(state, 'credit')
    .filter((p) => p.stadiu === 'activ' && p.furnizor !== 'ipoteca' && p.dae > 0.08 && p.rest > 0)
    .sort((x, y) => y.dae - x.dae);
  for (const c of scumpe) {
    const surplus = baniDisponibili(state) - rezerva;
    if (surplus < 20000) break;
    actiune(state, ctx, 'ramburseazaPartial', { id: c.id, suma: lei(Math.min(surplus, c.rest)), mod: 'durata' });
  }
}

// Cursurile unui jucător atent: cele gratuite oricând; cele plătite doar cu fondul de urgență complet.
function cursuriAtent(state, ctx, ids, fondComplet) {
  for (const id of ids) {
    const c = ctx.educatie.cursuri.get(id);
    if (!c || state.flaguri[c.flag]) continue;
    if (pret(state, ctx, c.pret.replace(/^pret:/, '')) > 0 && !fondComplet) continue;
    actiune(state, ctx, 'inscrieCurs', { curs: id });
  }
}

// Frugal: modest toată viața, fond de 6 luni, aproape tot restul investit în ETF.
function meniuFrugal(state, ctx) {
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
  gestioneazaDatoriiAtent(state, ctx, 3 * lunar);
  const deInvestit = baniDisponibili(state) - 3 * lunar;
  if (fondUrgenta(state) >= 6 * lunar && deInvestit > 50000) {
    actiune(state, ctx, 'deschide', { tip: 'investitie', clasa: 'etf', suma: lei(Math.round(deInvestit * 0.7)) });
  }
  if (state.stilViata !== 'modest' && fondUrgenta(state) < 6 * lunar) actiune(state, ctx, 'stilViata', { nivel: 'modest' });
  cereMarireAnual(state, ctx);
  cursuriAtent(state, ctx, ['educatie-financiara', 'engleza'], fondUrgenta(state) >= 6 * lunar);
  // Frugalul face doar ce e gratis: CV mai bun, odihnă, familie.
  faActivitati(state, ctx, [
    ...(!areFlag(state, 'cv_voluntariat') ? ['voluntariat'] : []),
    ...(!areFlag(state, 'cv_proiecte') && !state.situatie.studii ? ['proiect-personal'] : []),
    ...(state.stat.energie < 50 ? ['odihna'] : []), 'alergare', 'vizita-parinti', 'citesti-bani',
  ]);
  return cautaJobDacaTrebuie(state, ctx);
}

function asiguraFond(state, ctx) {
  let fond = state.produse.find((p) => p.tip === 'contEconomii' && p.fondUrgenta);
  if (!fond) {
    const r = actiune(state, ctx, 'deschide', { tip: 'contEconomii' });
    if (r.ok) actiune(state, ctx, 'seteaza', { id: r.produs.id, campuri: { fondUrgenta: true } });
    fond = r.produs;
  }
  return fond;
}

// Prudent (realist): bugetul 50/30/20. Fond de 6 luni întâi, apoi ~20% din venitul net investit,
// ~30% pentru dorințe (stil Confortabil când își permite, cumpărături), restul pentru necesar.
function meniuPrudent(state, ctx) {
  asiguraCont(state, ctx);
  inchideRestanteDinEconomii(state, ctx);
  const lunar = cheltuieliLunare(state, ctx);
  const fond = asiguraFond(state, ctx);
  const c = contractCurent(state);
  const netLunar = c ? fluturas(c.brut, c.contract, ctx).net : 0;

  const surplus = baniDisponibili(state) - lunar;
  if (fond && surplus > 0) {
    const pentruFond = Math.min(surplus, Math.max(0, 6 * lunar - fondUrgenta(state)));
    if (pentruFond > 100) actiune(state, ctx, 'depune', { id: fond.id, suma: lei(pentruFond) });
  }
  const fondComplet = fondUrgenta(state) >= 6 * lunar;
  gestioneazaDatoriiAtent(state, ctx, 3 * lunar);
  // Prudentul își crește valoarea pe piață: limbă străină și, fără facultate, o calificare căutată.
  cursuriAtent(state, ctx, ['educatie-financiara', 'engleza',
    ...(['liceu', 'profesionala'].includes(state.situatie.nivelStudii) && !state.situatie.studii ? ['contabilitate'] : [])], fondComplet);
  if (fondComplet && netLunar) {
    // 20%: investiții (pentru casă, prudentul le vinde la nevoie: „Vând investițiile pentru avans”)
    const deInvestit = Math.min(Math.round(0.2 * 12 * netLunar), baniDisponibili(state) - 3 * lunar);
    if (deInvestit > 50000) actiune(state, ctx, 'deschide', { tip: 'investitie', clasa: 'etf', suma: lei(deInvestit) });
    // 30%: dorințe — stil Confortabil dacă cheltuielile de bază rămân sub 80% din net
    if (state.stilViata === 'modest') {
      const mancare = pret(state, ctx, 'costTrai.mancareTransport');
      const laConfortabil = lunar + Math.round(mancare * (multiplicatorStil(state, ctx, 'confortabil') - multiplicatorStil(state, ctx)));
      if (laConfortabil <= 0.8 * netLunar) actiune(state, ctx, 'stilViata', { nivel: 'confortabil' });
    }
    // ce mai rămâne peste două luni de cheltuieli se duce pe dorințe, până la 30% din venitul anual
    // dorințele încep cu o vacanță (dacă bugetul de dorințe o acoperă), iar ce rămâne merge pe cumpărături
    let buget = Math.min(Math.round(0.3 * 12 * netLunar), baniDisponibili(state) - 3 * lunar);
    const costVacanta = pret(state, ctx, 'activitati.vacantaMare');
    if (buget >= costVacanta && actiune(state, ctx, 'activitate', { activitate: 'vacanta-mare' }).ok) buget -= costVacanta;
    if (buget > 50000) actiune(state, ctx, 'cumpara', { suma: lei(buget), fericire: 3 });
  }
  faActivitati(state, ctx, [
    ...(!areFlag(state, 'cv_voluntariat') ? ['voluntariat'] : []),
    ...(!areFlag(state, 'cv_proiecte') && !state.situatie.studii ? ['proiect-personal'] : []),
    ...(state.stat.energie < 50 ? ['odihna'] : []),
    ...(areJobFullTime(state, ctx) ? ['networking', 'control-medical'] : []), 'alergare', 'iesire-prieteni', 'citesti-bani',
  ]);
  // Bugetul: dacă cheltuielile trec de 85% din venitul net sau fondul scade sub 3 luni, coboară stilul.
  if (state.stilViata !== 'modest' && (fondUrgenta(state) < 3 * lunar || (netLunar && lunar > 0.85 * netLunar))) {
    actiune(state, ctx, 'stilViata', { nivel: state.stilViata === 'lux' ? 'confortabil' : 'modest' });
  }
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
  // Riscantul întinde datoriile pe cât mai mulți ani, ca să scadă rata (și să poată cheltui mai mult).
  const deStrans = consolidabile(state).map((p) => p.id);
  if (deStrans.length) actiune(state, ctx, 'consolideaza', { ids: deStrans, luni: 60 });
  // Riscantul își face timp de distracție, cât îl țin banii.
  faActivitati(state, ctx, ['vacanta-strainatate', 'city-break', 'iesire-prieteni', 'iesire-prieteni']);
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
  // educația: un program lung (uneori cu credit), un curs sau renunțarea la studii
  (state, ctx, rnd) => {
    const ids = [...ctx.educatie.programe.keys()];
    return actiune(state, ctx, 'inscrieProgram', { program: ids[Math.floor(rnd() * ids.length)], credit: rnd() < 0.5 });
  },
  (state, ctx, rnd) => {
    const ids = [...ctx.educatie.cursuri.keys()];
    return actiune(state, ctx, 'inscrieCurs', { curs: ids[Math.floor(rnd() * ids.length)] });
  },
  (state, ctx, rnd) => (state.situatie.studii && rnd() < 0.3 ? actiune(state, ctx, 'renuntaStudii') : null),
  // datoriile: rambursare parțială, eșalonare, consolidare, la întâmplare
  (state, ctx, rnd) => {
    const credite = gasesteProduse(state, 'credit');
    if (!credite.length) return null;
    const c = credite[Math.floor(rnd() * credite.length)];
    if (c.stadiu === 'cesionat') return actiune(state, ctx, 'esaloneaza', { id: c.id, luni: [6, 12, 24][Math.floor(rnd() * 3)] });
    return actiune(state, ctx, 'ramburseazaPartial', { id: c.id, suma: lei(Math.round(baniDisponibili(state) * rnd() * 0.5)), mod: rnd() < 0.5 ? 'rata' : 'durata' });
  },
  (state, ctx, rnd) => {
    const ids = consolidabile(state).filter(() => rnd() < 0.7).map((p) => p.id);
    return ids.length ? actiune(state, ctx, 'consolideaza', { ids, luni: [24, 36, 60][Math.floor(rnd() * 3)] }) : null;
  },
  // o activitate la întâmplare din meniu (de două ori mai probabil: e meniul cel mai des folosit)
  ...Array(2).fill((state, ctx, rnd) => {
    const ids = [...ctx.activitati.keys()];
    return actiune(state, ctx, 'activitate', { activitate: ids[Math.floor(rnd() * ids.length)] });
  }),
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

// Ponderile comune ale jucătorilor atenți la bani (prudent și frugal).
const PONDERI_ATENT = {
  ifn: -10, credit: -3, negru: -8, cim: 5, pfa: 2, oferta: 3, cardMinim: -6, cardIntegral: 5, ramburseaza: 5,
  fond: 6, lichideaza: 2, card: -3, studii: 4, minciuna: -6, marire: 4, promovare: 5, cautaJob: 3, ignora: -5, demisie: -5,
  viitor: 0.5, skill: 0.3, retea: 0.3, reputatie: 0.2, fericire: 0.15, energie: 0.15, inselatorie: -15, pariu: -6,
  panica: -8, pastreaza: 4, asigurare: 2, faraAsigurare: -2, venitExtra: 2, economisire: 3, ignoraTaxe: -6, afacere: 0,
  amanaTratament: -6,
};

export const PROFILURI = {
  aleator: { nume: 'aleator', descriere: 'alegeri și acțiuni din meniuri la întâmplare, bune și proaste', alege: alegeAleator, meniu: meniuAleator },
  prudent: {
    nume: 'prudent',
    descriere: 'bugetul 50/30/20: fond de 6 luni, ~20% investit, se mută de acasă, stil Confortabil când își permite',
    alege: alegePrinScor((state, ctx) => {
      const varsta = varstaLa(state.luna);
      const lunar = cheltuieliLunare(state, ctx);
      // „aproape complet”: între două completări anuale, cheltuielile cresc cu inflația
      const fondComplet = fondUrgenta(state) >= 5 * lunar;
      // Locuința intră la „necesar” (50%): o chirie care ar lua peste 35% din venitul net e exclusă.
      const c = contractCurent(state);
      const net = c ? fluturas(c.brut, c.contract, ctx).net : 0;
      const costLocuinta = (loc) => pret(state, ctx, `locuinte.${loc}.chirie`) + pret(state, ctx, `locuinte.${loc}.utilitati`);
      const accesibila = (loc) => (net && costLocuinta(loc) <= 0.35 * net ? 2 : -12);
      return {
        ...PONDERI_ATENT,
        'locuinta:chirieSingur': accesibila('chirieSingur'), 'locuinta:chirieColegi': accesibila('chirieColegi'),
        vandPentruAvans: fondComplet ? 4 : -4, casaMare: 1, upgradeCasa: fondComplet ? 2 : -3,
        negociaza: areJobFullTime(state, ctx) ? 4 : -1,
        // Un stil mai scump doar dacă, după urcare, cheltuielile rămân sub 80% din venitul net.
        stilSus: fondComplet && net && lunar + pret(state, ctx, 'costTrai.mancareTransport') * 0.8 <= 0.8 * net ? 1 : -6,
        stilJos: fondComplet && lunar <= 0.8 * net ? 0 : 4, rate: -3, investitieRiscanta: -1,
        muta: varsta >= 23 ? 4 : -2, amanaMutarea: varsta >= 25 ? -4 : 2, chirieScumpa: 0, chirieIeftina: 1,
        cumparaCasa: fondComplet ? 3 : -3, dobandaVariabila: -2, amanaCumpararea: fondComplet ? -1 : 2,
      };
    }),
    meniu: meniuPrudent,
  },
  frugal: {
    nume: 'frugal',
    descriere: 'modest toată viața, fond de 6 luni, investește aproape tot restul',
    alege: alegePrinScor((state, ctx) => ({
      ...PONDERI_ATENT,
      negociaza: areJobFullTime(state, ctx) ? 4 : -1,
      stilSus: -6, stilJos: 4, rate: -4, investitieRiscanta: -3, chirieScumpa: -1, chirieIeftina: 2,
      cumparaCasa: -1, dobandaVariabila: -2, amanaCumpararea: 2,
    })),
    meniu: meniuFrugal,
  },
  riscant: {
    nume: 'riscant',
    descriere: 'IFN, la negru, card pe minim, cheltuie tot',
    alege: alegePrinScor({
      ifn: 8, credit: 3, negru: 6, cim: -2, cardMinim: 6, cardIntegral: -4, ramburseaza: -5, fond: -4, card: 4, studii: -3,
      minciuna: 5, marire: -1, cautaJob: 1, ignora: 4, fericire: 0.4, viitor: -0.3, energie: 0.1,
      inselatorie: 3, pariu: 6, stilSus: 6, stilJos: -4, rate: 5, investitieRiscanta: 6, chirieScumpa: 3, panica: 5,
      cumparaCasa: 3, casaMare: 3, upgradeCasa: 3, dobandaVariabila: 3, asigurare: -2, faraAsigurare: 2, ignoraTaxe: 4, afacere: 3, economisire: -2,
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
  const finaluriColectie = {};
  // Chirie vs. cumpărare: averea finală (cu casa la valoarea de piață), pe cele două grupuri.
  const locuinta = { cumparat: [], chirie: [], varstaCumparare: [], salariuCumparat: [], salariuChirie: [], garsoniera: 0, apartament: 0, upgrade: 0 };

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
    const fc = ctx.finaluri?.size ? alegeFinal(ctx.finaluri, rezumatViata(state, ctx)) : null;
    if (fc) finaluriColectie[fc.titlu] = (finaluriColectie[fc.titlu] ?? 0) + 1;
    finaluri[motiv] = (finaluri[motiv] ?? 0) + 1;
    const varsta = varstaLa(state.final?.luna ?? state.luna);
    varste.toate.push(varsta);
    averi.push(inLei(avereNeta(state)));
    averiAzi.push(inLei(avereNeta(state)) / state.indicePreturi);
    if (!['faliment', 'burnout', 'renuntare'].includes(motiv)) {
      const cumparare = state.decizii.find((d) => d.eveniment === 'cumpara-locuinta' && /^(garsoniera|apartament)\/(fixa|variabila)$/.test(d.alegere));
      if (cumparare) {
        locuinta.cumparat.push(inLei(avereNeta(state)) / state.indicePreturi);
        locuinta.varstaCumparare.push(varstaLa(cumparare.luna));
        locuinta[cumparare.alegere.split('/')[0]] += 1;
        if (state.decizii.some((d) => d.eveniment === 'garsoniera-mai-mare' && d.alegere === 'vand')) locuinta.upgrade += 1;
      } else locuinta.chirie.push(inLei(avereNeta(state)) / state.indicePreturi);
      // salariul brut mediu din carieră (lei de azi): ca să se vadă dacă grupurile sunt comparabile
      const bl = state.bilant;
      if (bl?.luniCIM) (cumparare ? locuinta.salariuCumparat : locuinta.salariuChirie).push(inLei(bl.sumaBrutRealCIM / bl.luniCIM));
    }
    if (!['pensie', 'independenta', 'neterminat'].includes(motiv)) {
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
    finaluriColectie: Object.entries(finaluriColectie).sort((a, b) => b[1] - a[1]),
    chirieVsCumparare: {
      cumparat: { vieti: locuinta.cumparat.length, garsoniera: locuinta.garsoniera, apartament: locuinta.apartament, garsoniereVandutePentruApartament: locuinta.upgrade, avereMedianaAzi: mediana(locuinta.cumparat), varstaMedianaCumparare: mediana(locuinta.varstaCumparare), salariuBrutMedianAzi: mediana(locuinta.salariuCumparat) },
      chirie: { vieti: locuinta.chirie.length, avereMedianaAzi: mediana(locuinta.chirie), salariuBrutMedianAzi: mediana(locuinta.salariuChirie) },
    },
    evenimenteNeaparute: Object.entries(aparitii).filter(([, k]) => k === 0).map(([id]) => id),
    alegeriNealese: toateAlegerile.filter((a) => !alegeriVazute.has(a)),
    aparitii,
  };
}

// Chirie vs. cumpărare, „aceeași persoană, două alegeri”: fiecare viață în care prudentul a cumpărat
// e rejucată cu același seed (aceleași evenimente de bază, aceeași bursă) de un prudent care nu cumpără
// niciodată și investește în loc. Diferența de avere vine doar din decizia despre casă.
export function comparaChirieCumparare(ctx, { n = 500, seed = 'sim' } = {}) {
  const prudent = PROFILURI.prudent;
  const faraCasa = {
    ...prudent,
    nume: 'prudent',
    alege: (o, state, c, rnd) => {
      if (o.eveniment === 'cumpara-locuinta') return o.alegeri.find((a) => a.id === 'chirie') ? 'chirie' : prudent.alege(o, state, c, rnd);
      return prudent.alege(o, state, c, rnd);
    },
  };
  const azi = (state) => inLei(avereNeta(state)) / state.indicePreturi;
  const perechi = [];
  for (let i = 0; i < n; i++) {
    const s = `${seed}-${i}`;
    const a = simuleazaViata(ctx, s, prudent).state;
    if (!a.decizii.some((d) => d.eveniment === 'cumpara-locuinta' && /^(garsoniera|apartament)\/(fixa|variabila)$/.test(d.alegere))) continue;
    const b = simuleazaViata(ctx, s, faraCasa).state;
    perechi.push({ cuCasa: azi(a), faraCasa: azi(b) });
  }
  const dif = perechi.map((p) => p.cuCasa - p.faraCasa);
  return {
    perechi: perechi.length,
    avereMedianaCuCasa: mediana(perechi.map((p) => p.cuCasa)),
    avereMedianaInChirie: mediana(perechi.map((p) => p.faraCasa)),
    diferentaMediana: mediana(dif),
    procentCasaMaiBuna: perechi.length ? Math.round((dif.filter((d) => d > 0).length / perechi.length) * 100) : null,
  };
}

const medie = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
}

// ---------- Raport ----------

const NUME_FINALURI = { independenta: 'independență financiară', pensie: 'pensie (65 de ani)', faliment: 'faliment personal', burnout: 'burnout', renuntare: 'renunțare', neterminat: 'neterminat' };
const ORDINE_FINALURI = ['pensie', 'independenta', 'faliment', 'burnout', 'renuntare', 'neterminat'];

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
    `${'Profil'.padEnd(10)}${ORDINE_FINALURI.slice(0, 5).map((m) => m.padStart(12)).join('')}   vârsta medie   avere mediană (în lei de azi)`,
    ...lista.map((r) => `${r.profil.padEnd(10)}${ORDINE_FINALURI.slice(0, 5).map((m) => pct(r, m).padStart(12)).join('')}   ${String(r.varstaMedie).padStart(12)}   ${sumaMare(r.avereMediana)} (≈ ${sumaMare(r.avereMedianaAzi)} de azi)`),
    '',
    'Medii anuale (pe viață): inflație / randament ETF / salariu nominal / salariu real',
    ...lista.map((r) => `${r.profil.padEnd(10)}${['inflatie', 'etf', 'salariu', 'salariuReal'].map((k) => `${r.mediiAnuale[k] ?? '-'}%`.padStart(9)).join('   ')}`),
  ];
  for (const r of lista) {
    linii.push('', `── ${r.profil}: ${r.descriere}`,
      ...ORDINE_FINALURI.filter((m) => r.finaluri[m]).map((m) => `  ${NUME_FINALURI[m].padEnd(22)} ${String(r.finaluri[m]).padStart(5)}  ${pct(r, m)}`),
      `  vârsta medie la game over: ${r.varstaMedieGameOver ?? '-'}`,
      `  finaluri colecționabile: ${r.finaluriColectie.map(([t, k]) => `${t} ${Math.round((k / r.n) * 100)}%`).join(', ')}`,
      ...(r.chirieVsCumparare.cumparat.vieti >= 10 && r.chirieVsCumparare.chirie.vieti >= 10 ? [
        `  chirie vs. cumpărare (fără falimente, averea cu casa inclusă, în lei de azi):`,
        `    au cumpărat: ${r.chirieVsCumparare.cumparat.garsoniera} garsoniere (${r.chirieVsCumparare.cumparat.garsoniereVandutePentruApartament} vândute apoi pentru un apartament), ${r.chirieVsCumparare.cumparat.apartament} apartamente`,
        `    au cumpărat (${r.chirieVsCumparare.cumparat.vieti} vieți, vârsta mediană la cumpărare ${r.chirieVsCumparare.cumparat.varstaMedianaCumparare}, salariu brut mediu ${sumaMare(r.chirieVsCumparare.cumparat.salariuBrutMedianAzi)}): ${sumaMare(r.chirieVsCumparare.cumparat.avereMedianaAzi)}`,
        `    au rămas în chirie (${r.chirieVsCumparare.chirie.vieti} vieți, salariu brut mediu ${sumaMare(r.chirieVsCumparare.chirie.salariuBrutMedianAzi)}): ${sumaMare(r.chirieVsCumparare.chirie.avereMedianaAzi)}`,
      ] : []),
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
      procente: Object.fromEntries(ORDINE_FINALURI.slice(0, 5).map((m) => [m, r.procente[m] ?? 0])),
      finaluriColectie: Object.fromEntries(r.finaluriColectie.map(([t, k]) => [t, Math.round((k / r.n) * 1000) / 10])),
      varstaMedie: r.varstaMedie,
      varstaMedieGameOver: r.varstaMedieGameOver,
      avereMedianaLei: r.avereMediana,
      avereMedianaLeiDeAzi: r.avereMedianaAzi,
      mediiAnualeProcent: r.mediiAnuale,
      cauzeGameOver: r.cauzeGameOver.slice(0, 10).map(([cauza, numar]) => ({ cauza, numar })),
      chirieVsCumparare: r.chirieVsCumparare,
    }])),
  };
}
