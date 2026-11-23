// Lecția scurtă de după o alegere: toast care nu blochează jocul.
// Dispare singur, dar rămâne cât timp jucătorul a deschis un concept sau ține focusul/mouse-ul pe el.

import { $, h } from './dom.js';
import { blocConcepte } from './concepte.js';

const DURATA = 8000;

export function arataLectie({ lectie, concepteNoi = [] }, ctx) {
  if (!lectie && !concepteNoi.length) return;
  const inchide = () => {
    toast.classList.add('iese');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  const toast = h('div', { class: 'toast', role: 'status' },
    h('div', { class: 'toast-text' }, lectie ?? 'Ai descoperit un concept nou.', blocConcepte(concepteNoi, ctx)),
    h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Închide lecția', onclick: inchide }, '×'));

  let timer = setTimeout(inchide, DURATA);
  const pauza = () => clearTimeout(timer);
  const reia = () => {
    if (toast.querySelector('[aria-expanded="true"]')) return; // un concept e deschis: rămâne
    clearTimeout(timer);
    timer = setTimeout(inchide, DURATA / 2);
  };
  toast.addEventListener('pointerenter', pauza);
  toast.addEventListener('pointerleave', reia);
  toast.addEventListener('focusin', pauza);
  toast.addEventListener('focusout', reia);
  toast.addEventListener('click', pauza);

  const zona = $('#toasturi');
  while (zona.children.length >= 2) zona.firstElementChild.remove();
  zona.append(toast);
}
