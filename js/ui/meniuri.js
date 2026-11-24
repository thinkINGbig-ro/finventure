// Meniurile dintre „Avansează”-uri. Bancă și Concepte sunt funcționale; restul vin odată cu conținutul.

import { actiune, sansaMarire } from '../engine.js';
import { contractCurent, jobCurent } from '../cariera.js';
import { fluturas } from '../finance.js';
import { cardDisponibil, contCurent, datorieProdus, fondUrgenta, plataMinimaCard } from '../finance.js';
import { NUME_FACTURI } from '../events.js';
import { cfg, inBani, varstaLa } from '../util.js';
import { ani, h, lei, procent } from './dom.js';
import { confirma } from './ecrane.js';
import { deschideStrat, inchideStrat } from './strat.js';

const TITLURI = {
  meniu: 'Finventure', banca: 'Bancă', investitii: 'Investiții', cariera: 'Carieră', educatie: 'Educație', cumparaturi: 'Cumpărături', enciclopedie: 'Enciclopedia Finventure',
};
const IN_CURAND = {
  investitii: 'Aici vei putea cumpăra ETF-uri, acțiuni, titluri de stat, aur sau crypto și vei vedea cum crește (sau scade) portofoliul.',
  educatie: 'Aici vei putea urma cursuri, un master sau o calificare nouă.',
};

// optiuni: { state, ctx, conceptGlobale: string[], laSchimbare: () => void }
export function deschidePanou(tab, optiuni) {
  const corp = h('div', { class: 'panou-corp' });
  const panou = h('section', { class: 'card panou' },
    h('div', { class: 'panou-cap' }, h('h2', {}, TITLURI[tab]),
      h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Închide', onclick: inchideStrat }, '×')),
    corp);
  const randeaza = () => corp.replaceChildren(...continutPanou(tab, optiuni, randeaza).filter(Boolean));
  randeaza();
  deschideStrat(panou, { eticheta: TITLURI[tab], laEscape: inchideStrat });
}

function continutPanou(tab, o, reranda) {
  if (tab === 'banca') return panouBanca(o, reranda);
  if (tab === 'enciclopedie') return panouEnciclopedie(o);
  if (tab === 'cariera') return panouCariera(o, reranda);
  if (tab === 'cumparaturi') return panouCumparaturi(o, reranda);
  if (tab === 'meniu') return panouMeniu(o);
  return [h('p', {}, IN_CURAND[tab]), h('p', { class: 'mic' }, 'Vine în curând.')];
}

// ---------- Bancă ----------

// Orice acțiune din meniuri trece pe aici: rulează în motor, redesenează panoul și afișează
// mesajul întors de motor (confirmarea sau motivul refuzului) în bara de stare a panoului.
function executor({ state, ctx, laSchimbare }, reranda) {
  return (tip, param) => {
    const r = actiune(state, ctx, tip, param);
    laSchimbare();
    reranda();
    arataMesaj(r.mesaj, r.ok && r.succes !== false);
    return r;
  };
}

function arataMesaj(text, ok) {
  const m = document.querySelector('.panou .mesaj-actiune');
  if (!m) return;
  m.textContent = text;
  m.className = `mesaj-actiune ${ok ? 'ok' : 'eroare'}`;
}

function panouBanca(o, reranda) {
  const { state, ctx, laSchimbare } = o;
  const mesaj = h('p', { class: 'mesaj-actiune', role: 'status' });
  const executa = executor(o, reranda);
  const camp = (eticheta, ...butoane) => {
    const input = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', 'aria-label': eticheta, placeholder: 'Suma în lei' });
    const val = () => Number(String(input.value).replace(',', '.'));
    return h('div', { class: 'camp-suma' }, input, butoane.map(([text, fn]) =>
      h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => fn(val()) }, text)));
  };

  const varsta = varstaLa(state.luna);
  const cont = contCurent(state);
  const sectiuni = [mesaj];

  // Cont curent și numerar
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Cont curent'));
  if (cont) {
    sectiuni.push(produs(`Cont ${cont.pachet === 'tineri' ? 'pentru tineri' : 'curent'}`, lei(cont.sold),
      `Comision lunar: ${lei(inBani(cfg(ctx, cont.pachet === 'tineri' ? 'conturi.contTineri.comisionLunar' : 'conturi.contCurent.comisionLunar')))}`));
  } else {
    sectiuni.push(produs('Nu ai cont curent', '', 'Fără cont, salariul cu contract vine greu, iar banii din casă nu sunt garantați.',
      h('div', { class: 'rand-butoane' },
        varsta <= cfg(ctx, 'conturi.contTineri.varstaMaxima')
          ? h('button', { type: 'button', class: 'btn btn-principal', onclick: () => executa('deschide', { tip: 'contCurent', pachet: 'tineri' }, 'Ai cont pentru tineri.') }, 'Cont pentru tineri')
          : null,
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('deschide', { tip: 'contCurent', pachet: 'standard' }, 'Ai cont curent.') }, 'Cont standard'))));
  }
  sectiuni.push(produs('Numerar (cash)', lei(state.numerar), null,
    cont && state.numerar > 0 ? h('div', { class: 'rand-butoane' },
      h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('depune', { id: cont.id, suma: state.numerar / 100 }, 'Ai depus cash-ul în cont.') }, 'Depune tot în cont')) : null));

  // Economii
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Economii'));
  const economii = state.produse.filter((p) => p.tip === 'contEconomii');
  for (const e of economii) {
    const bifa = h('input', { type: 'checkbox', checked: e.fondUrgenta || null });
    bifa.addEventListener('change', () => executa('seteaza', { id: e.id, campuri: { fondUrgenta: bifa.checked } },
      bifa.checked ? 'Contul e acum fondul tău de urgență.' : 'Nu mai e fond de urgență.'));
    sectiuni.push(produs(e.fondUrgenta ? 'Fond de urgență' : 'Cont de economii', lei(e.sold), `Dobândă ${procent(e.dobandaAnuala)} pe an, banii se pot scoate oricând.`,
      h('label', { class: 'comutator' }, bifa, 'Folosesc contul ăsta ca fond de urgență'),
      camp('Suma pentru contul de economii',
        ['Depune', (s) => executa('depune', { id: e.id, suma: s }, 'Ai depus.')],
        ['Retrage', (s) => executa('retrage', { id: e.id, suma: s }, 'Ai retras.')])));
  }
  if (!economii.length) {
    sectiuni.push(h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('deschide', { tip: 'contEconomii' }, 'Ai deschis un cont de economii.') }, 'Deschide cont de economii')));
  }
  const fu = fondUrgenta(state);
  if (fu) sectiuni.push(h('p', { class: 'mic' }, `Fondul de urgență: ${lei(fu)}.`));

  // Depozite
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Depozite'));
  for (const d of state.produse.filter((p) => p.tip === 'depozit')) {
    sectiuni.push(produs(`Depozit ${d.luni} luni`, lei(d.sold),
      `Dobândă ${procent(d.dobandaAnuala)} pe an · mai sunt ${d.luniRamase} luni · dobândă strânsă: ${lei(d.dobandaAcumulata)}`,
      h('div', { class: 'rand-butoane' }, h('button', {
        type: 'button', class: 'btn btn-text', onclick: async () => {
          // Confirmarea înlocuiește panoul; după ea redeschidem panoul și arătăm rezultatul.
          const da = await confirma(`Spargi depozitul? Primești ${lei(d.sold)}, iar dobânda strânsă (${lei(d.dobandaAcumulata)}) se pierde.`, { da: 'Sparge' });
          const r = da ? actiune(state, ctx, 'lichideaza', { id: d.id }) : null;
          laSchimbare();
          deschidePanou('banca', o);
          if (r) arataMesaj(r.mesaj, r.ok);
        },
      }, 'Sparge depozitul'))));
  }
  sectiuni.push(camp('Suma pentru depozit nou', [`Depozit ${cfg(ctx, 'conturi.depozit.luniStandard')} luni`, (s) => executa('deschide', { tip: 'depozit', suma: s }, 'Ai deschis un depozit.')]));
  sectiuni.push(h('p', { class: 'mic' }, `Dobândă ${procent(cfg(ctx, 'conturi.depozit.dobandaAnuala'))} pe an. Dacă scoți banii înainte de termen, pierzi dobânda.`));

  // Card de credit
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Card de credit'));
  const card = state.produse.find((p) => p.tip === 'cardCredit');
  if (card) {
    const plata = h('select', { 'aria-label': 'Cum plătești extrasul' },
      h('option', { value: 'integral', selected: card.plata === 'integral' || null }, 'Achit tot extrasul (0 dobândă)'),
      h('option', { value: 'minim', selected: card.plata === 'minim' || null }, 'Plătesc doar minimul'));
    plata.addEventListener('change', () => executa('seteaza', { id: card.id, campuri: { plata: plata.value } }));
    const peCard = h('input', { type: 'checkbox', checked: card.cumparaturiPeCard || null });
    peCard.addEventListener('change', () => executa('seteaza', { id: card.id, campuri: { cumparaturiPeCard: peCard.checked } }));
    sectiuni.push(produs('Card de credit', lei(card.soldScadent + card.soldNou),
      `Limită ${lei(card.limita)} · disponibil ${lei(cardDisponibil(card))} · de plată acum ${lei(card.soldScadent)} (minim ${lei(plataMinimaCard(card.soldScadent, ctx))})`,
      h('label', { class: 'comutator' }, peCard, 'Plătesc cumpărăturile cu cardul'),
      h('label', { class: 'comutator' }, 'Extrasul: ', plata),
      card.soldScadent + card.soldNou > 0 ? h('div', { class: 'rand-butoane' },
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('ramburseaza', { id: card.id }, 'Ai achitat tot cardul.') }, 'Achită tot acum')) : null));
  } else {
    sectiuni.push(h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('deschide', { tip: 'cardCredit' }, 'Banca ți-a aprobat cardul de credit.') }, 'Cere un card de credit')));
  }

  // Datorii
  const datorii = state.produse.filter((p) => ['credit', 'factura', 'poprire'].includes(p.tip));
  if (datorii.length) {
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Datorii'));
    for (const d of datorii) sectiuni.push(produsDatorie(d, executa));
  }
  return sectiuni;
}

function produsDatorie(d, executa) {
  const ramburs = (text = 'Plătește tot') => h('div', { class: 'rand-butoane' },
    h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('ramburseaza', { id: d.id }, 'Datorie achitată.') }, text));
  if (d.tip === 'credit') {
    const titlu = d.stadiu === 'cesionat' ? 'Datorie la firma de recuperare' : d.furnizor === 'ifn' ? 'Credit IFN' : 'Credit';
    const detalii = d.stadiu === 'cesionat'
      ? `Restanță: ${lei(d.restanta)}. Urmează executarea silită.`
      : `Rata ${lei(d.rata)} · mai sunt ${d.luniRamase} rate · DAE ${procent(d.dae)}${d.restanta ? ` · restanță ${lei(d.restanta)}` : ''}`;
    return produs(titlu, lei(datorieProdus(d)), detalii, ramburs('Rambursează tot'));
  }
  if (d.tip === 'factura') return produs(`Restanță la ${NUME_FACTURI[d.furnizor]}`, lei(d.restanta), `${d.luniRestanta} ${d.luniRestanta === 1 ? 'lună' : 'luni'} de întârziere · penalități: ${lei(d.penalitati)}`, ramburs());
  return produs('Poprire', lei(d.datorie), `Reținut până acum: ${lei(d.retinutTotal)}`, ramburs());
}

function produs(titlu, valoare, detalii, ...extra) {
  return h('div', { class: 'produs' },
    h('div', { class: 'produs-cap' }, h('span', {}, titlu), h('span', {}, valoare)),
    detalii ? h('div', { class: 'mic' }, detalii) : null,
    ...extra);
}

// ---------- Carieră ----------

const NUME_CONTRACT = { cim: 'contract de muncă (CIM)', pfa: 'PFA', negru: 'la negru' };

function panouCariera(o, reranda) {
  const { state, ctx, laOprire } = o;
  const executa = executor(o, reranda);
  const mesaj = h('p', { class: 'mesaj-actiune', role: 'status' });
  const c = contractCurent(state);
  const job = jobCurent(state, ctx);
  const sectiuni = [mesaj];
  if (c) {
    const f = fluturas(c.brut, c.contract, ctx);
    const ani = Math.floor((c.luniLucrate ?? 0) / 12);
    const luni = (c.luniLucrate ?? 0) % 12;
    sectiuni.push(produs(job.titlu[0].toUpperCase() + job.titlu.slice(1), `${lei(f.net)} net`,
      `${lei(c.brut)} brut · ${NUME_CONTRACT[c.contract]} · ${job.program} · aici de ${ani ? `${ani} ani și ` : ''}${luni} luni`));
    if (c.contract !== 'negru') {
      const sansa = Math.round(sansaMarire(state, ctx) * 100);
      sectiuni.push(h('div', { class: 'rand-butoane' }, h('button', {
        type: 'button', class: 'btn btn-secundar', onclick: () => executa('cereMarire'),
      }, 'Cere o mărire')));
      sectiuni.push(h('p', { class: 'mic' }, `Șanse estimate: cam ${sansa}%. Cresc cu skill-ul, reputația și timpul de la ultima mărire.`));
    }
  } else {
    sectiuni.push(h('p', {}, 'N-ai job acum.'));
  }
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Caută alt job'));
  sectiuni.push(h('p', { class: 'mic' }, 'Îți faci CV-ul și primești până la 3 oferte. Un CV mai bun aduce oferte mai multe și mai bine plătite.'));
  sectiuni.push(h('div', { class: 'rand-butoane' }, h('button', {
    type: 'button', class: 'btn btn-principal', onclick: () => {
      const r = actiune(state, ctx, 'cautaJob');
      if (!r.ok) return arataMesaj(r.mesaj, false);
      inchideStrat();
      laOprire?.(r.oprire);
    },
  }, 'Îmi fac CV-ul')));
  return sectiuni;
}

// ---------- Cumpărături: stilul de viață ----------

function panouCumparaturi(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const niveluri = ctx.balans.stilViata.niveluri;
  const baza = Math.round(cfg(ctx, 'costTrai.mancareTransport') * state.indicePreturi * 100);
  const mesaj = h('p', { class: 'mesaj-actiune', role: 'status' });
  return [
    mesaj,
    h('h3', { class: 'sectiune-titlu' }, 'Stilul tău de viață'),
    h('p', { class: 'mic' }, 'Cât cheltui lunar pe mâncare, ieșiri, haine și transport. Un stil mai bun te bucură câteva luni, apoi te obișnuiești cu el. Cheltuiala însă rămâne.'),
    h('div', { class: 'nivel-stil' }, niveluri.map((n) => h('button', {
      type: 'button', class: 'btn btn-secundar', 'aria-pressed': String(n.id === state.stilViata),
      onclick: () => executa('stilViata', { nivel: n.id }),
    }, n.nume, h('span', { class: 'mic' }, `~${lei(Math.round(baza * n.multiplicator))} pe lună`)))),
    h('p', { class: 'mic' }, 'Telefoane, mașini și alte cumpărături mari vin curând.'),
  ];
}

// ---------- Meniul ⋯: colecția, clasamentul local, joc nou ----------

const MOTIVE = { pensie: 'pensie', independenta: 'independență', faliment: 'faliment', burnout: 'burnout', renuntare: 'renunțare' };

function panouMeniu({ ctx, colectie, laJocNou }) {
  const deblocate = new Set(colectie.finaluri);
  const toate = [...ctx.finaluri.values()].sort((a, b) => b.prioritate - a.prioritate);
  return [
    h('h3', { class: 'sectiune-titlu' }, `Finaluri descoperite: ${deblocate.size}/${toate.length}`),
    h('ul', { class: 'concept-lista' }, toate.map((f) => h('li', {}, deblocate.has(f.id)
      ? h('details', { class: 'concept' }, h('summary', {}, `${f.emoji} ${f.titlu}`), h('p', {}, f.descriere))
      : h('div', { class: 'concept final-blocat' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), '???')))),
    h('h3', { class: 'sectiune-titlu' }, 'Cele mai bune vieți pe acest dispozitiv'),
    colectie.clasament.length
      ? h('ol', { class: 'clasament' }, colectie.clasament.map((c) => h('li', {},
        h('strong', {}, c.nume), ` · ${c.final ?? MOTIVE[c.motiv]} la ${ani(c.varsta)} · ${Math.round(c.avereAzi).toLocaleString('ro-RO')} lei de azi`)))
      : h('p', { class: 'mic' }, 'Încă nicio viață terminată.'),
    h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => { inchideStrat(); laJocNou(); } }, 'Joc nou')),
  ];
}

// ---------- Enciclopedie ----------

function panouEnciclopedie({ state, ctx, conceptGlobale }) {
  const deblocate = new Set([...(conceptGlobale ?? []), ...state.concepte]);
  const toate = [...ctx.concepte.values()];
  const lista = toate.filter((c) => deblocate.has(c.id)).sort((a, b) => a.titlu.localeCompare(b.titlu, 'ro'));
  return [
    h('p', { class: 'contor-concepte' }, `Concepte deblocate: ${lista.length}/${toate.length}`),
    lista.length
      ? h('ul', { class: 'concept-lista' }, lista.map((c) => h('li', {}, h('details', { class: 'concept' }, h('summary', {}, c.titlu), h('p', {}, c.text)))))
      : h('p', { class: 'mic' }, 'Încă n-ai descoperit niciun concept. Ia decizii și le vei aduna aici.'),
  ];
}
