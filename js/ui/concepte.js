// Chip-uri de concept care se deschid pe loc (în toast-ul de lecție sau în cardul unui moment),
// fără să acopere ce e deja pe ecran.

import { h } from './dom.js';

export function blocConcepte(ids, ctx, { eticheta = 'Concept nou:', nou = true } = {}) {
  const concepte = ids.map((id) => ctx.concepte.get(id)).filter(Boolean);
  if (!concepte.length) return null;
  const detaliu = h('div', { class: 'concept-detaliu', hidden: true, 'aria-live': 'polite' });
  let deschis = null;
  const chips = concepte.map((c) => {
    const chip = h('button', { type: 'button', class: `chip ${nou ? 'nou' : ''}`, 'aria-expanded': 'false' }, c.titlu);
    chip.addEventListener('click', () => {
      const inchide = deschis === c.id;
      deschis = inchide ? null : c.id;
      chips.forEach((x) => x.setAttribute('aria-expanded', 'false'));
      detaliu.hidden = inchide;
      if (!inchide) {
        chip.setAttribute('aria-expanded', 'true');
        detaliu.replaceChildren(h('strong', {}, c.titlu), h('p', {}, c.text));
      }
    });
    return chip;
  });
  return h('div', {}, h('div', { class: 'toast-concepte' }, eticheta ? h('span', { class: 'mic' }, eticheta) : null, chips), detaliu);
}
