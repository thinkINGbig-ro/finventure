// Modul debug (index.html?debug=1): unelte pentru echipă, nu pentru jucători.
// Sari la o vârstă, setezi statistici și flag-uri, forțezi un eveniment, vezi starea, rulezi simularea.

import { alege, avanseaza, continua, forteazaEveniment } from '../engine.js';
import { actualizeazaDerivate, seteazaFlag } from '../state.js';
import { PROFILURI, formateazaRaport, simuleazaVieti } from '../simulare.js';
import { inBani, varstaLa } from '../util.js';
import { ani, h } from './dom.js';
import { deschideStrat, inchideStrat } from './strat.js';

// optiuni: { ctx, getState, ruleaza(oprire), randeaza() }
export function initDebug(optiuni) {
  const buton = h('button', { type: 'button', class: 'btn-debug', 'aria-label': 'Deschide modul debug', onclick: () => deschide(optiuni) }, '🐞');
  document.querySelector('.antet-sus').append(buton);
  document.title = `[debug] ${document.title}`;
}

function deschide({ ctx, getState, ruleaza, randeaza }) {
  const state = getState();
  const mesaj = h('p', { class: 'mesaj-actiune', role: 'status' });
  const spune = (text, ok = true) => {
    mesaj.textContent = text;
    mesaj.className = `mesaj-actiune ${ok ? 'ok' : 'eroare'}`;
  };
  const camp = (eticheta, valoare, tip = 'number') => {
    const input = h('input', { type: tip, value: valoare, 'aria-label': eticheta });
    return { input, el: h('label', { class: 'debug-camp' }, h('span', {}, eticheta), input) };
  };

  // Sari la o vârstă: joacă automat cu prima alegere disponibilă.
  const varsta = camp('Vârsta țintă', varstaLa(state.luna) + 5);
  const sari = () => {
    const tinta = Number(varsta.input.value);
    let o = state.pendinte ? null : avanseaza(state, ctx);
    let pasi = 0;
    while (!state.final && pasi++ < 5000) {
      if (!o) {
        if (varstaLa(state.luna) >= tinta) break;
        o = avanseaza(state, ctx);
        continue;
      }
      if (o.tip === 'eveniment') {
        const a = o.alegeri.find((x) => x.disponibil);
        o = alege(state, ctx, a.grup ? a.subalegeri.find((s) => s.disponibil).cale : a.cale).oprire;
      } else if (o.tip === 'final') break;
      else o = continua(state, ctx);
    }
    randeaza();
    spune(state.final ? `Jocul s-a terminat (${state.final.motiv}) la ${ani(varstaLa(state.luna))}.` : `Acum ai ${ani(varstaLa(state.luna))}.`);
  };

  // Statistici
  const stats = [
    ...['fericire', 'energie'].map((k) => [k, camp(k, Math.round(state.stat[k])), (v) => { state.stat[k] = v; }]),
    ...['skill', 'scorCredit', 'retea', 'reputatie'].map((k) => [k, camp(k, Math.round(state.ascunse[k])), (v) => { state.ascunse[k] = v; }]),
    ['numerar (lei)', camp('numerar (lei)', Math.round(state.numerar / 100)), (v) => { state.numerar = inBani(v); }],
  ];
  const aplicaStats = () => {
    for (const [, c, set] of stats) set(Number(c.input.value));
    actualizeazaDerivate(state, ctx);
    randeaza();
    spune('Statistici aplicate.');
  };

  // Flag-uri
  const flag = camp('Flag (nume sau nume:luni)', '', 'text');
  const flaguri = h('p', { class: 'mic' });
  const arataFlaguri = () => { flaguri.textContent = Object.keys(state.flaguri).join(', ') || '(niciun flag)'; };
  arataFlaguri();

  // Evenimente
  const select = h('select', { 'aria-label': 'Eveniment' }, [...ctx.evenimente.keys()].sort().map((id) => h('option', { value: id }, id)));
  const forteaza = () => {
    if (state.pendinte) return spune('Termină întâi oprirea curentă.', false);
    const o = forteazaEveniment(state, ctx, select.value);
    inchideStrat();
    ruleaza(o);
  };

  // Simulare
  const n = camp('Vieți per profil', 100);
  const profil = h('select', { 'aria-label': 'Profil' }, h('option', { value: '' }, 'toate profilurile'), Object.keys(PROFILURI).map((p) => h('option', { value: p }, p)));
  const raport = h('pre', { class: 'debug-pre' });
  const simuleaza = () => {
    raport.textContent = 'Rulez… (pagina poate îngheța câteva secunde)';
    setTimeout(() => {
      const profiluri = profil.value ? [profil.value] : Object.keys(PROFILURI);
      const t = performance.now();
      const r = profiluri.map((p) => simuleazaVieti(ctx, { n: Number(n.input.value), seed: `debug-${Date.now()}`, profil: p }));
      raport.textContent = `${formateazaRaport(r)}\n\n(${((performance.now() - t) / 1000).toFixed(1)} s)`;
    }, 30);
  };

  const stare = h('pre', { class: 'debug-pre' }, JSON.stringify({ ...state, jurnal: `[${state.jurnal.length} intrări]` }, null, 2));

  const panou = h('section', { class: 'card panou' },
    h('div', { class: 'panou-cap' }, h('h2', {}, '🐞 Debug'), h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Închide', onclick: inchideStrat }, '×')),
    h('div', { class: 'panou-corp' },
      mesaj,
      h('h3', { class: 'sectiune-titlu' }, 'Sari la o vârstă'),
      h('p', { class: 'mic' }, 'Joacă automat, alegând prima variantă disponibilă.'),
      h('div', { class: 'camp-suma' }, varsta.el, h('button', { type: 'button', class: 'btn btn-secundar', onclick: sari }, 'Sari')),
      h('h3', { class: 'sectiune-titlu' }, 'Statistici'),
      h('div', { class: 'debug-grila' }, stats.map(([, c]) => c.el)),
      h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: aplicaStats }, 'Aplică')),
      h('h3', { class: 'sectiune-titlu' }, 'Flag-uri'),
      flaguri,
      h('div', { class: 'camp-suma' }, flag.el,
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => { if (flag.input.value) seteazaFlag(state, flag.input.value.trim()); arataFlaguri(); spune('Flag setat.'); } }, 'Setează'),
        h('button', { type: 'button', class: 'btn btn-text', onclick: () => { delete state.flaguri[flag.input.value.split(':')[0].trim()]; arataFlaguri(); spune('Flag șters.'); } }, 'Șterge')),
      h('h3', { class: 'sectiune-titlu' }, 'Forțează un eveniment'),
      h('div', { class: 'camp-suma' }, select, h('button', { type: 'button', class: 'btn btn-secundar', onclick: forteaza }, 'Arată')),
      h('h3', { class: 'sectiune-titlu' }, 'Simulare automată'),
      h('div', { class: 'camp-suma' }, n.el, profil, h('button', { type: 'button', class: 'btn btn-secundar', onclick: simuleaza }, 'Rulează')),
      raport,
      h('details', {}, h('summary', { class: 'sectiune-titlu' }, 'Starea completă'), stare)));
  deschideStrat(panou, { eticheta: 'Debug', laEscape: inchideStrat });
}
