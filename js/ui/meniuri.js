// Meniurile dintre „Avansează”-uri: Activități, Bancă (cu „Datoriile mele”), Carieră, Cumpărături,
// Enciclopedia și meniul jocului. Fiecare acțiune trece prin motor și afișează mesajul întors.

import { actiune, sansaMarire } from '../engine.js';
import { RITMURI, contractCurent, jobCurent, luniPanaLaPromovare } from '../cariera.js';
import { cardDisponibil, contCurent, fluturas, fondUrgenta, plataMinimaCard, pret } from '../finance.js';
import { descrieSecundare, simuleazaOreSuplimentare } from '../munca.js';
import { afacereActiva, simuleazaExtindere, simuleazaPornire, simuleazaVanzare as simuleazaVanzareFirma } from '../afacere.js';
import { areFlag } from '../state.js';
import { bunuriDetinute, descrieCatalog } from '../cumparaturi.js';
import { bal, cfg, inBani, varstaLa } from '../util.js';
import { ani, h, lei, procent } from './dom.js';
import { confirma } from './ecrane.js';
import { deschideStrat, inchideStrat } from './strat.js';
import { descrieActivitati, timpPeAn, timpRamas } from '../activitati.js';
import { datoriiTotal, listaDatorii, simuleazaConsolidare, simuleazaEsalonare, simuleazaRambursare } from '../datorii.js';
import { descrieAsigurari } from '../asigurari.js';
import { bugetFamilie } from '../familie.js';
import { descrieCurs, descrieProgram } from '../educatie.js';
import { companieFalimentata, infoClasa, portofoliu } from '../investitii.js';
import { baniDisponibili, paramClasa } from '../finance.js';
import { graficLinii } from './grafic.js';
import { descrieImobile, simuleazaCumparare } from '../imobiliare.js';

const TITLURI = {
  meniu: 'Finventure', activitati: 'Activități', banca: 'Bancă', datorii: 'Datoriile mele', afacere: 'Afacerea ta', investitii: 'Investiții', cariera: 'Carieră', educatie: 'Educație', cumparaturi: 'Cumpărături', enciclopedie: 'Enciclopedia Finventure',
};
const IN_CURAND = {};

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
  if (tab === 'activitati') return panouActivitati(o, reranda);
  if (tab === 'banca') return panouBanca(o, reranda);
  if (tab === 'datorii') return panouDatorii(o, reranda);
  if (tab === 'educatie') return panouEducatie(o, reranda);
  if (tab === 'investitii') return panouInvestitii(o, reranda);
  if (tab === 'afacere') return panouAfacere(o, reranda);
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
    arataMesaj(r.mesaj, r.ok && r.succes !== false, r.lectie);
    return r;
  };
}

function arataMesaj(text, ok, lectie) {
  const m = document.querySelector('.panou .mesaj-actiune');
  if (!m) return;
  m.replaceChildren(text, lectie ? h('span', { class: 'mesaj-lectie' }, lectie) : '');
  m.className = `mesaj-actiune ${ok ? 'ok' : 'eroare'}`;
}

// ---------- Investiții ----------

// Câmp de sumă + butoane: [[text, (suma) => ...], ...]
function campSuma(eticheta, butoane, placeholder = 'Suma în lei') {
  const input = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', 'aria-label': eticheta, placeholder });
  const val = () => Number(String(input.value).replace(',', '.'));
  return h('div', { class: 'camp-suma' }, input, butoane.map(([text, fn]) => h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => fn(val()) }, text)));
}

const semn = (bani) => `${bani >= 0 ? '+' : '−'} ${lei(Math.abs(bani))}`;

function panouInvestitii(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const port = portofoliu(state, ctx);
  const sectiuni = [h('p', { class: 'mesaj-actiune', role: 'status' })];

  // Portofoliul: total, câștig, comisioane, grafic
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Portofoliul tău'));
  if (port.total) {
    const castig = port.total - port.cost;
    sectiuni.push(produs('Valoare acum', lei(port.total),
      `Ai pus ${lei(port.cost)} · ${castig >= 0 ? 'câștig' : 'pierdere'} pe hârtie: ${semn(castig)} · comisioane plătite până acum: ${lei(port.comisioane)}`));
  } else {
    sectiuni.push(h('p', { class: 'mic' }, 'N-ai încă investiții. Investește doar bani de care nu ai nevoie câțiva ani și după ce ai un fond de urgență.'));
  }
  const ist = port.istoric.filter((p) => p.investitii > 0 || p.investit > 0);
  if (ist.length >= 2) {
    sectiuni.push(graficLinii({
      titlu: 'Cât valorează și cât ai pus, an de an',
      x: ist.map((p) => p.varsta), unitateX: ' ani',
      serii: [{ nume: 'Valoare', valori: ist.map((p) => p.investitii / 100) }, { nume: 'Ai pus', valori: ist.map((p) => p.investit / 100), punctata: true }],
      format: (v) => `${Math.round(v).toLocaleString('ro-RO')} lei`,
    }));
  }
  for (const r of port.randuri) {
    const vandabil = r.clasa !== 'titluriStat' && !r.falimentata;
    sectiuni.push(produs(`${r.emoji} ${r.titlu}`, lei(r.valoare),
      r.falimentata ? 'Compania a dat faliment.' : `${Math.round(r.pondere * 100)}% din portofoliu · ${semn(r.castig)} față de ce ai pus`,
      h('div', { class: 'bara-pondere', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(r.pondere * 100)}%` })),
      vandabil ? campSuma(`Suma de vândut din ${r.titlu}`, [
        ['Vinde', (s) => executa('vinde', { clasa: r.clasa, suma: s })],
        ['Vinde tot', () => executa('vinde', { clasa: r.clasa })],
      ]) : r.clasa === 'titluriStat' ? h('div', { class: 'mic' }, 'Banii se întorc singuri la scadență.') : null));
  }

  // Cumpără
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Investește'),
    h('p', { class: 'mic' }, `Bani disponibili: ${lei(baniDisponibili(state))}. Fiecare cumpărare are un comision; ETF-urile și fondurile au și un comision anual.`));
  const linieClasa = (id, info) => {
    const comision = paramClasa(ctx, id, 'comision');
    const anual = paramClasa(ctx, id, 'comisionAnual');
    const falimentata = companieFalimentata(state, id);
    return produs(`${info.emoji} ${info.titlu}`, info.risc ? `risc ${info.risc}` : info.sector ?? '', info.descriere,
      h('div', { class: 'mic' }, `Comision la cumpărare ${procent(comision)}${anual ? ` · comision anual ${procent(anual)}` : ''}`),
      falimentata ? h('div', { class: 'mic restanta' }, 'A dat faliment.')
        : campSuma(`Suma de investit în ${info.titlu}`, [['Investește', (s) => executa('investeste', { clasa: id, suma: s })]]));
  };
  for (const [id, info] of ctx.investitii.clase) sectiuni.push(linieClasa(id, info));
  sectiuni.push(h('details', { class: 'detalii-companii' },
    h('summary', { class: 'sectiune-titlu' }, 'Acțiuni la companii (inventate, risc mare)'),
    h('p', { class: 'mic' }, 'O singură companie poate să se dubleze sau să dea faliment. Nu pune aici bani pe care nu-ți permiți să-i pierzi.'),
    [...ctx.investitii.companii].map(([id, info]) => linieClasa(id, { ...info, risc: null }))));

  // Investiție automată lunară
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Investiție automată lunară'),
    h('p', { class: 'mic' }, 'Se investește singură în fiecare lună, după ce ai plătit tot. Dacă într-o lună banii nu ajung, sare luna.'));
  for (const d of port.dca) {
    const nume = d.clasa === 'pilon3' ? 'Pilonul III' : infoClasa(ctx, d.clasa)?.titlu ?? d.clasa;
    sectiuni.push(produs(`🔁 ${nume}`, `${lei(d.suma)} / lună`, d.luniSarite ? `Luni sărite până acum (fără bani): ${d.luniSarite}` : null,
      h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-text', onclick: () => executa('seteazaDCA', { clasa: d.clasa, suma: 0 }) }, 'Oprește'))));
  }
  const tinta = h('select', { 'aria-label': 'Unde investești lunar' },
    h('option', { value: 'etf' }, 'ETF pe bursa mondială'), h('option', { value: 'pilon3' }, 'Pilonul III (pensie privată)'),
    [...ctx.investitii.clase].filter(([id]) => !['etf', 'titluriStat'].includes(id)).map(([id, c]) => h('option', { value: id }, c.titlu)));
  sectiuni.push(h('label', { class: 'comutator' }, 'Unde: ', tinta),
    campSuma('Suma lunară', [['Setează', (s) => executa('seteazaDCA', { clasa: tinta.value, suma: s })]], 'Lei pe lună'));

  // Pilonul III și II
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Pensia ta privată'),
    produs('Pilonul III', lei(port.pilon3), 'Pensie facultativă: o alimentezi tu (sau firma). Banii se pot scoate de la 60 de ani.',
      campSuma('Suma de depus în Pilonul III', [['Depune', (s) => executa('depunePilon3', { suma: s })]])),
    produs('Pilonul II', lei(port.pilon2), 'Se alimentează singur din CAS-ul de pe fluturaș, cât lucrezi cu contract.'));

  // Imobiliare de închiriat
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Imobiliare de închiriat'));
  for (const im of descrieImobile(state, ctx)) {
    const stare = im.chirias ? `Închiriat cu ${lei(im.chirie)} pe lună` : im.luniGol ? `Gol de ${NUME_LUNI(im.luniGol)}: cauți chiriaș` : 'Gol: cauți chiriaș';
    sectiuni.push(produs(`🏠 ${im.titlu}`, lei(im.valoare),
      `${stare} · costuri de proprietar ${lei(im.cost)} pe lună${im.rata ? ` · rata ${lei(im.rata)}` : ''} · chirie încasată netă până acum: ${lei(im.chirieIncasata)}`,
      h('div', { class: 'mic' }, `Dacă vinzi acum primești ${lei(im.vanzare.net)} (comision ${lei(im.vanzare.comision)}, impozit ${lei(im.vanzare.impozit)}${im.vanzare.datorie ? `, creditul ${lei(im.vanzare.datorie)}` : ''}).`),
      h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-text', onclick: () => executa('vindeImobil', { id: im.id }) }, 'Vinde'))));
  }
  for (const marime of ['garsoniera', 'apartament']) {
    const cash = simuleazaCumparare(state, ctx, marime, 'cash');
    const credit = simuleazaCumparare(state, ctx, marime, 'credit');
    sectiuni.push(produs(marime === 'garsoniera' ? '🏢 Cumpără o garsonieră de închiriat' : '🏢 Cumpără un apartament de închiriat', lei(cash.valoare),
      `Chirie de piață cam ${lei(cash.chirie)} pe lună · randament net estimat ${procent(cash.randamentNet)} pe an (înainte de lunile goale și reparații) · costuri la cumpărare ${lei(cash.costuri)}`,
      h('div', { class: 'mic' }, `Cu credit: avans + costuri ${lei(credit.dePlatit)}, rata ${lei(credit.rata ?? 0)} pe lună, DAE ${procent(credit.dae ?? 0)}.`),
      h('div', { class: 'rand-butoane' },
        h('button', { type: 'button', class: 'btn btn-secundar', 'aria-disabled': cash.ok ? null : 'true', onclick: () => (cash.ok ? executa('cumparaImobil', { marime, finantare: 'cash' }) : arataMesaj(cash.mesaj, false)) }, 'Cash'),
        h('button', { type: 'button', class: 'btn btn-secundar', 'aria-disabled': credit.ok ? null : 'true', onclick: () => (credit.ok ? executa('cumparaImobil', { marime, finantare: 'credit' }) : arataMesaj(credit.mesaj, false)) }, 'Cu credit')),
      !cash.ok && !credit.ok ? h('div', { class: 'mic motiv-indisponibil' }, credit.mesaj) : null));
  }

  // Rebalansare
  if (port.total) {
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Rebalansează'),
      h('p', { class: 'mic' }, 'Aduce portofoliul la proporțiile unei strategii: vinde ce e peste, cumpără ce e sub. Costă comisioane (și impozit pe câștigul vândut). Titlurile de stat nu se vând.'));
    for (const [id, st] of ctx.investitii.strategii) {
      const alocare = Object.entries(st.alocare).map(([c, w]) => `${Math.round(w * 100)}% ${infoClasa(ctx, c)?.titlu ?? c}`).join(', ');
      sectiuni.push(produs(`${st.titlu}${state.tintaInvestitii === id ? ' (strategia ta)' : ''}`, '', `${st.descriere} ${alocare}.`,
        h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('rebalanseaza', { strategie: id }) }, 'Rebalansează așa'))));
    }
  }
  return sectiuni;
}

// ---------- Educație ----------

const NUME_ANI = (luni) => (luni % 12 ? NUME_LUNI(luni) : luni === 12 ? '1 an' : `${luni / 12} ani`);

function randTimp(state, ctx) {
  const total = timpPeAn(state, ctx);
  const ramas = timpRamas(state, ctx);
  return h('div', { class: 'timp-an' },
    h('span', {}, `Timp anul ăsta: ${ramas} din ${total} ${total === 1 ? 'acțiune mare' : 'acțiuni mari'}`),
    h('span', { class: 'timp-puncte', 'aria-hidden': 'true' }, Array.from({ length: total }, (_, i) => h('span', { class: i < ramas ? 'punct plin' : 'punct' }))));
}

function panouEducatie(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const sectiuni = [h('p', { class: 'mesaj-actiune', role: 'status' }), randTimp(state, ctx)];

  const s = state.situatie.studii;
  if (s) {
    const p = ctx.educatie.programe.get(s.id);
    const info = [`mai ai ${NUME_ANI(s.luniRamase)}`, s.taxaPlatita ? 'taxa e plătită cu credit de studii' : null, s.bursa ? 'ai bursă' : null].filter(Boolean).join(' · ');
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Acum studiezi'),
      produs(`${p?.emoji ?? '🎓'} ${p?.titlu ?? 'Studii'}`, '', info,
        h('div', { class: 'rand-butoane' }, h('button', {
          type: 'button', class: 'btn btn-text', onclick: async () => {
            const da = await confirma('Renunți la studii? Taxele plătite nu se mai întorc, iar diploma nu o mai primești.', { da: 'Renunț' });
            const r = da ? actiune(state, ctx, 'renuntaStudii') : null;
            o.laSchimbare();
            deschidePanou('educatie', o);
            if (r) arataMesaj(r.mesaj, r.ok, r.lectie);
          },
        }, 'Renunț la studii'))));
  }
  for (const activ of state.cursuri ?? []) {
    const c = ctx.educatie.cursuri.get(activ.id);
    if (c) sectiuni.push(produs(`${c.emoji} ${c.titlu}`, '', `În curs: mai ai ${NUME_LUNI(activ.luniRamase)}.`));
  }

  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Studii'),
    h('p', { class: 'mic' }, 'Te poți înscrie la orice vârstă. Un program lung ia o acțiune din timpul anului, apoi te obosește puțin în fiecare lună.'));
  for (const p of ctx.educatie.programe.values()) {
    const d = descrieProgram(state, ctx, p);
    const cost = d.taxaAnuala ? `${lei(d.taxaAnuala)} pe an (${lei(d.costTotal)} în total)` : 'fără taxă';
    const info = [NUME_ANI(d.luni), cost, d.bursaLunara ? `bursă de ${lei(d.bursaLunara)} pe lună` : null].filter(Boolean).join(' · ');
    sectiuni.push(produs(`${d.emoji} ${d.titlu}`, '', d.descriere,
      h('div', { class: 'mic' }, info),
      h('div', { class: 'rand-butoane' },
        h('button', {
          type: 'button', class: 'btn btn-secundar', 'aria-disabled': d.disponibil ? null : 'true',
          onclick: () => (d.disponibil ? executa('inscrieProgram', { program: d.id }) : arataMesaj(d.motiv, false)),
        }, d.taxaAnuala ? 'Mă înscriu și plătesc' : 'Mă înscriu'),
        d.creditStudii ? h('button', {
          type: 'button', class: 'btn btn-secundar', 'aria-disabled': d.disponibil ? null : 'true',
          onclick: () => (d.disponibil ? executa('inscrieProgram', { program: d.id, credit: true }) : arataMesaj(d.motiv, false)),
        }, 'Cu credit de studii') : null),
      d.disponibil ? null : h('div', { class: 'mic motiv-indisponibil' }, d.motiv)));
  }

  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Cursuri și certificate'),
    h('p', { class: 'mic' }, 'Merg în paralel cu jobul sau cu facultatea. Unele certificate țin loc de diplomă la angajare.'));
  for (const c of ctx.educatie.cursuri.values()) {
    const d = descrieCurs(state, ctx, c);
    const info = [NUME_LUNI(d.luni), d.pret ? lei(d.pret) : 'gratuit', d.timp === 1 ? '1 acțiune' : `${d.timp} acțiuni`].join(' · ');
    const stare = d.terminat ? h('div', { class: 'mic marcaj-crestere' }, '✓ Ai certificatul')
      : d.luniRamase != null ? h('div', { class: 'mic' }, `În curs: mai ai ${NUME_LUNI(d.luniRamase)}.`)
        : h('div', { class: 'rand-butoane' }, h('button', {
          type: 'button', class: 'btn btn-secundar', 'aria-disabled': d.disponibil ? null : 'true',
          onclick: () => (d.disponibil ? executa('inscrieCurs', { curs: d.id }) : arataMesaj(d.motiv, false)),
        }, 'Mă înscriu'));
    sectiuni.push(produs(`${d.emoji} ${d.titlu}`, '', d.descriere, h('div', { class: 'mic' }, info), stare,
      !d.terminat && d.luniRamase == null && !d.disponibil ? h('div', { class: 'mic motiv-indisponibil' }, d.motiv) : null));
  }
  return sectiuni;
}

// ---------- Activități ----------

const CATEGORII = { sanatate: 'Sănătate și energie', social: 'Prieteni, familie, oameni', timpLiber: 'Timp liber', dezvoltare: 'Te dezvolți' };

function panouActivitati(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const lista = descrieActivitati(state, ctx);
  const sectiuni = [
    h('p', { class: 'mesaj-actiune', role: 'status' }),
    randTimp(state, ctx),
    h('p', { class: 'mic' }, 'Jobul și studiile îți iau din timp. Operațiunile din Bancă nu consumă timp.'),
  ];
  for (const [cat, titlu] of Object.entries(CATEGORII)) {
    const dinCat = lista.filter((a) => a.categorie === cat);
    if (!dinCat.length) continue;
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, titlu));
    for (const a of dinCat) {
      const info = [a.timp === 1 ? '1 acțiune' : `${a.timp} acțiuni`, a.efecte].filter(Boolean).join(' · ');
      sectiuni.push(produs(`${a.emoji} ${a.titlu}`, '', a.descriere,
        h('div', { class: 'mic' }, info),
        h('div', { class: 'rand-butoane' },
          h('button', {
            type: 'button', class: 'btn btn-secundar', 'aria-disabled': a.disponibil ? null : 'true',
            onclick: () => (a.disponibil ? executa('activitate', { activitate: a.id }) : arataMesaj(a.motiv, false)),
          }, 'Fă asta')),
        a.disponibil ? null : h('div', { class: 'mic motiv-indisponibil' }, a.motiv)));
    }
  }
  return sectiuni;
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

  // Datorii: lista completă e în panoul „Datoriile mele”.
  const datorii = listaDatorii(state, ctx);
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Datoriile mele'));
  sectiuni.push(datorii.length
    ? produs(`${datorii.length} ${datorii.length === 1 ? 'datorie' : 'datorii'}`, lei(datoriiTotal(state)),
      datorii.some((d) => d.restanta > 0 || d.luniRestante > 0) ? 'Ai restanțe: fiecare lună de întârziere adaugă penalități.' : 'Totul e plătit la zi.',
      h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-principal', onclick: () => deschidePanou('datorii', o) }, 'Vezi și gestionează')))
    : h('p', { class: 'mic' }, 'N-ai nicio datorie. Bravo.'));

  // Asigurări facultative: prima e o cheltuială lunară; fără asigurare, paguba o plătești tu.
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Asigurări'));
  for (const as of descrieAsigurari(state, ctx)) {
    const buton = as.activa
      ? h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('asigurare', { tip: as.tip, activ: false }) }, 'Renunț')
      : h('button', { type: 'button', class: 'btn btn-secundar', disabled: as.motiv ? true : null, onclick: () => executa('asigurare', { tip: as.tip }) }, 'Mă asigur');
    sectiuni.push(produs(`${as.emoji} ${as.titlu}`, `${lei(as.prima)} / lună`,
      as.activa ? `Activă. ${as.descriere}` : as.motiv ?? as.descriere,
      h('div', { class: 'rand-butoane' }, buton)));
  }

  // Familia: ce pune partenerul la comun, ce costă copiii, ce vine de la stat (doar dacă e cazul).
  const fam = bugetFamilie(state, ctx);
  if (fam.partener || fam.copii.length || fam.copiiLaFost || fam.creditCuFostul) {
    const intra = fam.contributie + fam.alocatie + fam.indemnizatie;
    const ies = fam.costCopii + fam.pensie;
    const randuri = [
      fam.partener ? `${fam.partener.casatorit ? 'Căsătoriți' : 'Locuiți împreună'}; partenerul câștigă ${lei(fam.venitPartener)} pe lună${fam.venitPartener ? '' : ' (acum, nimic)'}.` : null,
      fam.contributie ? `Partea ${fam.partener ? 'partenerului' : 'fostului partener'} la cheltuielile comune${fam.crediteComune ? ' și la creditul comun' : ''}: ${lei(fam.contributie)} pe lună.` : null,
      fam.copii.length ? `${fam.copii.length === 1 ? 'Un copil' : `${fam.copii.length} copii`} (${fam.copii.map((c) => (c.varsta === 0 ? 'sub un an' : c.varsta === 1 ? '1 an' : ani(c.varsta))).join(', ')}): costă ${lei(fam.costCopii)} pe lună; alocația, ${lei(fam.alocatie)}.` : null,
      fam.indemnizatie ? `Indemnizația de creștere a copilului: ${lei(fam.indemnizatie)} pe lună, în locul salariului.` : null,
      fam.pensie ? `Pensia de întreținere: ${lei(fam.pensie)} pe lună.` : null,
      fam.creditCuFostul ? 'După despărțire, ai rămas pe credit împreună cu fostul partener: dacă nu-și plătește partea, banca ți-o cere ție.' : null,
    ].filter(Boolean);
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Familia'));
    sectiuni.push(produs(fam.partener ? '👫 Bugetul familiei' : '👪 Familia', `${intra - ies >= 0 ? '+' : '−'}${lei(Math.abs(intra - ies))} / lună`,
      randuri.join(' ')));
  }
  return sectiuni;
}

// ---------- Datoriile mele ----------

const NUME_LUNI = (n) => (n === 1 ? '1 lună' : `${n} luni`);

function panouDatorii(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const lista = listaDatorii(state, ctx);
  const sectiuni = [h('p', { class: 'mesaj-actiune', role: 'status' }),
    h('button', { type: 'button', class: 'btn-inapoi', onclick: () => deschidePanou('banca', o) }, '‹ Înapoi la Bancă')];
  if (!lista.length) return [...sectiuni, h('p', {}, 'N-ai nicio datorie. Banii tăi lucrează pentru tine, nu pentru bancă.')];

  sectiuni.push(h('p', { class: 'mic' }, `Total: ${lei(datoriiTotal(state))}. Ratele se plătesc singure în fiecare lună, dacă ai bani în cont.`));
  for (const d of lista) sectiuni.push(cardDatorie(d, state, ctx, executa));

  // Ordinea în care merită să dai banii în plus: avalanșă vs. bulgăre de zăpadă.
  const cuDae = lista.filter((d) => d.dae != null);
  if (cuDae.length >= 2) {
    const nume = (xs) => xs.map((d) => d.titlu).join(' → ');
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Pe care o plătești întâi?'),
      h('p', { class: 'mic' }, h('strong', {}, 'Avalanșă'), ` (cea mai mare DAE întâi, economisești cel mai mult): ${nume([...cuDae].sort((a, b) => b.dae - a.dae))}.`),
      h('p', { class: 'mic' }, h('strong', {}, 'Bulgăre de zăpadă'), ` (cea mai mică întâi, te motivează): ${nume([...cuDae].sort((a, b) => a.sold - b.sold))}.`));
  }

  // Refinanțare / consolidare
  const eligibile = lista.filter((d) => d.poateConsolida);
  if (eligibile.length) {
    const luni = bal(ctx, 'datorii.luniRefinantare');
    const bife = eligibile.map((d) => ({ d, input: h('input', { type: 'checkbox', checked: true }) }));
    const durata = h('select', { 'aria-label': 'Durata creditului nou' }, luni.map((n) => h('option', { value: n, selected: n === 36 || null }, `${n} luni`)));
    const previzualizare = h('p', { class: 'mic previzualizare' });
    const alese = () => bife.filter((b) => b.input.checked).map((b) => b.d.id);
    const actualizeaza = () => {
      const s = simuleazaConsolidare(state, ctx, alese(), Number(durata.value));
      previzualizare.textContent = s.suma == null ? s.mesaj
        : `Credit nou: ${lei(s.suma)} la DAE ${procent(s.dae)}. Rata: ${lei(s.rataNoua)} în loc de ${lei(s.rateVechi)}. Cost total: ${lei(s.costNou)} față de ${lei(s.costVechi)} acum.${s.ok ? '' : ` ${s.mesaj}`}`;
    };
    bife.forEach((b) => b.input.addEventListener('change', actualizeaza));
    durata.addEventListener('change', actualizeaza);
    actualizeaza();
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, eligibile.length > 1 ? 'Strânge-le într-un singur credit' : 'Refinanțează la bancă'),
      h('p', { class: 'mic' }, 'Banca îți dă un credit nou cu care închide datoriile alese. Verifică venitul, istoricul și gradul de îndatorare.'),
      bife.map((b) => h('label', { class: 'comutator' }, b.input, `${b.d.titlu} (${lei(b.d.sold)}${b.d.dae != null ? `, DAE ${procent(b.d.dae)}` : ''})`)),
      h('label', { class: 'comutator' }, 'Durata: ', durata),
      previzualizare,
      h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('consolideaza', { ids: alese(), luni: Number(durata.value) }) }, 'Cere creditul')));
  }
  return sectiuni;
}

function cardDatorie(d, state, ctx, executa) {
  const prod = state.produse.find((p) => p.id === d.id);
  const detalii = [];
  if (d.rata != null) detalii.push(`${d.tip === 'cardCredit' ? 'Minim de plată' : 'Rata'} ${lei(d.rata)}`);
  if (d.dae != null) detalii.push(`DAE ${procent(d.dae)}`);
  if (d.luniRamase != null) detalii.push(`mai sunt ${d.luniRamase} rate`);
  const randuri = [h('div', { class: 'mic' }, detalii.join(' · '))];
  if (d.restanta > 0 || d.luniRestante > 0) {
    randuri.push(h('div', { class: 'mic restanta' }, `⚠ Restanță: ${lei(d.restanta || d.sold)}${d.luniRestante ? `, de ${NUME_LUNI(d.luniRestante)}` : ''}${d.penalitati ? ` (penalități ${lei(d.penalitati)})` : ''}`));
  }
  if (d.stadiu === 'cesionat') randuri.push(h('div', { class: 'mic restanta' }, 'Urmează executarea silită dacă nu plătești sau nu negociezi.'));
  if (d.tip === 'poprire') randuri.push(h('div', { class: 'mic' }, `Executorul a reținut până acum ${lei(d.retinut)}.`));
  if (d.tip === 'cardCredit' && d.doarMinim) {
    randuri.push(h('div', { class: 'mic' }, d.doarMinim.neterminat
      ? 'Doar cu plata minimă, datoria nu se mai termină.'
      : `Doar cu plata minimă: ${NUME_LUNI(d.doarMinim.luni)} și ${lei(d.doarMinim.total)} în total.`));
  } else if (d.tip === 'credit' && d.stadiu === 'activ') {
    randuri.push(h('div', { class: 'mic' }, `Cost total rămas, dacă îl duci la capăt: ${lei(d.costRamas)}.`));
  }

  const butoane = [];
  if (d.tip === 'cardCredit' ? prod.soldScadent > 0 : d.restanta > 0 && d.tip !== 'factura' && d.stadiu === 'activ') {
    butoane.push(h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('platesteRestanta', { id: d.id }) }, d.tip === 'cardCredit' ? 'Plătește extrasul' : 'Plătește restanța'));
  }
  butoane.push(h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('ramburseaza', { id: d.id }) }, `Achită tot (${lei(d.sold)})`));
  randuri.push(h('div', { class: 'rand-butoane' }, butoane));

  if (d.poateRambursaPartial) {
    const input = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', 'aria-label': 'Suma de rambursat în plus', placeholder: 'Suma în lei' });
    const prev = h('p', { class: 'mic previzualizare' });
    const val = () => Number(String(input.value).replace(',', '.'));
    input.addEventListener('input', () => {
      const r = simuleazaRambursare(prod, Math.round(val() * 100), 'rata', ctx);
      const t = simuleazaRambursare(prod, Math.round(val() * 100), 'durata', ctx);
      prev.textContent = !r.ok ? '' : r.integral ? `Închizi creditul și economisești ${lei(r.economie)} din dobândă.`
        : `Rată mai mică (${lei(r.rataNoua)}): economisești ${lei(r.economie)}. Termini mai repede (${t.luniNoi} rate): economisești ${lei(t.economie)}.${r.comision ? ` Comision: ${lei(r.comision)}.` : ''}`;
    });
    randuri.push(h('div', { class: 'sub-sectiune' }, h('div', { class: 'mic' }, 'Rambursare anticipată (dai bani în plus):'),
      h('div', { class: 'camp-suma' }, input,
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('ramburseazaPartial', { id: d.id, suma: val(), mod: 'rata' }) }, 'Scade rata'),
        h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('ramburseazaPartial', { id: d.id, suma: val(), mod: 'durata' }) }, 'Termin mai repede')),
      prev));
  }
  if (d.poateEsalona) {
    randuri.push(h('div', { class: 'sub-sectiune' }, h('div', { class: 'mic' }, 'Negociază o eșalonare cu recuperatorul:'),
      h('div', { class: 'rand-butoane' }, bal(ctx, 'datorii.luniEsalonare').map((n) => {
        const s = simuleazaEsalonare(state, ctx, prod, n);
        return h('button', { type: 'button', class: 'btn btn-secundar', onclick: () => executa('esaloneaza', { id: d.id, luni: n }) },
          `${n} rate de ${lei(s.rata)}`, h('span', { class: 'mic' }, ` (acum ${lei(s.avans)})`));
      }))));
  }
  return produs(d.titlu, lei(d.sold), null, ...randuri);
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
  const sectiuni = [mesaj, randTimp(state, ctx)];
  const buton = (text, fn, clasa = 'btn-secundar') => h('button', { type: 'button', class: `btn ${clasa}`, onclick: fn }, text);
  if (c) {
    const f = fluturas(c.brut, c.contract, ctx);
    const ani = Math.floor((c.luniLucrate ?? 0) / 12);
    const luni = (c.luniLucrate ?? 0) % 12;
    const detalii = job.artist
      ? `Pe cont propriu (PFA) · faima ta: ${Math.round(c.faima ?? 0)}/100 · luna asta ${lei(c.brut)} brut${c.istoricVenit?.length > 1 ? ` · ultimele luni între ${lei(Math.min(...c.istoricVenit))} și ${lei(Math.max(...c.istoricVenit))}` : ''}`
      : `${lei(c.brut)} brut · ${NUME_CONTRACT[c.contract]} · ${job.program} · aici de ${ani ? `${ani} ani și ` : ''}${luni} luni`;
    sectiuni.push(produs(job.titlu[0].toUpperCase() + job.titlu.slice(1), `${lei(f.net)} net`, detalii));

    // Ritmul de muncă
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Cât de tare tragi'),
      h('div', { class: 'nivel-stil' }, RITMURI.map((r) => h('button', {
        type: 'button', class: 'btn btn-secundar', 'aria-pressed': String((c.ritm ?? 'normal') === r), onclick: () => executa('seteazaRitm', { ritm: r }),
      }, { relaxat: 'Relaxat', normal: 'Normal', intens: 'Intens' }[r],
      h('span', { class: 'mic' }, { relaxat: 'mai multă energie, avansezi greu', normal: 'echilibrat', intens: 'promovare mai rapidă, obosești' }[r])))));

    // Bani în plus și avansare
    if (!job.artist && c.contract !== 'negru') {
      const sansa = Math.round(sansaMarire(state, ctx) * 100);
      const ore = simuleazaOreSuplimentare(state, ctx);
      const luniProm = luniPanaLaPromovare(state, ctx);
      sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'La job'),
        produs('Cere o mărire', `~${sansa}%`, 'Șansele cresc cu pregătirea, reputația și timpul de la ultima mărire.', h('div', { class: 'rand-butoane' }, buton('Cere o mărire', () => executa('cereMarire')))),
        job.urmator ? produs('Cere o promovare', ctx.joburi.get(job.urmator).titlu,
          luniProm ? `Mai ai cam ${luniProm} luni de muncă până să fii luat în calcul.` : 'Ai vechimea necesară; contează și pregătirea.',
          h('div', { class: 'rand-butoane' }, buton('Cere promovarea', () => executa('cerePromovare')))) : null,
        ore.ok ? produs('Ore suplimentare', `+${lei(ore.net)} net`, 'Cam 80 de ore peste program, cu spor de 75%. O acțiune de timp și multă energie.',
          h('div', { class: 'rand-butoane' }, buton('Fac ore suplimentare', () => executa('oreSuplimentare')))) : null,
        c.contract === 'cim' ? produs('Curs plătit de firmă', '', `Pregătire gratuită, dar cu clauză de fidelitate: dacă pleci în 2 ani, returnezi cam ${lei(pret(state, ctx, 'munca.costCursFirma'))}.`,
          h('div', { class: 'rand-butoane' }, buton('Cer un curs', () => executa('cursFirma')))) : null);
    }
    sectiuni.push(h('div', { class: 'rand-butoane' }, h('button', {
      type: 'button', class: 'btn btn-text', onclick: async () => {
        const da = await confirma('Îți dai demisia? Salariul se oprește de luna viitoare, iar la demisie nu primești ajutor de șomaj.', { da: 'Demisionez' });
        const r = da ? actiune(state, ctx, 'demisie') : null;
        o.laSchimbare();
        deschidePanou('cariera', o);
        if (r) arataMesaj(r.mesaj, r.ok, r.lectie);
      },
    }, 'Îmi dau demisia')));
  } else {
    sectiuni.push(h('p', {}, 'N-ai job acum.'));
  }

  // Afacerea proprie
  const af = afacereActiva(state);
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Afacerea ta'),
    produs(af ? `${ctx.afaceri.domenii.get(af.domeniu)?.emoji ?? ''} ${ctx.afaceri.domenii.get(af.domeniu)?.titlu ?? 'Afacere'}` : '🚀 Pornește o afacere', af ? lei(af.cont) : '',
      af ? `În contul firmei · activă de ${NUME_LUNI(af.luniActiva)}` : 'Cafenea, magazin online, IT, renovări, fermă și altele. Pregătirea face diferența.',
      h('div', { class: 'rand-butoane' }, buton(af ? 'Vezi afacerea' : 'Mă pregătesc', () => deschidePanou('afacere', o), 'btn-principal'))));

  // Venit în plus (side hustle)
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Venit în plus'),
    h('p', { class: 'mic' }, 'O activitate pe lângă job: bani în plus, dar îți ia o acțiune din timpul fiecărui an și energie în fiecare lună.'));
  for (const s of descrieSecundare(state, ctx)) {
    sectiuni.push(produs(`${s.emoji} ${s.titlu}`, `~${lei(s.venitLunar)}/lună`, s.descriere,
      h('div', { class: 'rand-butoane' }, s.activa ? buton('Renunț', () => executa('opresteSecundar'), 'btn-text')
        : h('button', { type: 'button', class: 'btn btn-secundar', 'aria-disabled': s.disponibil ? null : 'true', onclick: () => (s.disponibil ? executa('incepeSecundar', { secundar: s.id }) : arataMesaj(s.motiv, false)) }, 'Încep')),
      s.activa ? h('div', { class: 'mic marcaj-crestere' }, '✓ O faci acum') : !s.disponibil ? h('div', { class: 'mic motiv-indisponibil' }, s.motiv) : null));
  }

  // Meserii de artist
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Fă-ți din hobby o meserie'),
    h('p', { class: 'mic' }, 'Pe cont propriu, cu venit care variază mult de la o lună la alta. Ai nevoie de un hobby (meniul Activități) și de exercițiu.'));
  for (const j of [...ctx.joburi.values()].filter((x) => x.artist)) {
    sectiuni.push(produs(`🎨 ${j.titlu[0].toUpperCase() + j.titlu.slice(1)}`, `~${lei(pret(state, ctx, j.salariu))}/lună la început`, 'Venitul crește cu faima: comenzi, vânzări, concerte.',
      h('div', { class: 'rand-butoane' }, buton('Devin artist', () => executa('devinoArtist', { job: j.id })))));
  }
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Caută alt job'));
  sectiuni.push(h('p', { class: 'mic' }, `Îți faci CV-ul și primești până la 3 oferte. Un CV mai bun aduce oferte mai multe și mai bine plătite. Căutatul ia o acțiune mare din timpul anului (mai ai ${timpRamas(state, ctx)}).`));
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

// ---------- Afacerea proprie ----------

const FORME = { pfa: 'PFA', ii: 'II', srl: 'SRL' };

function textDatoriiFirma(af, ctx) {
  if (af.forma !== 'srl') return ' (sunt ale tale: firma ești tu)';
  return ` (de ${NUME_LUNI(af.luniFaraPlata)}; la ${bal(ctx, 'afaceri.luniInsolventa')} luni, firma intră în insolvență)`;
}

function panouAfacere(o, reranda) {
  const { state, ctx } = o;
  const executa = executor(o, reranda);
  const sectiuni = [h('p', { class: 'mesaj-actiune', role: 'status' }),
    h('button', { type: 'button', class: 'btn-inapoi', onclick: () => deschidePanou('cariera', o) }, '‹ Înapoi la Carieră'), randTimp(state, ctx)];
  const buton = (text, fn, clasa = 'btn-secundar') => h('button', { type: 'button', class: `btn ${clasa}`, onclick: fn }, text);
  const af = afacereActiva(state);

  if (af) {
    const d = ctx.afaceri.domenii.get(af.domeniu);
    const ultima = af.istoric[af.istoric.length - 1];
    sectiuni.push(produs(`${d.emoji} ${d.titlu} (${FORME[af.forma]})`, lei(af.cont),
      `În contul firmei · activă de ${NUME_LUNI(af.luniActiva)} · pregătirea ta la pornire: ${af.pregatire}/100${af.cota < 1 ? ` · deții ${Math.round(af.cota * 100)}%` : ''}`,
      ultima ? h('table', { class: 'tabel' }, h('tbody', {},
        h('tr', {}, h('td', {}, 'Vânzări luna trecută'), h('td', {}, lei(ultima.venit))),
        h('tr', { class: 'minus' }, h('td', {}, 'Costuri (chirie, echipă, marfă)'), h('td', {}, `− ${lei(ultima.costuri)}`)),
        h('tr', { class: 'minus' }, h('td', {}, 'Taxe'), h('td', {}, `− ${lei(ultima.taxe)}`)),
        h('tr', { class: 'total' }, h('td', {}, ultima.profit >= 0 ? 'Profit' : 'Pierdere'), h('td', {}, lei(Math.abs(ultima.profit)))),
        ultima.cash != null && ultima.cash !== ultima.profit ? h('tr', {}, h('td', {}, 'Bani intrați efectiv în cont (net)'), h('td', {}, `${ultima.cash < 0 ? '− ' : ''}${lei(Math.abs(ultima.cash))}`)) : null)) : h('p', { class: 'mic' }, 'Primele rezultate apar după prima lună.'),
      af.clientiPierduti > 0 ? h('div', { class: 'mic restanta' }, `Ai pierdut cam ${lei(af.clientiPierduti)} din vânzări: echipa nu face față. Ia oameni în plus.`) : null,
      af.datorii ? h('div', { class: 'mic restanta' }, `⚠ Datorii neplătite la furnizori: ${lei(af.datorii)}`, textDatoriiFirma(af, ctx)) : null,
      af.credit ? h('div', { class: 'mic' }, `Creditul firmei: mai sunt ${lei(af.credit.rest)}, rata ${lei(af.credit.rata)}${af.garantiePersonala ? ' (garantat de tine)' : ''}.`) : null));
    if (af.istoric.length >= 3) {
      sectiuni.push(graficLinii({
        titlu: 'Profitul pe ultimele luni', x: af.istoric.map((_, i) => i - af.istoric.length + 1), unitateX: ' luni',
        serii: [{ nume: 'Profit', valori: af.istoric.map((x) => x.profit / 100) }],
        format: (v) => `${Math.round(v).toLocaleString('ro-RO')} lei`,
      }));
    }
    // Deciziile
    const pretCurent = af.pret ?? 'mediu';
    const selEchipa = h('select', { 'aria-label': 'Angajați în plus' }, Array.from({ length: bal(ctx, 'afaceri.angajatiMax') + 1 }, (_, i) => h('option', { value: i, selected: (af.angajatiExtra ?? 0) === i || null }, i === 0 ? 'niciunul' : `${i} în plus`)));
    const costAngajat = Math.round(pret(state, ctx, d.salariuAngajat) * (1 + cfg(ctx, 'afaceri.contributieAngajator')));
    const ext = simuleazaExtindere(state, ctx);
    const vz = simuleazaVanzareFirma(state, ctx);
    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Deciziile tale'),
      h('div', { class: 'mic' }, 'Prețurile:'),
      h('div', { class: 'nivel-stil' }, ['mic', 'mediu', 'mare'].map((p) => h('button', {
        type: 'button', class: 'btn btn-secundar', 'aria-pressed': String(pretCurent === p), onclick: () => executa('seteazaAfacere', { pret: p }),
      }, { mic: 'Mici', mediu: 'Ca piața', mare: 'Mari' }[p], h('span', { class: 'mic' }, { mic: 'mai mulți clienți', mediu: 'echilibrat', mare: 'marjă mare' }[p])))),
      produs('📣 Marketing lunar', lei(af.marketing ?? 0), 'Aduce clienți noi, dar fiecare leu în plus aduce tot mai puțin.',
        campSuma('Bugetul de marketing pe lună', [['Setează', (s) => executa('seteazaAfacere', { marketing: s || 0 })]], 'Lei pe lună')),
      produs('👥 Echipa', (n => (n === 1 ? '1 angajat' : `${n} angajați`))(d.angajatiMinim + (af.angajatiExtra ?? 0)), `Fiecare angajat în plus costă cam ${lei(costAngajat)} pe lună (cu contribuția angajatorului) și poate servi mai mulți clienți.`,
        h('div', { class: 'rand-butoane' }, selEchipa, buton('Setează', () => executa('seteazaAfacere', { angajatiExtra: Number(selEchipa.value) })))),
      produs('🏗️ Extinde afacerea', lei(ext.cost ?? 0), ext.ok ? 'Mai mult spațiu, mai multe vânzări posibile, dar și costuri fixe mai mari.' : ext.mesaj,
        h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-secundar', 'aria-disabled': ext.ok ? null : 'true', onclick: () => (ext.ok ? executa('extindeAfacerea') : arataMesaj(ext.mesaj, false)) }, 'Extind'))),
      produs('🏦 Credit pentru firmă', '', af.forma === 'srl' ? 'Banca cere garanția ta personală.' : 'La PFA / II, creditul e pe numele tău.',
        campSuma('Suma creditului', [['Cer creditul', (s) => executa('imprumutFirma', { suma: s })]])),
      produs('🤝 Vinde afacerea', vz.ok ? lei(vz.net) : '', vz.ok ? `Un cumpărător ar da cam ${lei(vz.pretFirma)} (profitul pe un an: ${lei(Math.round(vz.profitAn))}). Tu primești ${lei(vz.net)} după datorii și impozit.` : vz.mesaj,
        h('div', { class: 'rand-butoane' }, h('button', {
          type: 'button', class: 'btn btn-secundar', 'aria-disabled': vz.ok ? null : 'true',
          onclick: async () => {
            if (!vz.ok) return arataMesaj(vz.mesaj, false);
            const da = await confirma(`Vinzi afacerea? Primești ${lei(vz.net)}.`, { da: 'Vând' });
            const r = da ? actiune(state, ctx, 'vindeAfacerea') : null;
            o.laSchimbare();
            deschidePanou('afacere', o);
            if (r) arataMesaj(r.mesaj, r.ok, r.lectie);
            return null;
          },
        }, 'Vând'))));

    sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Banii între tine și firmă'),
      h('p', { class: 'mic' }, af.forma === 'srl'
        ? 'Banii firmei nu sunt ai tăi: îi scoți ca dividende, cu 10% impozit și CASS.'
        : 'La PFA / II, profitul e al tău după taxe; dacă firma pierde, pierderea iese tot din banii tăi.'),
      campSuma('Suma', [['Scot din firmă', (s) => executa('retrageDinFirma', { suma: s })], ['Pun în firmă', (s) => executa('depuneInFirma', { suma: s })]]),
      h('div', { class: 'rand-butoane' }, h('button', {
        type: 'button', class: 'btn btn-text', onclick: async () => {
          const da = await confirma('Închizi afacerea? Echipamentele se vând ieftin, iar din bani se plătesc întâi datoriile firmei.', { da: 'Închid' });
          const r = da ? actiune(state, ctx, 'inchideAfacere') : null;
          o.laSchimbare();
          deschidePanou('afacere', o);
          if (r) arataMesaj(r.mesaj, r.ok, r.lectie);
        },
      }, 'Închid afacerea')));
    return sectiuni;
  }

  // Pregătirea
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Pregătirea'),
    h('p', { class: 'mic' }, 'Cu cât te pregătești mai bine, cu atât afacerea atinge mai mult din potențialul ei. Cu o pregătire slabă, majoritatea afacerilor pierd bani.'),
    produs('📝 Plan de afaceri', areFlag(state, 'plan_afaceri') ? '✓' : '', 'Calculele de dinainte: costuri, prețuri, clienți. Îl cer băncile și granturile. O acțiune de timp.',
      areFlag(state, 'plan_afaceri') ? null : h('div', { class: 'rand-butoane' }, buton('Îmi fac planul', () => executa('faPlanAfaceri')))),
    produs('🎓 Curs de antreprenoriat', areFlag(state, 'curs_antreprenoriat') ? '✓' : '', 'Îl găsești în meniul Educație.'),
    produs('🏆 Grant pentru tineri antreprenori', areFlag(state, 'grant_aprobat') ? 'aprobat' : areFlag(state, 'grant_incercat') ? 'respins' : '',
      `Până la ${lei(pret(state, ctx, 'afaceri.grant'))}, nerambursabil. Șansele cresc cu pregătirea; ai o singură încercare. Cere un plan de afaceri.`,
      areFlag(state, 'grant_incercat') ? null : h('div', { class: 'rand-butoane' }, buton('Aplic', () => executa('aplicaGrant')))));

  // Domeniul, forma, finanțarea și previzualizarea
  const domenii = [...ctx.afaceri.domenii.values()];
  const selDomeniu = h('select', { 'aria-label': 'Domeniul afacerii' }, domenii.map((d) => h('option', { value: d.id }, `${d.emoji} ${d.titlu}`)));
  const selForma = h('select', { 'aria-label': 'Forma juridică' }, [...ctx.afaceri.forme.values()].map((f) => h('option', { value: f.id, selected: f.id === 'srl' || null }, f.titlu)));
  const bifaCredit = h('input', { type: 'checkbox' });
  const bifaInvestitor = h('input', { type: 'checkbox' });
  const previz = h('div', { class: 'previzualizare' });
  const actualizeaza = () => {
    const d = ctx.afaceri.domenii.get(selDomeniu.value);
    const s = simuleazaPornire(state, ctx, selDomeniu.value, selForma.value, { credit: bifaCredit.checked, investitor: bifaInvestitor.checked });
    const p = s.pregatire;
    previz.replaceChildren(
      h('p', { class: 'mic' }, d.descriere),
      h('p', { class: 'mic' }, ctx.afaceri.forme.get(selForma.value).descriere),
      h('table', { class: 'tabel' }, h('tbody', {},
        h('tr', {}, h('td', {}, 'Investiția'), h('td', {}, lei(s.investitie))),
        s.grant ? h('tr', {}, h('td', {}, 'Din grant'), h('td', {}, lei(s.grant))) : null,
        s.investitor ? h('tr', {}, h('td', {}, `De la investitor (ia ${Math.round((1 - s.cota) * 100)}% din firmă)`), h('td', {}, lei(s.investitor))) : null,
        s.credit ? h('tr', {}, h('td', {}, `Credit (rata ${lei(s.rataCredit)})`), h('td', {}, lei(s.credit))) : null,
        h('tr', {}, h('td', {}, `Rezervă: ${s.luniRezerva} luni de costuri fixe${s.luniRezerva > 3 ? ' (clienții plătesc târziu / marfa se cumpără înainte)' : ''}`), h('td', {}, lei(s.capitalLucru))),
        h('tr', { class: 'total' }, h('td', {}, 'Din banii tăi'), h('td', {}, lei(s.dinEconomii))))),
      h('p', { class: 'mic' }, `Pregătirea ta pentru domeniul ăsta: ${p.total}/100 (plan ${p.parti.plan}, studiu de piață ${p.parti.studiuPiata}, curs ${p.parti.curs}, experiență ${p.parti.experienta}, pregătire generală ${p.parti.skill}).`),
      h('p', { class: 'mic' }, `Când clienții te cunosc (după ~${NUME_LUNI(d.luniMaturitate)}), o lună medie ar arăta cam așa: vânzări ${lei(s.estimare.venit)}, costuri ${lei(s.estimare.costuri)}, ${s.estimare.profit >= 0 ? `profit ${lei(s.estimare.profit)}` : `pierdere ${lei(-s.estimare.profit)}`} înainte de taxe.`),
      s.ok ? '' : h('p', { class: 'mic restanta' }, s.mesaj));
  };
  [selDomeniu, selForma, bifaCredit, bifaInvestitor].forEach((x) => x.addEventListener('change', actualizeaza));
  actualizeaza();
  sectiuni.push(h('h3', { class: 'sectiune-titlu' }, 'Pornește'),
    h('label', { class: 'comutator' }, 'Domeniul: ', selDomeniu),
    h('div', { class: 'rand-butoane' }, buton('Fac un studiu de piață', () => executa('faStudiuPiata', { domeniu: selDomeniu.value }))),
    h('label', { class: 'comutator' }, 'Forma juridică: ', selForma),
    h('label', { class: 'comutator' }, bifaCredit, 'Iau un credit pentru firmă'),
    h('label', { class: 'comutator' }, bifaInvestitor, 'Aduc un investitor'),
    previz,
    h('div', { class: 'rand-butoane' }, buton('Pornesc afacerea', () => executa('pornesteAfacere', { domeniu: selDomeniu.value, forma: selForma.value, credit: bifaCredit.checked, investitor: bifaInvestitor.checked }), 'btn-principal')));
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
    ...sectiuniCatalog(o, executa),
  ];
}

const NUME_PLATI = { cash: 'Cash', card: 'Card', rate: 'Rate', bnpl: 'Mai târziu' };

function sectiuniCatalog(o, executa) {
  const { state, ctx, laOprire } = o;
  const s = [];
  // Ce ai deja
  const detinute = bunuriDetinute(state, ctx);
  if (detinute.length) {
    s.push(h('h3', { class: 'sectiune-titlu' }, 'Ce ai'));
    for (const b of detinute) {
      const vandabil = b.info?.vandabil !== false;
      s.push(produs(`${b.info?.emoji ?? ''} ${b.info?.titlu ?? 'Bun'}`, vandabil ? lei(b.valoare) : '',
        vandabil ? `Cumpărat cu ${lei(b.pretCumparare)}; acum valorează ${lei(b.valoare)}.${b.info?.costLunar ? ` Te costă ${lei(pret(state, ctx, b.info.costLunar))} pe lună.` : ''}`
          : `Face parte din familie. Te costă ${lei(pret(state, ctx, b.info.costLunar))} pe lună.`,
        vandabil ? h('div', { class: 'rand-butoane' }, h('button', { type: 'button', class: 'btn btn-text', onclick: () => executa('vindeBun', { id: b.id }) }, `Vinde (${lei(b.valoare)})`)) : null));
    }
  }
  // Locuința și vacanțele: în alte părți ale jocului
  s.push(h('h3', { class: 'sectiune-titlu' }, '🏠 Locuințe'),
    produs('O locuință pentru tine', '', 'Garsonieră sau apartament, cu sau fără credit ipotecar. Ia o acțiune de timp. (Apartamentele de închiriat sunt în Investiții.)',
      h('div', { class: 'rand-butoane' }, h('button', {
        type: 'button', class: 'btn btn-secundar', onclick: () => {
          const r = actiune(state, ctx, 'vreauLocuinta');
          if (!r.ok) return arataMesaj(r.mesaj, false);
          inchideStrat();
          laOprire?.(r.oprire);
          return null;
        },
      }, 'Caut o locuință'))),
    h('p', { class: 'mic' }, 'Vacanțele și ieșirile sunt în meniul 🎯 Activități.'));
  // Catalogul, pe categorii
  const catalog = descrieCatalog(state, ctx);
  for (const cat of ctx.cumparaturi.categorii.values()) {
    const dinCat = catalog.filter((b) => b.categorie === cat.id);
    if (!dinCat.length) continue;
    s.push(h('details', { class: 'detalii-catalog' }, h('summary', { class: 'sectiune-titlu' }, `${cat.emoji} ${cat.titlu}`),
      dinCat.map((b) => {
        const plati = Object.entries(b.plati);
        const info = [`calitate ${b.calitate}`, b.costLunarAzi ? `+${lei(b.costLunarAzi)}/lună` : null, b.vandabil === false || b.consumabil ? null : `pierde ~${Math.round(b.depreciere * 100)}% din valoare pe an`].filter(Boolean).join(' · ');
        const costuri = plati.map(([k, v]) => (k === 'rate' ? `rate: ${v.luni} × ${lei(v.rata)} = ${lei(v.total)}` : k === 'bnpl' ? `mai târziu: ${v.luni} × ${lei(v.rata)}` : null)).filter(Boolean).join(' · ');
        return produs(`${b.emoji} ${b.titlu}`, lei(b.pretAzi), info,
          costuri ? h('div', { class: 'mic' }, costuri) : null,
          h('div', { class: 'rand-butoane' }, plati.map(([k, v]) => h('button', {
            type: 'button', class: 'btn btn-secundar', 'aria-disabled': v.motiv ? 'true' : null,
            onclick: () => (v.motiv ? arataMesaj(v.motiv, false) : executa('cumparaBun', { bun: b.id, plata: k })),
          }, NUME_PLATI[k]))));
      })));
  }
  return s;
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
