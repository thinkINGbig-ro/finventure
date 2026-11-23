// Cardul de eveniment: alegeri ca butoane (max. 4), grupuri în doi pași, alegerile indisponibile
// vizibile cu motivul. Cu fix 2 alegeri disponibile se poate face swipe stânga/dreapta.
// Tastatură: 1–4 alege, Escape/Backspace revine din al doilea pas.

import { ani, h } from './dom.js';
import { deschideStrat, focuseaza, inchideStrat } from './strat.js';

const PRAG_SWIPE = 110;

// Întoarce o promisiune cu calea aleasă („id” sau „grup/sub”).
export function arataEveniment(oprire) {
  return new Promise((rezolva) => {
    const card = h('section', { class: 'card card-eveniment' });
    let grupDeschis = null;

    const cand = oprire.eticheta ?? `${oprire.numeLuna}, ${ani(oprire.varsta)}`;
    const alege = (cale) => {
      document.removeEventListener('keydown', laTasta);
      inchideStrat();
      rezolva(cale);
    };

    function randeaza() {
      const lista = grupDeschis ? grupDeschis.subalegeri : oprire.alegeri;
      const butoane = lista.map((a, i) => butonAlegere(a, i, () => {
        if (a.grup) {
          grupDeschis = a;
          randeaza();
        } else alege(a.cale);
      }));
      card.replaceChildren(...[
        h('span', { class: 'card-cand' }, cand),
        oprire.titlu ? h('h2', { id: 'titlu-ev' }, oprire.titlu) : null,
        h('p', { class: 'card-text' }, oprire.text),
        grupDeschis ? h('p', { class: 'subtitlu-pas' }, `${grupDeschis.eticheta}:`) : null,
        h('div', { class: 'alegeri' }, butoane),
        grupDeschis ? h('button', { type: 'button', class: 'btn-inapoi', onclick: inapoi }, '‹ Înapoi la variante') : null,
        indiciuSwipe(lista),
      ].filter(Boolean));
      activeazaSwipe(card, lista, alege);
      focuseaza(card);
    }

    function inapoi() {
      grupDeschis = null;
      randeaza();
    }

    function laTasta(e) {
      const lista = grupDeschis ? grupDeschis.subalegeri : oprire.alegeri;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < lista.length) {
        e.preventDefault();
        card.querySelectorAll('.alegere')[i]?.click();
      } else if ((e.key === 'Backspace' || e.key === 'Escape') && grupDeschis) {
        e.preventDefault();
        inapoi();
      }
    }

    document.addEventListener('keydown', laTasta);
    deschideStrat(card, { eticheta: oprire.titlu ?? 'Eveniment' });
    randeaza();
  });
}

function butonAlegere(a, i, laAlegere) {
  const btn = h('button', {
    type: 'button',
    class: `alegere ${a.grup ? 'grup' : ''}`,
    'aria-disabled': a.disponibil ? null : 'true',
    'data-focus': i === 0 && a.disponibil ? '' : null,
  },
  a.eticheta,
  a.disponibil ? null : h('span', { class: 'motiv' }, a.motiv),
  h('span', { class: 'tasta', 'aria-hidden': 'true' }, i + 1));
  btn.addEventListener('click', () => {
    if (!a.disponibil) {
      btn.classList.remove('scutura');
      void btn.offsetWidth;
      btn.classList.add('scutura');
      return;
    }
    laAlegere();
  });
  return btn;
}

function disponibilePentruSwipe(lista) {
  return lista.length === 2 && lista.every((a) => !a.grup) ? lista : null;
}

function indiciuSwipe(lista) {
  const doua = disponibilePentruSwipe(lista);
  if (!doua) return null;
  return h('div', { class: 'indiciu-swipe', 'aria-hidden': 'true' }, h('span', {}, '← trage'), h('span', {}, 'trage →'));
}

// Swipe: stânga = prima alegere, dreapta = a doua. O alegere indisponibilă nu se poate alege prin swipe.
function activeazaSwipe(card, lista, alege) {
  const doua = disponibilePentruSwipe(lista);
  card.onpointerdown = null;
  if (!doua) return;
  const [stanga, dreapta] = doua;
  const etStanga = h('span', { class: 'eticheta-swipe stanga', 'aria-hidden': 'true' }, stanga.eticheta);
  const etDreapta = h('span', { class: 'eticheta-swipe dreapta', 'aria-hidden': 'true' }, dreapta.eticheta);
  card.append(etStanga, etDreapta);

  let start = null;
  card.onpointerdown = (e) => {
    if (e.target.closest('button') || e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    card.classList.add('trage');
    card.classList.remove('revine');
    try { card.setPointerCapture(e.pointerId); } catch { /* pointer deja eliberat */ }
  };
  card.onpointermove = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
    const p = Math.min(1, Math.abs(dx) / PRAG_SWIPE);
    etStanga.style.opacity = dx < 0 ? p : 0;
    etDreapta.style.opacity = dx > 0 ? p : 0;
  };
  card.onpointerup = card.onpointercancel = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    start = null;
    card.classList.remove('trage');
    const tinta = dx <= -PRAG_SWIPE ? stanga : dx >= PRAG_SWIPE ? dreapta : null;
    if (tinta?.disponibil) {
      card.style.transform = `translateX(${Math.sign(dx) * 600}px) rotate(${Math.sign(dx) * 20}deg)`;
      setTimeout(() => alege(tinta.cale), 180);
      return;
    }
    card.classList.add('revine');
    card.style.transform = '';
    etStanga.style.opacity = etDreapta.style.opacity = 0;
    if (tinta) card.querySelectorAll('.alegere')[tinta === stanga ? 0 : 1].click(); // arată motivul (scutură)
  };
}
