// Infracțiunile și consecințele lor (lotul 8). Doar decizii și urmări, fără niciun „cum se face”.
// Câștigul vine pe loc, riscul vine mai târziu: șansa de a fi prins crește cu fiecare repetare, iar
// pedeapsa (amendă, închisoare, cazier) depășește întotdeauna câștigul. Zarurile folosesc fluxul „actiuni”.

import { bal, cfg, clamp, formateazaLei, inLei } from './util.js';
import { aleator, intreg } from './rng.js';
import { creeazaProdus, plateste, pret } from './finance.js';
import { programeazaUrmare } from './events.js';
import { adaugaJurnal, areFlag, seteazaFlag } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
export const TIPURI_FAPTE = ['furt', 'mule', 'frauda', 'evaziune'];
const DESCRIERE = {
  furt: 'Camerele magazinului te-au filmat.',
  mule: 'Banii care au trecut prin contul tău erau furați de la alți oameni. Banca a blocat contul și a sesizat poliția.',
  frauda: 'Auditul firmei a găsit decontările false.',
  evaziune: 'Un control ANAF a găsit vânzările nedeclarate.',
};

const evidenta = (state) => (state.infractiuni ??= { furt: 0, mule: 0, frauda: 0, evaziune: 0, inchisoare: 0 });
export const inDetentie = (state) => (state.infractiuni?.inchisoare ?? 0) > 0;
export const areCazier = (state) => areFlag(state, 'cazier');

// Apelată din alegeri („infractiune”). Câștigul se scrie separat, în „efecte”.
export function comiteFapta(state, ctx, tip, castigLei, idDecizie) {
  const inf = evidenta(state);
  const anterioare = inf[tip] ?? 0;
  inf[tip] = anterioare + 1;
  if (tip === 'evaziune') inf.evaziuneTotal = (inf.evaziuneTotal ?? 0) + Math.round(castigLei); // ANAF recalculează tot
  const b = bal(ctx, `infractiuni.${tip}`);
  const sansa = Math.min(0.95, b.sansaBaza + b.crestereLaRepetare * anterioare);
  if (aleator(state, 'actiuni') < sansa) {
    const [min, max] = bal(ctx, 'infractiuni.luniPanaLaDosar');
    programeazaUrmare(state, ctx, {
      eveniment: 'dosar-penal', dupaLuni: intreg(state, 'actiuni', min, max),
      variabile: { fapta: tip, faptaText: DESCRIERE[tip], castig: Math.round(castigLei), nr: anterioare },
    }, idDecizie);
  }
}

// Pedeapsa, după cum alege jucătorul în „Dosar penal”: recunoașterea scade pedeapsa cu o treime;
// avocatul costă și uneori obține achitarea. Cazierul vine cu orice condamnare.
export function aplicaPedeapsa(state, ctx, varianta, vars) {
  const tip = vars.fapta;
  const nr = vars.nr ?? 0;
  const c = (k) => cfg(ctx, `infractiuni.${k}`);
  if (varianta === 'avocat') {
    plateste(state, pret(state, ctx, 'infractiuni.costAvocatPenal'));
    if (aleator(state, 'actiuni') < bal(ctx, 'infractiuni.sansaAchitareCuAvocat')) {
      adaugaJurnal(state, 'Avocatul a obținut achitarea: probele n-au fost suficiente. Ai scăpat de data asta, dar ai plătit avocatul.');
      return { mesaj: 'Achitat.' };
    }
  }
  const reducere = varianta === 'recunoaste' ? 2 / 3 : 1;
  let amenda = 0;
  let luni = 0;
  if (tip === 'furt') {
    if (nr < 2) amenda = pret(state, ctx, 'infractiuni.amendaFurt');
    else luni = c('luniInchisoareFurtRepetat');
  } else if (tip === 'mule') {
    if (nr === 0 && varianta === 'recunoaste') amenda = pret(state, ctx, 'infractiuni.amendaFurt'); // pedeapsă cu suspendare + amendă
    else luni = c('luniInchisoareMule');
  } else if (tip === 'frauda') {
    amenda = pret(state, ctx, 'infractiuni.amendaFrauda');
    if (nr > 0 || varianta !== 'recunoaste') luni = c('luniInchisoareFrauda');
    // Frauda la locul de muncă: concedierea vine odată cu dosarul.
    if (state.produse.some((p) => p.tip === 'contractMunca')) {
      state.produse = state.produse.filter((p) => p.tip !== 'contractMunca');
      adaugaJurnal(state, 'Ai fost concediat pentru deconturile false.');
    }
  } else if (tip === 'evaziune') {
    // Toate taxele ascunse până acum se plătesc înapoi, cu dobânzi, penalități și amendă.
    const total = Math.max(vars.castig ?? 0, evidenta(state).evaziuneTotal ?? 0);
    amenda = Math.round(total * 100 * c('multiplicatorEvaziune'));
    evidenta(state).evaziuneTotal = 0;
    if (nr > 0) luni = c('luniInchisoareEvaziune');
  }
  luni = Math.round(luni * reducere);
  // Amenda: ce nu poți plăti acum devine o datorie către stat, în rate.
  if (amenda) {
    const platit = plateste(state, amenda);
    if (amenda - platit > 0) state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'stat', suma: amenda - platit, dae: 0, luni: 12 }, state, ctx));
  }
  seteazaFlag(state, `cazier:${c('aniReabilitare') * 12}`);
  state.ascunse.scorCredit = clamp(state.ascunse.scorCredit - bal(ctx, 'infractiuni.scorCreditCazier'), 0, 100);
  state.ascunse.reputatie = clamp(state.ascunse.reputatie - 20, 0, 100);
  state.stat.fericire = clamp(state.stat.fericire - 10, 0, 100);
  let text = `Ai fost condamnat${amenda ? `: amendă de ${leiText(amenda)}` : ''}${luni ? `${amenda ? ' și' : ':'} ${luni} luni de închisoare` : ''}. Ai cazier pentru ${c('aniReabilitare')} ani.`;
  if (luni) {
    intraInDetentie(state, ctx, luni);
    text += ' Ți-ai pierdut jobul.';
  }
  adaugaJurnal(state, text, { tip: 'datorie', cauza: null });
  return { mesaj: text };
}

function intraInDetentie(state, ctx, luni) {
  evidenta(state).inchisoare = luni;
  state.produse = state.produse.filter((p) => p.tip !== 'contractMunca' && p.tip !== 'activitateSecundara');
}

// Lunar, din motor: luna de detenție trece; la final, eliberarea.
export function proceseazaDetentie(state, ctx) {
  if (!inDetentie(state)) return;
  const inf = evidenta(state);
  inf.inchisoare -= 1;
  state.stat.fericire += bal(ctx, 'infractiuni.fericireLunaraInchisoare');
  state.viitorAjustare -= 0.3;
  if (inf.inchisoare === 0) adaugaJurnal(state, 'Ai ieșit din închisoare. Cu cazier, multe joburi și bănci îți închid ușa. Revenirea e lentă, dar posibilă.');
}

// Băncile și magazinele cu rate refuză un client cu cazier (folosită de toate creditele).
export function motivCazierCredit(state) {
  return areCazier(state) ? 'Banca refuză: ai cazier.' : null;
}
