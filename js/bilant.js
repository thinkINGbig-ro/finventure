// Bilanțul vieții: contoare ținute lunar și anual, din care ies tiparele de la final
// („Ce te-a costat / Ce te-a ajutat”), estimarea pensiei și independența financiară.

import { bal, cfg, varstaLa } from './util.js';
import { baniDisponibili, fondUrgenta, valoareProdus } from './finance.js';
import { avereNeta, cheltuieliLunare, nivelStil } from './state.js';

export function bilantNou() {
  return {
    luniFaraFond: 0, luniCuFond: 0, luniCardMinim: 0, luniNegru: 0, luniFaraAsigurare: 0,
    luniCIM: 0, sumaBrutRealCIM: 0, luniInvestitii: 0, castigRealizat: 0, castigNegociereAzi: 0,
    aniCheltuieliPeste90: 0, aniStilPesteVenit: 0, aniFaraMarire: 0,
    luniStil: { modest: 0, confortabil: 0, lux: 0 },
    ifnLuate: 0, rateCumparaturi: 0, somatiiIgnorate: 0, socuriAbsorbite: 0, socuriCuDatorie: 0,
    vanzariPanica: 0, crizeTraversate: 0,
    varstaIndependenta: null,
  };
}

const b = (state) => (state.bilant ??= bilantNou()); // salvări mai vechi, fără bilanț

// ---------- Lunar (apelat de engine la sfârșitul fiecărei luni) ----------

export function inregistreazaLuna(state, ctx, { asigurat }) {
  const bl = b(state);
  const varsta = varstaLa(state.luna);
  const lunar = Math.max(1, cheltuieliLunare(state, ctx));
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  const pragFond = bal(ctx, 'bilant.pragFondLuni');

  bl.luniStil[state.stilViata] = (bl.luniStil[state.stilViata] ?? 0) + 1;
  if (varsta >= bal(ctx, 'bilant.varstaMinPentruFond') && !state.situatie.studii) {
    if (fondUrgenta(state) >= pragFond * lunar) bl.luniCuFond += 1;
    else bl.luniFaraFond += 1;
  }
  const card = state.produse.find((p) => p.tip === 'cardCredit');
  if (card?.plata === 'minim' && card.soldScadent > 0) bl.luniCardMinim += 1;
  if (c?.contract === 'negru') bl.luniNegru += 1;
  if (!asigurat && varsta >= 19) bl.luniFaraAsigurare += 1;
  if (c && c.contract !== 'negru') {
    bl.luniCIM += 1;
    bl.sumaBrutRealCIM += c.brut / state.indicePreturi;
  }
  if (c?.plusNegociat) bl.castigNegociereAzi += c.plusNegociat / state.indicePreturi;
  if (state.produse.some((p) => p.tip === 'investitie')) bl.luniInvestitii += 1;
}

// ---------- Anual (apelat la sfârșitul anului, cu acumulatorii anului) ----------

export function inregistreazaAn(state, ctx, ac) {
  const bl = b(state);
  const cheltuieli = ac.cheltuieliTrai + ac.rate + ac.comisioane;
  const peste = ac.venituri > 0 && cheltuieli / ac.venituri > bal(ctx, 'bilant.pragCheltuieli');
  if (peste) bl.aniCheltuieliPeste90 += 1;
  if (peste && state.stilViata !== 'modest') bl.aniStilPesteVenit += 1;
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  if (c && c.contract !== 'negru' && (c.luniDeLaMarire ?? 0) >= 24 && ctx.joburi.get(c.jobId)?.program === 'full-time') bl.aniFaraMarire += 1;
}

// ---------- La fiecare decizie ----------

const EVENIMENTE_SOC = ['urgenta-2000', 'problema-sanatate', 'factura-iarna'];

export function inregistreazaDecizie(state, ev, cale, pachet) {
  const bl = b(state);
  for (const p of [pachet.produsNou ?? []].flat()) {
    if (p.tip !== 'credit') continue;
    if (p.furnizor === 'ifn') bl.ifnLuate += 1;
    if (p.furnizor === 'magazin' || p.furnizor === 'bnpl') bl.rateCumparaturi += 1;
  }
  if (cale.endsWith('ignor') && ['facturi-somatie', 'ifn-restanta'].includes(ev.id)) bl.somatiiIgnorate += 1;
  if (ev.id === 'prabusire-bursa') {
    if (cale === 'vand') bl.vanzariPanica = (bl.vanzariPanica ?? 0) + 1;
    else bl.crizeTraversate = (bl.crizeTraversate ?? 0) + 1;
  }
  if (EVENIMENTE_SOC.includes(ev.id)) {
    const dinBaniProprii = pachet.sursaPlata === 'fondUrgenta' || pachet.retrageEconomii || cale.startsWith('din-banii-mei/cont') || cale === 'platesc' || cale === 'fond';
    const cuDatorie = (pachet.produsNou && [pachet.produsNou].flat().some((p) => p.tip === 'credit')) || pachet.sursaPlata === 'cardCredit';
    if (dinBaniProprii) bl.socuriAbsorbite += 1;
    if (cuDatorie) bl.socuriCuDatorie += 1;
  }
}

// ---------- Pensie și independență financiară ----------

// Estimare simplificată (deVerificat în config): Pilonul I = rata de înlocuire × salariul mediu real
// din anii cu contract, proporțional cu stagiul; Pilonul II = soldul împărțit pe anii de plată.
export function estimeazaPensie(state, ctx) {
  const bl = b(state);
  const ani = bl.luniCIM / 12;
  const salariuMediuAzi = bl.luniCIM ? bl.sumaBrutRealCIM / bl.luniCIM : 0;
  const proportie = Math.min(1, ani / cfg(ctx, 'pensie.aniStagiuComplet'));
  const pilon1 = Math.round(salariuMediuAzi * cfg(ctx, 'pensie.rataInlocuireLaStagiuComplet') * proportie);
  const pilon2 = Math.round((state.pensie.pilon2 + (state.pensie.pilon3 ?? 0)) / state.indicePreturi / bal(ctx, 'bilant.luniPlataPilon2'));
  return { aniContributie: Math.floor(ani), pilon1, pilon2 }; // în bani, „lei de azi”
}

// Cât au câștigat investițiile, în lei de azi (bani): valoare curentă - cost + câștiguri deja realizate.
export function castigInvestitiiAzi(state) {
  const latent = state.produse
    .filter((p) => p.tip === 'investitie')
    .reduce((s, p) => s + (valoareProdus(p, state) - (p.cost ?? 0)), 0);
  return Math.round((latent + (b(state).castigRealizat ?? 0)) / state.indicePreturi);
}

export function activeCareProduc(state) {
  return state.produse
    .filter((p) => ['contEconomii', 'depozit', 'investitie'].includes(p.tip))
    .reduce((s, p) => s + valoareProdus(p, state), 0);
}

// Venitul pasiv sustenabil: regula retragerii de ~4% pe an din economii și investiții.
export function venitPasivLunar(state, ctx) {
  return Math.round((activeCareProduc(state) * cfg(ctx, 'independenta.rataRetragereAnuala')) / 12);
}

export function verificaIndependenta(state, ctx) {
  const bl = b(state);
  if (bl.varstaIndependenta != null) return false;
  if (venitPasivLunar(state, ctx) < cheltuieliLunare(state, ctx)) return false;
  bl.varstaIndependenta = varstaLa(state.luna);
  return true;
}

// ---------- Rezumatul final (pentru finaluri și tipare) ----------

export function rezumatViata(state, ctx) {
  const bl = b(state);
  const lunar = cheltuieliLunare(state, ctx);
  return {
    motiv: state.final?.motiv ?? null,
    varsta: varstaLa(state.final?.luna ?? state.luna),
    avereAzi: Math.round(avereNeta(state) / state.indicePreturi / 100), // lei
    venitPasivAcopera: venitPasivLunar(state, ctx) >= lunar,
    aniLux: Math.floor(bl.luniStil.lux / 12),
    aniConfortabil: Math.floor(bl.luniStil.confortabil / 12),
    aniCIM: Math.floor(bl.luniCIM / 12),
    aniNegru: Math.floor(bl.luniNegru / 12),
    aniCuFond: Math.floor(bl.luniCuFond / 12),
    varstaIndependenta: bl.varstaIndependenta,
    ifnLuate: bl.ifnLuate,
    rateCumparaturi: bl.rateCumparaturi,
    socuriAbsorbite: bl.socuriAbsorbite,
    stilFinal: nivelStil(ctx, state.stilViata)?.nume,
    casaPlatita: state.produse.some((p) => p.tip === 'proprietate') && !state.produse.some((p) => p.tip === 'credit' && p.furnizor === 'ipoteca'),
    disponibil: baniDisponibili(state),
  };
}

