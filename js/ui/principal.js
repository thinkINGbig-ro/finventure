// Ecranul principal: antet (nume, vârstă, bani, cele 4 bare) și jurnalul vieții.

import { baniDisponibili } from '../finance.js';
import { varstaLa } from '../util.js';
import { $, ani, h, lei } from './dom.js';

const BARE = [
  ['bani', 'Bani'],
  ['fericire', 'Fericire'],
  ['energie', 'Energie'],
  ['viitor', 'Viitor'],
];

const STUDII = { facultateBuget: 'student la buget', facultateTaxa: 'student cu taxă', scoalaProfesionala: 'elev la școala profesională' };

export function creeazaEcranPrincipal(ctx) {
  const elBare = $('#bare');
  const elJurnal = $('#jurnal');
  const zonaJurnal = elJurnal.parentElement;
  let anterior = null;
  let intrariAfisate = 0;

  // Structura barelor se creează o singură dată; la fiecare randare se actualizează.
  const bare = {};
  for (const [cheie, nume] of BARE) {
    const valoare = h('b', {}, '0');
    const delta = h('span', { 'aria-hidden': 'true' });
    const umplere = h('div', { class: 'bara-umplere', style: 'width:0%' });
    const bara = h('div', { class: 'bara', role: 'meter', 'aria-label': nume, 'aria-valuemin': 0, 'aria-valuemax': 100 }, umplere);
    elBare.append(h('div', {}, h('div', { class: 'bara-cap' }, h('span', {}, nume, delta), valoare), bara));
    bare[cheie] = { valoare, delta, umplere, bara };
  }

  function randeaza(state) {
    const varsta = varstaLa(state.luna);
    const contract = state.produse.find((p) => p.tip === 'contractMunca');
    const ocupatie = [
      contract ? `${ctx.joburi.get(contract.jobId)?.titlu}${contract.contract === 'negru' ? ' (la negru)' : ''}` : null,
      state.situatie.studii ? STUDII[state.situatie.studii.id] ?? 'student' : null,
    ].filter(Boolean).join(' · ') || 'fără job';
    $('#nume').textContent = state.nume;
    $('#varsta').textContent = `${ani(varsta)} · ${ocupatie}`;

    const bani = baniDisponibili(state);
    $('#bani-total').textContent = lei(bani);
    if (anterior && bani !== anterior.bani) animaMoneda(bani - anterior.bani);

    for (const [cheie] of BARE) {
      const v = Math.round(state.stat[cheie]);
      const b = bare[cheie];
      b.valoare.textContent = v;
      b.umplere.style.width = `${v}%`;
      b.bara.setAttribute('aria-valuenow', v);
      const vechi = anterior?.stat[cheie];
      if (vechi != null && vechi !== v) {
        // Schimbarea e afișată și ca semn + număr, nu doar prin culoare.
        const d = v - vechi;
        b.delta.className = `delta ${d > 0 ? 'plus' : 'minus'}`;
        b.delta.textContent = `${d > 0 ? '▲ +' : '▼ '}${d}`;
        b.delta.replaceWith((b.delta = b.delta.cloneNode(true))); // repornește animația
      }
    }
    anterior = { bani, stat: Object.fromEntries(BARE.map(([k]) => [k, Math.round(state.stat[k])])) };
    randeazaJurnal(state);
  }

  function animaMoneda(dif) {
    const el = h('span', { class: `moneda ${dif < 0 ? 'minus' : ''}`, 'aria-hidden': 'true' }, `${dif > 0 ? '+' : '−'}${lei(Math.abs(dif))}`);
    $('.bani-sus').append(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function randeazaJurnal(state) {
    if (state.jurnal.length < intrariAfisate) {
      elJurnal.replaceChildren();
      intrariAfisate = 0;
    }
    for (const intrare of state.jurnal.slice(intrariAfisate)) {
      let grup = elJurnal.lastElementChild;
      if (!grup || Number(grup.dataset.varsta) !== intrare.varsta) {
        grup = h('li', { class: 'jurnal-an', 'data-varsta': intrare.varsta }, h('h3', {}, ani(intrare.varsta)), h('ul'));
        elJurnal.append(grup);
      }
      grup.querySelector('ul').append(h('li', { class: intrariAfisate > 0 ? 'nou' : '' }, intrare.text));
    }
    intrariAfisate = state.jurnal.length;
    zonaJurnal.scrollTop = zonaJurnal.scrollHeight;
  }

  function reseteaza() {
    anterior = null;
    intrariAfisate = 0;
    elJurnal.replaceChildren();
  }

  return { randeaza, reseteaza };
}
