// Ecranul de final:
// - game over: „Ce s-a întâmplat?” = „Ce a declanșat” (lanțul de decizii, cu „Încearcă din nou de aici”)
//   + „Tiparul” (comportamentele de fond, cu „Ce trebuia să faci” și conceptul din enciclopedie);
// - pensie / independență: „Cum a fost viața ta” = „Ce te-a ajutat” + „Ce te-a costat” + pensia estimată.

import { lantDecizii } from '../events.js';
import { estimeazaPensie } from '../bilant.js';
import { bilantEducatie } from '../educatie.js';
import { ani, h, lei, leiCuAzi } from './dom.js';
import { blocConcepte } from './concepte.js';
import { graficAvere } from './grafic.js';
import { deschideStrat, inchideStrat } from './strat.js';
import { distribuie } from '../share.js';

// d: { state, ctx, final (din endings.json), nou (bool), colectie: {deblocate, total}, tipare, checkpointuri: Map(decizie -> id) }
// Întoarce { actiune: 'joc-nou' } sau { actiune: 'reia', checkpoint }.
export function arataFinalViata(oprire, d) {
  return new Promise((rezolva) => {
    const { state, ctx, final } = d;
    const gameOver = !['pensie', 'independenta'].includes(oprire.motiv);
    const gata = (r) => {
      inchideStrat();
      rezolva(r);
    };

    const card = h('section', { class: 'card final' },
      h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, final?.emoji ?? '🏁'),
      h('h2', {}, gameOver ? 'Ce s-a întâmplat?' : 'Cum a fost viața ta'),
      h('p', { class: 'final-titlu' }, final?.titlu ?? '', d.nou ? h('span', { class: 'chip nou' }, 'Final nou') : null),
      h('p', {}, final?.descriere ?? ''),
      h('p', { class: 'mic' }, gameOver
        ? `${ani(oprire.varsta)} · datorii ${lei(d.datorii)} · bani disponibili ${lei(d.disponibil)} · finaluri descoperite: ${d.colectie.deblocate}/${d.colectie.total}`
        : `${ani(oprire.varsta)} · avere netă ${leiCuAzi(d.avereNeta, state.indicePreturi)} · finaluri descoperite: ${d.colectie.deblocate}/${d.colectie.total}`),
      gameOver ? sectiuneDeclansator(state, d, gata) : d.tipare.pozitive.some((t) => t.id === 'contract') ? null : sectiunePensie(state, ctx),
      gameOver ? null : sectiuneTipare('Ce te-a ajutat', d.tipare.pozitive, ctx, true),
      sectiuneEducatie(state, ctx),
      graficAvere(state, gameOver ? 'Averea ta netă și datoriile, an de an (în lei de azi)' : 'Averea ta netă, an de an (în lei de azi)'),
      sectiuneTipare(gameOver ? 'Tiparul' : 'Ce te-a costat', d.tipare.negative, ctx, false),
      h('div', { class: 'rand-butoane' },
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => distribuieFinal(oprire, d) }, 'Distribuie'),
        h('button', { type: 'button', class: 'btn btn-principal', 'data-focus': '', onclick: () => gata({ actiune: 'joc-nou' }) }, 'Joc nou')));
    deschideStrat(card, { centrat: true, eticheta: gameOver ? 'Ce s-a întâmplat?' : 'Cum a fost viața ta' });
  });
}

function sectiuneDeclansator(state, d, gata) {
  const lant = state.final?.cauza ? lantDecizii(state, state.final.cauza) : [];
  if (!lant.length) {
    return h('div', { class: 'sectiune-final' }, h('h3', {}, 'Ce a declanșat'),
      h('p', { class: 'mic' }, 'N-a fost o singură decizie: s-a adunat în timp. Uită-te la tipar.'));
  }
  const ids = new Set(lant.map((x) => x.id));
  // Pașii: deciziile din lanț + consecințele lor din jurnal (somații, recuperatori, executare), în ordine.
  const pasi = [
    ...lant.map((x) => ({ luna: x.luna, decizie: x })),
    ...state.jurnal.filter((j) => j.tip === 'datorie' && ids.has(j.cauza)).map((j) => ({ luna: j.luna, jurnal: j })),
  ].sort((a, b) => a.luna - b.luna);
  // Păstrăm cronologia scurtă: consecințele repetitive (aceeași frază) apar o singură dată.
  const vazute = new Set();
  const unici = pasi.filter((p) => {
    if (!p.jurnal) return true;
    const cheie = p.jurnal.text.replace(/[\d.,]+ lei/g, '');
    if (vazute.has(cheie)) return false;
    vazute.add(cheie);
    return true;
  });
  return h('div', { class: 'sectiune-final' },
    h('h3', {}, 'Ce a declanșat'),
    h('ol', { class: 'cronologie' }, unici.map((p) => {
      const varsta = ani(p.decizie?.luna != null ? varstaDin(p.decizie.luna) : p.jurnal.varsta);
      if (p.jurnal) return h('li', { class: 'consecinta' }, h('span', { class: 'mic' }, varsta), ' ', p.jurnal.text);
      const cp = d.checkpointuri.get(p.decizie.id);
      return h('li', { class: 'decizie' },
        h('span', { class: 'mic' }, varsta), ' ',
        h('strong', {}, p.decizie.titlu ?? p.decizie.eveniment), h('br'),
        `Ai ales: „${p.decizie.eticheta ?? p.decizie.alegere}”`,
        p.decizie.jurnal ? h('span', { class: 'mic bloc' }, p.decizie.jurnal) : null,
        cp ? h('button', { type: 'button', class: 'btn btn-text btn-reia', onclick: () => gata({ actiune: 'reia', checkpoint: cp }) }, '↺ Încearcă din nou de aici') : null);
    })));
}

const varstaDin = (luna) => 18 + Math.max(0, Math.floor(luna / 12));

function sectiunePensie(state, ctx) {
  const p = estimeazaPensie(state, ctx);
  return h('div', { class: 'sectiune-final' },
    h('h3', {}, 'Pensia ta'),
    h('p', {}, `Pensia de stat estimată: ${lei(p.pilon1)} pe lună, plus ${lei(p.pilon2)} din Pilonii II și III (în lei de azi), după ${ani(p.aniContributie)} de contribuții.`),
    blocConcepte(['pilonii-pensiei'], ctx, { eticheta: null, nou: false }));
}

// Educația ca investiție: cât ai dat și cât au adus în plus salariile, față de jobul de bază cu doar liceul.
function sectiuneEducatie(state, ctx) {
  const e = bilantEducatie(state, ctx);
  if (!e || !e.aniMunca) return null;
  const plus = e.castigSalarii >= 0;
  return h('div', { class: 'sectiune-final' },
    h('h3', {}, 'Educația ta, ca investiție'),
    h('p', {}, `Ai dat pe studii și cursuri ${lei(e.cost)}. În ${ani(e.aniMunca)} de muncă cu contract, salariile tale au fost, în total, cu ${lei(Math.abs(e.castigSalarii))} ${plus ? 'peste' : 'sub'} ce ai fi câștigat ca curier, jobul de bază cu doar liceul (în lei de azi).`),
    h('p', { class: 'mic' }, plus
      ? 'Nu toată diferența vine din școală (contează și experiența, negocierea, promovările), dar multe joburi bine plătite cer o diplomă sau un certificat.'
      : 'Studiile nu s-au întors încă în salariu: contează și ce domeniu alegi, și dacă le folosești la job.'),
    blocConcepte(['educatie-investitie'], ctx, { eticheta: null, nou: false }));
}

function sectiuneTipare(titlu, tipare, ctx, pozitiv) {
  if (!tipare.length) return null;
  return h('div', { class: 'sectiune-final' },
    h('h3', {}, titlu),
    tipare.map((t) => h('div', { class: `tipar ${pozitiv ? 'pozitiv' : 'negativ'}` },
      h('strong', {}, `${pozitiv ? '▲' : '▼'} ${t.titlu}`),
      h('p', {}, t.fapt),
      h('p', { class: 'mic' }, pozitiv ? t.deCe : `Ce trebuia să faci: ${t.ceTrebuia}`),
      blocConcepte([t.concept], ctx, { eticheta: null, nou: false }))));
}

async function distribuieFinal(oprire, d) {
  const { final, state } = d;
  const azi = Math.round(d.avereNeta / state.indicePreturi);
  const suma = leiCuAzi(d.avereNeta, state.indicePreturi);
  const linie = oprire.motiv === 'pensie' ? `Am ieșit la pensie la ${ani(oprire.varsta)} cu ${suma.split(' (')[0]}.`
    : oprire.motiv === 'independenta' ? `Am devenit liber financiar la ${ani(oprire.varsta)}, cu ${suma.split(' (')[0]}.`
      : `Am ajuns la „${final?.titlu}” la ${ani(oprire.varsta)}.`;
  const sub = state.indicePreturi >= 1.05 && azi > 0 ? `Adică ${lei(azi)} în bani de azi.` : final?.descriere;
  const url = location.href.split(/[?#]/)[0];
  await distribuie({ titluFinal: final?.titlu ?? 'Final', emoji: final?.emoji, linie, sub, url, textDistribuire: `Finventure: ${linie.charAt(0).toLowerCase()}${linie.slice(1)} Tu?` });
}
