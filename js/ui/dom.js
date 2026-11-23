// Utilitare mici pentru construit DOM fără framework.

import { formateazaLei, inLei } from '../util.js';

// h('button', { class: 'btn', onclick: fn }, 'text', copil, ...)
export function h(tag, attrs = {}, ...copii) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of copii.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, rad = document) => rad.querySelector(sel);

export const lei = (bani) => `${formateazaLei(Math.round(inLei(bani)))} lei`;
export const leiExact = (bani) => `${formateazaLei(inLei(bani))} lei`;

// 3.200.000 lei -> „3,2 mil. lei”; sub un milion, suma întreagă.
export function leiMare(bani) {
  const v = inLei(bani);
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} mil. lei`;
  return lei(bani);
}

// „3,2 mil. lei (≈ 980.000 lei de azi)”, când inflația a schimbat vizibil valoarea banilor.
export function leiCuAzi(bani, indicePreturi) {
  if (!indicePreturi || indicePreturi < 1.05) return leiMare(bani);
  return `${leiMare(bani)} (≈ ${leiMare(Math.round(bani / indicePreturi))} de azi)`;
}

// „18 ani”, „19 ani”, „20 de ani”, „101 ani”: „de” pentru numerele terminate în 20–99 (și 0 > 0).
export function ani(n) {
  const r = n % 100;
  return `${n} ${r === 0 && n > 0 ? 'de ' : r >= 20 ? 'de ' : ''}ani`;
}

export const procent = (x) => `${(x * 100).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%`;

export function asteapta(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
