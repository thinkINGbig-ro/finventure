// Ecrane dedicate: momentele-cheie (primul salariu cu fluturașul, prima rată, prima poprire,
// primul an pe plus), rezumatul anului și finalul (versiunea simplă; Faza D adaugă „Ce s-a întâmplat?”).

import { procent, ani, h, lei, leiCuAzi, leiExact } from './dom.js';
import { nivelStil } from '../state.js';
import { blocConcepte } from './concepte.js';
import { deschideStrat, inchideStrat } from './strat.js';

function arataCard(continut, { buton = 'Continuă', eticheta } = {}) {
  return new Promise((rezolva) => {
    const inchide = () => {
      inchideStrat();
      rezolva();
    };
    const card = h('section', { class: 'card' }, continut, h('div', { class: 'rand-butoane' },
      h('button', { type: 'button', class: 'btn btn-principal', 'data-focus': '', onclick: inchide }, buton)));
    deschideStrat(card, { centrat: true, eticheta, laEscape: inchide });
  });
}

// ---------- Momente-cheie ----------

const MOMENTE = {
  primulSalariu: (d) => {
    const f = d.fluturas;
    const negru = f.contract === 'negru';
    return [
      h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, '💸'),
      h('h2', {}, 'Primul salariu!'),
      h('p', {}, negru
        ? `Ai primit ${lei(f.net)} în mână, ca ${d.job}. Fără fluturaș: nimic nu merge la pensie sau la sănătate.`
        : `Uite fluturașul tău de ${d.job}. Din brut până la ce primești pe card se rețin trei lucruri:`),
      negru ? null : h('table', { class: 'tabel' }, h('tbody', {},
        rand('Salariu brut', leiExact(f.brut)),
        f.contract === 'pfa'
          ? rand('Taxe și contribuții PFA', `− ${leiExact(f.retineri)}`, 'minus')
          : [
            rand('CAS (pensie, 25%)', `− ${leiExact(f.cas)}`, 'minus'),
            rand('CASS (sănătate, 10%)', `− ${leiExact(f.cass)}`, 'minus'),
            rand('Impozit pe venit (10%)', `− ${leiExact(f.impozit)}`, 'minus'),
          ],
        rand('Net (pe card)', leiExact(f.net), 'total'))),
      negru ? null : h('p', { class: 'mic' }, 'CAS-ul nu se pierde: din el se strânge pensia ta, inclusiv Pilonul II.'),
    ];
  },
  primaRata: (d) => [
    h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, '📆'),
    h('h2', {}, 'Prima rată'),
    h('p', {}, `Ai plătit prima rată: ${lei(d.suma)}. Mai ai ${d.ramase} ${d.ramase === 1 ? 'rată' : 'rate'}.`),
    h('p', { class: 'mic' }, 'O parte din rată e dobândă, restul scade datoria. Bugetul de luna asta tocmai s-a micșorat.'),
  ],
  primaPoprire: (d) => [
    h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, '⚖️'),
    h('h2', {}, 'Poprire pe salariu'),
    h('p', {}, `Executorul a reținut ${lei(d.retinut)} din salariul tău net de ${lei(d.net)}. Așa va fi în fiecare lună, până se acoperă datoria.`),
  ],
  primaPoprireCont: (d) => [
    h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, '🔒'),
    h('h2', {}, 'Poprire pe cont'),
    h('p', {}, `Executorul a luat ${lei(d.retinut)} direct din contul tău curent. Ți-a rămas doar suma protejată de lege.`),
  ],
  primulAnPePlus: (d) => [
    h('span', { class: 'emoji-mare', 'aria-hidden': 'true' }, '📈'),
    h('h2', {}, 'Primul an pe plus'),
    h('p', {}, `Investițiile tale au câștigat ${lei(d.castig)} anul ăsta. Banii tăi au muncit pentru tine.`),
    h('p', { class: 'mic' }, 'Un an bun nu garantează următorul. Contează orizontul lung și diversificarea.'),
  ],
};

function rand(eticheta, valoare, clasa = '') {
  return h('tr', { class: clasa }, h('td', {}, eticheta), h('td', {}, valoare));
}

export function arataMoment(oprire, ctx) {
  const continut = MOMENTE[oprire.id]?.(oprire.date) ?? [h('h2', {}, oprire.id)];
  continut.push(blocConcepte(oprire.concepte ?? [], ctx));
  return arataCard(continut, { buton: 'Mai departe', eticheta: 'Moment important' });
}

// ---------- Rezumatul anului ----------

export function arataRezumat(r, state, ctx) {
  const pusDeoparte = r.avereFinal - r.avereStart;
  const evenimenteAn = state.jurnal.filter((j) => j.varsta === r.varsta).map((j) => j.text);
  const cheltuieli = r.cheltuieliTrai + r.rate + r.comisioane;
  const pctVenit = r.venituri > 0 ? Math.round((cheltuieli / r.venituri) * 100) : null;
  const stil = nivelStil(ctx, r.stilViata);
  const anterior = r.stilAnterior && nivelStil(ctx, r.stilAnterior);
  const difStil = r.cheltuieliStilAnterior ? r.cheltuieliStil - r.cheltuieliStilAnterior : 0;
  const continut = [
    h('span', { class: 'card-cand' }, `Anul tău la ${ani(r.varsta)}`),
    h('h2', {}, pusDeoparte >= 0 ? 'Un an pe plus' : 'Un an pe minus'),
    h('table', { class: 'tabel' }, h('tbody', {},
      rand('Venituri (net)', lei(r.venituri)),
      rand('Cheltuieli de trai și facturi', `− ${lei(r.cheltuieliTrai)}`, 'minus'),
      r.rate ? rand('Rate și card de credit', `− ${lei(r.rate)}`, 'minus') : null,
      r.comisioane ? rand('Comisioane bancare', `− ${lei(r.comisioane)}`, 'minus') : null,
      r.retinutPoprire ? rand('Reținut prin poprire', `− ${lei(r.retinutPoprire)}`, 'minus') : null,
      r.dobanziPrimite ? rand('Dobânzi primite', `+ ${lei(r.dobanziPrimite)}`) : null,
      r.castigInvestitii ? rand('Investiții', `${r.castigInvestitii >= 0 ? '+' : '−'} ${lei(Math.abs(r.castigInvestitii))}`) : null,
      rand(pusDeoparte >= 0 ? 'Averea ta a crescut cu' : 'Averea ta a scăzut cu', lei(Math.abs(pusDeoparte)), 'total'))),
    h('p', {}, `Stil de viață: ${stil?.nume ?? r.stilViata}.`, pctVenit != null ? ` Ai cheltuit ${pctVenit}% din venit.` : ''),
    anterior && difStil ? h('p', { class: 'mic' }, `Cu stilul ${anterior.nume.toLowerCase()} de dinainte, ai fi cheltuit cu ${lei(Math.abs(difStil))} ${difStil > 0 ? 'mai puțin' : 'mai mult'} anul ăsta.`) : null,
    h('p', { class: 'mic' }, `Averea ta netă: ${leiCuAzi(r.avereFinal, r.indicePreturi)}.`),
    h('p', { class: 'mic' },
      `Ai cheltuit în total ${lei(cheltuieli)}.`,
      r.inflatie ? ` Prețurile au crescut cu ${procent(r.inflatie)} (inflație).` : '',
      r.crash ? ' Bursa a avut o prăbușire anul ăsta.' : '',
      r.luniCuLipsuri ? ` În ${r.luniCuLipsuri} ${r.luniCuLipsuri === 1 ? 'lună' : 'luni'} banii nu au ajuns nici de mâncare.` : ''),
    evenimenteAn.length ? h('ul', { class: 'lista-an' }, evenimenteAn.map((t) => h('li', {}, t))) : null,
  ];
  return arataCard(continut, { buton: 'Continuă', eticheta: 'Rezumatul anului' });
}

export function confirma(text, { da = 'Da', nu = 'Renunță' } = {}) {
  return new Promise((rezolva) => {
    const gata = (r) => {
      inchideStrat();
      rezolva(r);
    };
    const card = h('section', { class: 'card' },
      h('p', { class: 'card-text' }, text),
      h('div', { class: 'rand-butoane' },
        h('button', { type: 'button', class: 'btn btn-secundar', 'data-focus': '', onclick: () => gata(false) }, nu),
        h('button', { type: 'button', class: 'btn btn-principal', onclick: () => gata(true) }, da)));
    deschideStrat(card, { centrat: true, laEscape: () => gata(false) });
  });
}
