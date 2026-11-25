// Partener și familie (lotul 9c). Venitul partenerului nu e al tău: partenerul plătește jumătate din
// costurile comune (chiria și utilitățile, copiii, creditul luat împreună). La bancă, venitul lui
// contează doar dacă luați creditul împreună (co-debitori); atunci răspundeți amândoi pentru el,
// și după divorț. Simplificări: fiecare își păstrează economiile (presupunem că ați pus deoparte cam
// la fel); la divorț, copiii rămân la celălalt părinte, iar tu plătești pensia de întreținere.
// Zarurile (divorțul, fostul care nu mai plătește) folosesc fluxul „actiuni”.

import { bal, cfg, clamp, formateazaLei, inLei } from './util.js';
import { aleator } from './rng.js';
import { facturiLunare, fluturas, incaseaza, plateste, pret } from './finance.js';
import { programeazaUrmare } from './events.js';
import { adaugaJurnal, areFlag, seteazaFlag } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
export const familieNoua = () => ({ partener: null, copii: [], stres: 0, divortProgramat: false, fostulNuPlateste: false, indemnizatie: 0 });
const fam = (state) => (state.familie ??= familieNoua());

export const arePartener = (state) => !!state.familie?.partener;
const varstaCopil = (state, c) => Math.floor((state.luna - c.nascutLa) / 12);
const minor = (state, ctx, c) => varstaCopil(state, c) < cfg(ctx, 'familie.varstaMajorat');
export const copiiCuTine = (state, ctx) => (state.familie?.copii ?? []).filter((c) => c.cuTine && minor(state, ctx, c));
const copiiLaFost = (state, ctx) => (state.familie?.copii ?? []).filter((c) => !c.cuTine && minor(state, ctx, c));
export const crediteComune = (state) => state.produse.filter((p) => p.tip === 'credit' && p.coDebitor && p.stadiu === 'activ');

function netulTau(state, ctx) {
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  return c && c.contract !== 'negru' ? fluturas(c.brut, c.contract, ctx).net : 0;
}
const indemnizatie = (state, ctx, net) => clamp(Math.round(net * cfg(ctx, 'familie.indemnizatieProcent')),
  pret(state, ctx, 'familie.indemnizatieMin'), pret(state, ctx, 'familie.indemnizatieMax'));

// Venitul net lunar al partenerului (îl folosește și banca, la creditul comun).
export function venitPartener(state, ctx) {
  if (!arePartener(state) || areFlag(state, 'partener_fara_venit')) return 0;
  const net = pret(state, ctx, 'familie.venitPartenerNet');
  return areFlag(state, 'partener_concediu') ? indemnizatie(state, ctx, net) : net;
}

const alocatieCopil = (state, ctx, c) => pret(state, ctx, varstaCopil(state, c) < 2 ? 'familie.alocatieSub2' : 'familie.alocatiePeste2');
const rateComune = (state) => crediteComune(state).reduce((t, p) => t + Math.min(p.rata, p.rest), 0);

// O privire de ansamblu, pentru panoul din Bancă și pentru teste.
export function bugetFamilie(state, ctx) {
  const f = state.familie ?? familieNoua();
  const copii = copiiCuTine(state, ctx);
  const costCopii = copii.length * pret(state, ctx, 'familie.costLunarCopil');
  const alocatie = copii.reduce((t, c) => t + alocatieCopil(state, ctx, c), 0);
  let contributie = 0;
  if (f.partener) {
    const { chirie, utilitati } = facturiLunare(state, ctx);
    const comun = chirie + utilitati + costCopii + rateComune(state);
    contributie = Math.min(Math.round(comun / 2), Math.round(venitPartener(state, ctx) * 0.6));
  } else if (areFlag(state, 'credit_cu_fostul') && !f.fostulNuPlateste) {
    contributie = Math.round(rateComune(state) / 2);
  }
  const procente = cfg(ctx, 'familie.pensieIntretinere');
  const laFost = copiiLaFost(state, ctx).length;
  const pensie = laFost ? Math.round(netulTau(state, ctx) * procente[Math.min(laFost, procente.length) - 1]) : 0;
  const indemn = areFlag(state, 'concediu_crestere') ? f.indemnizatie : 0;
  return {
    partener: f.partener, copii: copii.map((c) => ({ varsta: varstaCopil(state, c) })), copiiLaFost: laFost,
    costCopii, alocatie, contributie, pensie, indemnizatie: indemn, venitPartener: venitPartener(state, ctx),
    crediteComune: crediteComune(state).length, creditCuFostul: areFlag(state, 'credit_cu_fostul'),
  };
}

// Banii lunii: contribuția partenerului (sau a fostului, la creditul comun), alocația, indemnizația;
// costurile copiilor și pensia de întreținere. Întoarce totalurile pentru rezumatul anului.
export function proceseazaFamilie(state, ctx) {
  const rez = { venit: 0, cheltuieli: 0, neplatit: 0 };
  if (!state.familie) return rez;
  const b = bugetFamilie(state, ctx);
  for (const v of [b.contributie, b.alocatie, b.indemnizatie]) if (v > 0) { incaseaza(state, v); rez.venit += v; }
  for (const c of [b.costCopii, b.pensie]) {
    if (c <= 0) continue;
    const platit = plateste(state, c);
    rez.cheltuieli += platit;
    rez.neplatit += c - platit;
  }
  for (const c of state.familie.copii) {
    if (!c.major && !minor(state, ctx, c)) {
      c.major = true;
      adaugaJurnal(state, `Copilul tău a împlinit ${cfg(ctx, 'familie.varstaMajorat')} de ani.`);
    }
  }
  return rez;
}

// La sfârșitul lunii: stresul financiar (luni cu lipsuri, cu uitare treptată) și riscul de divorț;
// după divorț, riscul ca fostul partener să nu-și mai plătească partea din creditul comun.
export function verificaCuplu(state, ctx, cuLipsuri) {
  const f = state.familie;
  if (!f) return;
  const b = bal(ctx, 'familie');
  f.stres = f.stres * (11 / 12) + (cuLipsuri ? 1 : 0);
  if (f.partener && !f.divortProgramat) {
    const restante = areFlag(state, 'executare_silita') || state.produse.some((p) => (p.restanta ?? 0) > 0);
    const anual = b.divortBaza + b.divortLipsuri * Math.min(1, f.stres / 12) + (restante ? b.divortRestante : 0);
    if (aleator(state, 'actiuni') < anual / 12) {
      f.divortProgramat = true;
      programeazaUrmare(state, ctx, { eveniment: 'divort', dupaLuni: 1 }, null);
    }
  }
  if (!f.partener && areFlag(state, 'credit_cu_fostul') && !f.fostulNuPlateste && crediteComune(state).length) {
    if (aleator(state, 'actiuni') < b.sansaFostulNuPlateste) {
      f.fostulNuPlateste = true;
      programeazaUrmare(state, ctx, { eveniment: 'fostul-nu-plateste', dupaLuni: 1 }, null);
    }
  }
}

// Casa cumpărată împreună: valoarea, ce mai e de dat la bancă și partea fiecăruia la vânzare.
export function casaComuna(state, ctx) {
  const credit = crediteComune(state)[0];
  const casa = state.produse.find((p) => p.tip === 'proprietate');
  if (!credit || !casa) return null;
  const datorie = credit.rest + credit.restanta;
  const net = Math.round(casa.valoare * (1 - cfg(ctx, 'familie.comisionVanzareCasa'))) - datorie;
  return { credit, casa, datorie, net, partea: Math.round(net / 2) };
}

function vindeCasaComuna(state, ctx) {
  const cc = casaComuna(state, ctx);
  if (!cc) return;
  state.produse = state.produse.filter((p) => p !== cc.casa && p !== cc.credit);
  // Banca se plătește din preț; diferența (sau lipsa) se împarte pe din două.
  if (cc.partea >= 0) incaseaza(state, cc.partea);
  else plateste(state, -cc.partea);
  state.situatie.locuinta = 'chirieSingur';
  delete state.flaguri.credit_cu_fostul;
  adaugaJurnal(state, `Ați vândut casa comună și ați închis creditul. ${cc.partea >= 0 ? `Partea ta: ${leiText(cc.partea)}.` : `Prețul n-a acoperit creditul: ai plătit jumătate din diferență, ${leiText(-cc.partea)}.`}`);
}

function divorteaza(state, ctx, cuInstanta) {
  const f = fam(state);
  const casatoriti = !!f.partener?.casatorit;
  f.partener = null;
  f.divortProgramat = false;
  for (const c of f.copii) c.cuTine = false;
  delete state.flaguri.partener;
  delete state.flaguri.casatorit;
  delete state.flaguri.partener_fara_venit;
  delete state.flaguri.partener_concediu;
  seteazaFlag(state, 'divortat');
  const cc = casaComuna(state, ctx);
  if (cc) {
    programeazaUrmare(state, ctx, {
      eveniment: 'divort-casa', dupaLuni: 0,
      variabile: { valoare: Math.round(inLei(cc.casa.valoare)), datorie: Math.round(inLei(cc.datorie)), partea: Math.round(inLei(Math.max(0, cc.partea))), luni: cc.credit.luniRamase },
    }, null);
  }
  const laFost = copiiLaFost(state, ctx).length;
  adaugaJurnal(state, `${casatoriti ? `Ați divorțat${cuInstanta ? ', după un proces lung' : ', la notar'}` : 'V-ați despărțit'}.${laFost ? ' Copiii rămân la celălalt părinte; tu plătești pensia de întreținere.' : ''}`);
}

// Efectul „familie” din alegerile evenimentelor.
export const ACTIUNI_FAMILIE = ['partener', 'casatorie', 'copil', 'concediuEu', 'concediuPartener', 'partenerSomer',
  'divortNotar', 'divortInstanta', 'impacare', 'vindeCasaComuna', 'preiaCreditul', 'creditComun', 'platescEu'];

export function aplicaFamilie(state, ctx, actiune) {
  const f = fam(state);
  switch (actiune) {
    case 'partener':
      f.partener = { deLa: state.luna, casatorit: false };
      seteazaFlag(state, 'partener');
      break;
    case 'casatorie':
      if (f.partener) f.partener.casatorit = true;
      seteazaFlag(state, 'casatorit');
      break;
    case 'copil':
      f.copii.push({ nascutLa: state.luna, cuTine: true, major: false });
      seteazaFlag(state, 'are_copii');
      break;
    case 'concediuEu':
      f.indemnizatie = indemnizatie(state, ctx, netulTau(state, ctx));
      seteazaFlag(state, `concediu_crestere:${cfg(ctx, 'familie.luniConcediuCrestere')}`);
      break;
    case 'concediuPartener':
      seteazaFlag(state, `partener_concediu:${cfg(ctx, 'familie.luniConcediuCrestere')}`);
      break;
    case 'partenerSomer':
      seteazaFlag(state, `partener_fara_venit:${bal(ctx, 'familie.luniPartenerFaraVenit')}`);
      break;
    case 'divortNotar':
    case 'divortInstanta':
      divorteaza(state, ctx, actiune === 'divortInstanta');
      break;
    case 'impacare':
      f.divortProgramat = false;
      f.stres /= 2;
      break;
    case 'vindeCasaComuna':
      vindeCasaComuna(state, ctx);
      break;
    case 'preiaCreditul':
    case 'platescEu':
      for (const c of crediteComune(state)) c.coDebitor = false;
      delete state.flaguri.credit_cu_fostul;
      break;
    case 'creditComun':
      seteazaFlag(state, 'credit_cu_fostul');
      f.fostulNuPlateste = false;
      break;
    default:
      break;
  }
}
