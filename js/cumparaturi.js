// Cumpărăturile (catalogul din data/cumparaturi.json): calitate, depreciere, revânzare, costuri lunare
// (mașini, animale) și plata cash, cu cardul, în rate sau „cumpără acum, plătește mai târziu”,
// fiecare cu costul ei afișat înainte. Bunurile cumpărate sunt produse „bun”, care se depreciază lunar.

import { cfg, clamp, formateazaLei, inLei } from './util.js';
import { baniDisponibili, cardDisponibil, creeazaProdus, incaseaza, plataMinimaCard, plateste, pret, rataAnuitate, rataLunara } from './finance.js';
import { gradIndatorare } from './events.js';
import { adaugaJurnal, areFlag, seteazaFlag } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
export const PLATI = ['cash', 'card', 'rate', 'bnpl'];

const luniRate = (ctx, b) => cfg(ctx, b.categorie === 'masini' ? 'cumparaturi.luniRateMasina' : 'cumparaturi.luniRateMici');

// Cât te costă fiecare fel de plată, plus motivul dacă nu se poate. Fără schimbări de stare.
export function optiuniPlata(state, ctx, b) {
  const p = pret(state, ctx, b.pret);
  const card = state.produse.find((x) => x.tip === 'cardCredit');
  const c = state.produse.find((x) => x.tip === 'contractMunca');
  const r = {};
  r.cash = { total: p, motiv: baniDisponibili(state) < p ? `Nu ai ${leiText(p)} disponibili.` : null };
  if (card) {
    // Dacă plătești doar minimul: dobânda cardului pe un an, aproximativ.
    const dobandaAn = Math.round(p * card.dobandaAnuala * 0.6);
    r.card = { total: p, dobandaDacaMinim: dobandaAn, minim: plataMinimaCard(p, ctx), motiv: cardDisponibil(card) < p ? 'Limita cardului nu ajunge.' : null };
  } else r.card = { total: p, motiv: 'Nu ai card de credit.' };
  if (b.rate) {
    const luni = luniRate(ctx, b);
    const dae = cfg(ctx, 'cumparaturi.daeRate');
    const rata = rataAnuitate(p, rataLunara(dae), luni);
    let motiv = null;
    if (!c || c.contract === 'negru') motiv = 'În rate cumperi doar cu un venit din salariu.';
    else if (areFlag(state, 'istoric_restante') || areFlag(state, 'executare_silita')) motiv = 'Ai restanțe la Biroul de Credit: magazinul te refuză.';
    else if (areFlag(state, 'cazier')) motiv = 'Cu cazier, creditul la magazin nu ți se aprobă.';
    else if (gradIndatorare(state, ctx, { suma: p, luni, dae }).grad > cfg(ctx, 'indatorare.gradMaxim')) motiv = 'Ratele ar trece de 40% din venitul tău.';
    r.rate = { total: rata * luni, rata, luni, dae, motiv };
  }
  if (b.bnpl) {
    const luni = cfg(ctx, 'cumparaturi.luniBnpl');
    r.bnpl = { total: p, rata: Math.ceil(p / luni), luni, motiv: areFlag(state, 'executare_silita') ? 'Ai o executare silită: nu ți se aprobă.' : null };
  }
  return r;
}

export function descrieCatalog(state, ctx) {
  return [...(ctx.cumparaturi?.bunuri.values() ?? [])].map((b) => ({
    ...b, pretAzi: pret(state, ctx, b.pret), costLunarAzi: b.costLunar ? pret(state, ctx, b.costLunar) : 0, plati: optiuniPlata(state, ctx, b),
    detinut: state.produse.some((p) => p.tip === 'bun' && p.bunId === b.id),
  }));
}

// Creează bunul (fără plată: plata o face cine cheamă). Folosită și de evenimente („bunNou”).
export function adaugaBun(state, ctx, id) {
  const b = ctx.cumparaturi?.bunuri.get(id);
  if (!b) return null;
  state.stat.fericire = clamp(state.stat.fericire + (b.fericire ?? 0), 0, 100);
  if (b.energie) state.stat.energie = clamp(state.stat.energie + b.energie, 0, 100);
  if (b.retea) state.ascunse.retea = clamp(state.ascunse.retea + b.retea, 0, 100);
  if (b.skill) state.ascunse.skill = clamp(state.ascunse.skill + b.skill, 0, 100);
  if (b.flag) seteazaFlag(state, b.flag);
  if (b.consumabil) return null;
  const pretAzi = pret(state, ctx, b.pret);
  // Ce nu se poate revinde (ex. un animal de companie) nu intră în avere.
  const prod = { ...creeazaProdus({ tip: 'bun' }, state, ctx), bunId: id, categorie: b.categorie, valoare: b.vandabil === false ? 0 : pretAzi, pretCumparare: pretAzi };
  state.produse.push(prod);
  return prod;
}

export function cumparaBun(state, ctx, id, plata) {
  const b = ctx.cumparaturi?.bunuri.get(id);
  if (!b) return { ok: false, mesaj: 'Produsul ăsta nu există.' };
  if (!PLATI.includes(plata)) return { ok: false, mesaj: 'Alege cum plătești.' };
  if (b.categorie === 'masini' && state.produse.some((p) => p.tip === 'bun' && p.categorie === 'masini')) return { ok: false, mesaj: 'Ai deja o mașină. Vinde-o întâi.' };
  const o = optiuniPlata(state, ctx, b)[plata];
  if (!o) return { ok: false, mesaj: 'Produsul ăsta nu se poate plăti așa.' };
  if (o.motiv) return { ok: false, mesaj: o.motiv };
  const p = pret(state, ctx, b.pret);
  let detaliu;
  if (plata === 'cash') {
    plateste(state, p);
    detaliu = `cash, ${leiText(p)}`;
  } else if (plata === 'card') {
    plateste(state, p, 'cardCredit');
    detaliu = `cu cardul de credit (${leiText(p)}; dacă plătești doar minimul, te costă cam ${leiText(o.dobandaDacaMinim)} dobândă pe an)`;
  } else {
    // Rate / BNPL: un credit care îți dă banii direct magazinului.
    const furnizor = plata === 'rate' ? 'magazin' : 'bnpl';
    const c = creeazaProdus({ tip: 'credit', furnizor, suma: p, dae: plata === 'rate' ? o.dae : 0, luni: o.luni }, state, ctx);
    state.produse.push(c);
    if (state.bilant) state.bilant.rateCumparaturi = (state.bilant.rateCumparaturi ?? 0) + 1;
    detaliu = plata === 'rate'
      ? `în ${o.luni} rate de ${leiText(o.rata)} (în total ${leiText(o.total)}, cu ${leiText(o.total - p)} dobândă)`
      : `cu „plătește mai târziu”: ${o.luni} rate de ${leiText(o.rata)}; o rată întârziată vine cu penalități`;
  }
  adaugaBun(state, ctx, id);
  adaugaJurnal(state, `Ai cumpărat: ${b.titlu.toLowerCase()}, ${detaliu.split(' (')[0]}.`);
  const lectii = {
    rate: 'Rata pare mică, dar adunată pe toți anii costă mai mult decât prețul. Și bunul pierde din valoare între timp.',
    bnpl: '„Plătește mai târziu” e gratuit doar dacă plătești la timp. E ușor să ai trei-patru deodată fără să-ți dai seama.',
    card: 'Cardul e gratuit dacă achiți tot extrasul. Plata minimă transformă o cumpărătură într-o datorie scumpă.',
  };
  const concepte = { rate: ['cost-total-credit', 'depreciere'], bnpl: ['bnpl'], card: ['perioada-gratie', 'plata-minima'], cash: ['depreciere'] }[plata];
  if (b.costLunar) concepte.push('cost-total-detinere');
  return {
    ok: true,
    mesaj: `Ai cumpărat ${b.titlu.toLowerCase()}, ${detaliu}.${b.costLunar ? ` Te mai costă și ${leiText(pret(state, ctx, b.costLunar))} pe lună.` : ''}`,
    lectie: lectii[plata] ?? (b.costLunar ? 'Prețul e doar începutul: costurile lunare se adună ani la rând.' : null),
    concepte,
  };
}

export function vindeBun(state, ctx, prod) {
  if (prod?.tip !== 'bun') return { ok: false, mesaj: 'Nu ai așa ceva de vândut.' };
  const b = ctx.cumparaturi?.bunuri.get(prod.bunId);
  if (b?.vandabil === false) return { ok: false, mesaj: b.categorie === 'animale' ? 'Un animal de companie nu se vinde. E al tău pe viață.' : 'Pe ăsta nu-l mai cumpără nimeni.' };
  incaseaza(state, prod.valoare);
  state.produse = state.produse.filter((p) => p !== prod);
  if (b?.flag && !state.produse.some((p) => p.tip === 'bun' && ctx.cumparaturi.bunuri.get(p.bunId)?.flag === b.flag)) delete state.flaguri[b.flag];
  const pierdere = prod.pretCumparare - prod.valoare;
  adaugaJurnal(state, `Ai vândut: ${b?.titlu.toLowerCase() ?? 'un bun'}, cu ${leiText(prod.valoare)}.`);
  return {
    ok: true, mesaj: `Ai primit ${leiText(prod.valoare)}. L-ai cumpărat cu ${leiText(prod.pretCumparare)}: ${pierdere > 0 ? `a pierdut ${leiText(pierdere)} din valoare` : 'și-a păstrat valoarea'}.`,
    concepte: ['depreciere'],
  };
}

// Lunar: bunurile pierd din valoare; mașinile și animalele costă; animalele aduc bucurie.
export function proceseazaBunuri(state, ctx) {
  let cheltuieli = 0;
  for (const p of state.produse.filter((x) => x.tip === 'bun')) {
    const b = ctx.cumparaturi?.bunuri.get(p.bunId);
    if (!b) continue;
    p.valoare = Math.round(p.valoare * (1 - b.depreciere / 12));
    if (b.costLunar) cheltuieli += plateste(state, pret(state, ctx, b.costLunar));
    if (b.fericireLunara) state.stat.fericire += b.fericireLunara;
  }
  return cheltuieli;
}

export const bunuriDetinute = (state, ctx) => state.produse.filter((p) => p.tip === 'bun').map((p) => ({ ...p, info: ctx.cumparaturi?.bunuri.get(p.bunId) }));
