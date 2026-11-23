// Stratul peste ecran: un singur dialog deschis la un moment dat, cu focus ținut înăuntru
// (Tab ciclează în dialog) și Escape opțional.

import { $ } from './dom.js';

const FOCUSABILE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
let curent = null;

export function deschideStrat(continut, { centrat = false, eticheta, laEscape } = {}) {
  inchideStrat();
  const strat = $('#strat');
  const deFocus = document.activeElement;
  strat.replaceChildren(continut);
  strat.classList.toggle('centrat', centrat);
  strat.hidden = false;
  continut.setAttribute('role', 'dialog');
  continut.setAttribute('aria-modal', 'true');
  if (eticheta) continut.setAttribute('aria-label', eticheta);

  const laTasta = (e) => {
    if (e.key === 'Escape' && laEscape) {
      e.preventDefault();
      laEscape();
    } else if (e.key === 'Tab') {
      const f = [...continut.querySelectorAll(FOCUSABILE)];
      if (!f.length) return;
      const [prim, ultim] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === prim) { e.preventDefault(); ultim.focus(); }
      else if (!e.shiftKey && document.activeElement === ultim) { e.preventDefault(); prim.focus(); }
    }
  };
  const laClickFundal = (e) => { if (e.target === strat && laEscape) laEscape(); };
  document.addEventListener('keydown', laTasta);
  strat.addEventListener('click', laClickFundal);

  curent = () => {
    document.removeEventListener('keydown', laTasta);
    strat.removeEventListener('click', laClickFundal);
    strat.hidden = true;
    strat.replaceChildren();
    curent = null;
    if (deFocus?.isConnected) deFocus.focus();
  };
  focuseaza(continut);
  return curent;
}

export function focuseaza(continut) {
  requestAnimationFrame(() => (continut.querySelector('[data-focus]') ?? continut.querySelector(FOCUSABILE))?.focus());
}

export function inchideStrat() {
  curent?.();
}

export const stratDeschis = () => curent != null;
