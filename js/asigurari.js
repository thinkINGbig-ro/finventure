// Asigurările facultative (lotul 9b): locuința și viața (cu boli grave). Prima e o cheltuială lunară
// (o recurență marcată cu „asigurare”), iar flagul asigurare_<tip> e citit de evenimente (inundație, diagnostic).

import { cfg, formateazaLei, inLei, varstaLa } from './util.js';
import { pret } from './finance.js';
import { adaugaJurnal, seteazaFlag } from './state.js';

const TIPURI = {
  locuinta: { titlu: 'Asigurarea locuinței', emoji: '🏠', prima: 'asigurari.primaLocuinta', concept: 'asigurare-locuinta',
    descriere: 'Incendiu, inundație de la vecini, furt. PAD-ul obligatoriu acoperă doar dezastrele naturale.' },
  viata: { titlu: 'Asigurare de viață și boli grave', emoji: '❤️', prima: 'asigurari.primaViata', concept: 'asigurare-viata',
    descriere: 'Dacă primești un diagnostic grav, asigurătorul îți dă o sumă pentru tratament și pentru lunile fără venit.' },
};
const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
const recurenta = (state, tip) => state.recurente.find((r) => r.asigurare === tip);
export const areAsigurare = (state, tip) => !!recurenta(state, tip);

function motivAsigurare(state, ctx, tip) {
  if (tip === 'locuinta' && !state.produse.some((p) => p.tip === 'proprietate' || p.tip === 'imobil')) return 'Ai nevoie de o locuință a ta (sau de un apartament de închiriat).';
  if (tip === 'viata') {
    if (varstaLa(state.luna) > cfg(ctx, 'asigurari.varstaMaxViata')) return `Asigurătorii nu mai încheie polițe noi după ${cfg(ctx, 'asigurari.varstaMaxViata')} de ani.`;
    if (!state.produse.some((p) => p.tip === 'contractMunca' || p.tip === 'afacere')) return 'Ai nevoie de un venit (job sau afacere) ca să plătești prima.';
  }
  return null;
}

export function descrieAsigurari(state, ctx) {
  return Object.entries(TIPURI).map(([tip, t]) => ({
    tip, ...t, prima: recurenta(state, tip)?.suma ?? pret(state, ctx, t.prima), activa: areAsigurare(state, tip), motiv: motivAsigurare(state, ctx, tip),
  }));
}

export function asigura(state, ctx, { tip, activ = true } = {}) {
  const t = TIPURI[tip];
  if (!t) return { ok: false, mesaj: 'Asigurarea asta nu există.' };
  if (!activ) {
    if (!areAsigurare(state, tip)) return { ok: false, mesaj: 'Nu ai asigurarea asta.' };
    state.recurente = state.recurente.filter((r) => r.asigurare !== tip);
    delete state.flaguri[`asigurare_${tip}`];
    adaugaJurnal(state, `Ai renunțat la ${t.titlu.toLowerCase()}.`);
    return { ok: true, mesaj: `Ai renunțat la ${t.titlu.toLowerCase()}. Nu mai plătești prima, dar nici nu mai ești acoperit.` };
  }
  if (areAsigurare(state, tip)) return { ok: false, mesaj: 'Ai deja asigurarea asta.' };
  const motiv = motivAsigurare(state, ctx, tip);
  if (motiv) return { ok: false, mesaj: motiv };
  const prima = pret(state, ctx, t.prima);
  state.recurente.push({ tip: 'cheltuiala', suma: prima, luniRamase: null, eticheta: t.titlu, locuinta: null, destinatie: null, cauza: null, asigurare: tip });
  seteazaFlag(state, `asigurare_${tip}`);
  adaugaJurnal(state, `Ți-ai făcut ${t.titlu.toLowerCase()} (${leiText(prima)} pe lună).`);
  return { ok: true, mesaj: `${t.titlu}: ${leiText(prima)} pe lună. Un cost mic și sigur, ca să eviți unul mare și rar.`, concepte: [t.concept] };
}

// Când vinzi ultima locuință, asigurarea ei nu mai are obiect.
export function verificaAsigurari(state) {
  if (areAsigurare(state, 'locuinta') && !state.produse.some((p) => p.tip === 'proprietate' || p.tip === 'imobil')) {
    state.recurente = state.recurente.filter((r) => r.asigurare !== 'locuinta');
    delete state.flaguri.asigurare_locuinta;
  }
}
