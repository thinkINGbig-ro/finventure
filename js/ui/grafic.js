// Grafic cu linii în SVG (fără biblioteci): o singură axă Y, legendă (pentru ≥ 2 serii), etichete
// directe la capătul liniilor, linie verticală + tooltip la hover / tastatură, și tabelul cu valori.
// Culorile sunt validate pentru fundalul închis (scripts/validate_palette.js din ghidul dataviz):
// albastru #6E86EE și portocaliu #D9692A; a doua serie e și punctată, ca să nu depindă doar de culoare.

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  return el;
};

export const CULORI_GRAFIC = ['#6E86EE', '#D9692A'];

// opt: { titlu, x: [etichete], serii: [{ nume, valori: [număr], punctata? }], format: (v) => text, eticheta X (ex. „ani”) }
export function graficLinii({ titlu, x, serii, format, unitateX = '' }) {
  const W = 320;
  const H = 170;
  const st = 44;
  const dr = 12;
  const sus = 10;
  const jos = 22;
  const toate = serii.flatMap((sr) => sr.valori);
  const min = Math.min(0, ...toate);
  const max = Math.max(1, ...toate);
  const px = (i) => st + (x.length === 1 ? 0 : (i / (x.length - 1)) * (W - st - dr));
  const py = (v) => sus + (1 - (v - min) / (max - min)) * (H - sus - jos);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafic', role: 'img', tabindex: '0', 'aria-label': `${titlu}. Folosește săgețile pentru valori.` });
  // grilă discretă: 0, jumătate, maxim
  for (const v of [min, (min + max) / 2, max]) {
    svg.append(s('line', { x1: st, x2: W - dr, y1: py(v), y2: py(v), class: 'grafic-grila' }));
    const t = s('text', { x: st - 6, y: py(v) + 4, class: 'grafic-axa', 'text-anchor': 'end' });
    t.textContent = scurt(v);
    svg.append(t);
  }
  for (const i of [0, x.length - 1]) {
    const t = s('text', { x: px(i), y: H - 6, class: 'grafic-axa', 'text-anchor': i ? 'end' : 'start' });
    t.textContent = `${x[i]}${unitateX}`;
    svg.append(t);
  }
  serii.forEach((sr, k) => {
    const d = sr.valori.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    svg.append(s('path', { d, class: 'grafic-linie', stroke: CULORI_GRAFIC[k], 'stroke-dasharray': sr.punctata ? '5 4' : null }));
  });

  // Hover / tastatură: linie verticală, puncte și tooltip.
  const ghid = s('line', { y1: sus, y2: H - jos, class: 'grafic-ghid', visibility: 'hidden' });
  const puncte = serii.map((_, k) => s('circle', { r: 4, fill: CULORI_GRAFIC[k], class: 'grafic-punct', visibility: 'hidden' }));
  svg.append(ghid, ...puncte);
  const tooltip = h('div', { class: 'grafic-tooltip', hidden: true, role: 'status' });
  let curent = null;
  const arata = (i) => {
    curent = Math.max(0, Math.min(x.length - 1, i));
    ghid.setAttribute('x1', px(curent));
    ghid.setAttribute('x2', px(curent));
    ghid.setAttribute('visibility', 'visible');
    serii.forEach((sr, k) => {
      puncte[k].setAttribute('cx', px(curent));
      puncte[k].setAttribute('cy', py(sr.valori[curent]));
      puncte[k].setAttribute('visibility', 'visible');
    });
    tooltip.replaceChildren(h('strong', {}, `${x[curent]}${unitateX}`),
      ...serii.map((sr, k) => h('div', {}, h('span', { class: 'grafic-cheie', style: `background:${CULORI_GRAFIC[k]}` }), `${sr.nume}: ${format(sr.valori[curent])}`)));
    tooltip.hidden = false;
    tooltip.style.left = `${(px(curent) / W) * 100}%`;
  };
  const ascunde = () => {
    curent = null;
    ghid.setAttribute('visibility', 'hidden');
    puncte.forEach((p) => p.setAttribute('visibility', 'hidden'));
    tooltip.hidden = true;
  };
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const xSvg = ((e.clientX - r.left) / r.width) * W;
    arata(Math.round(((xSvg - st) / (W - st - dr)) * (x.length - 1)));
  });
  svg.addEventListener('pointerleave', ascunde);
  svg.addEventListener('blur', ascunde);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      arata((curent ?? (e.key === 'ArrowRight' ? -1 : x.length)) + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Escape') ascunde();
  });

  const ultim = x.length - 1;
  return h('figure', { class: 'grafic-bloc' },
    h('figcaption', { class: 'sectiune-titlu' }, titlu),
    serii.length > 1 ? h('div', { class: 'grafic-legenda' }, serii.map((sr, k) => h('span', {},
      h('span', { class: `grafic-cheie ${sr.punctata ? 'punctata' : ''}`, style: `--c:${CULORI_GRAFIC[k]}` }),
      `${sr.nume}: ${format(sr.valori[ultim])}`))) : h('div', { class: 'mic' }, `Acum: ${format(serii[0].valori[ultim])}`),
    h('div', { class: 'grafic-zona' }, svg, tooltip),
    h('details', { class: 'grafic-tabel' }, h('summary', { class: 'mic' }, 'Vezi valorile în tabel'),
      h('table', { class: 'tabel' }, h('thead', {}, h('tr', {}, h('th', {}, unitateX ? 'Vârsta' : ''), serii.map((sr) => h('th', {}, sr.nume)))),
        h('tbody', {}, x.map((xi, i) => h('tr', {}, h('td', {}, `${xi}${unitateX}`), serii.map((sr) => h('td', {}, format(sr.valori[i])))))))));
}

// 1.250.000 -> „1,3 mil.”, 48.000 -> „48 mii”
function scurt(lei) {
  const a = Math.abs(lei);
  if (a >= 1e6) return `${(lei / 1e6).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} mil.`;
  if (a >= 1e3) return `${Math.round(lei / 1e3)} mii`;
  return `${Math.round(lei)}`;
}
