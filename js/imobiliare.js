// Imobiliare de închiriat: cumperi o garsonieră sau un apartament (cash sau cu credit), îl dai în chirie,
// plătești impozitul pe chirie și costurile de proprietar; chiriașii pleacă, apar reparații și,
// uneori, un chiriaș care nu plătește (evenimente cu decizie). Riscurile folosesc fluxul RNG „actiuni”.

import { bal, cfg, formateazaLei, inLei, varstaLa } from './util.js';
import { sansa } from './rng.js';
import { baniDisponibili, creeazaProdus, datorieProdus, incaseaza, plateste, pret } from './finance.js';
import { gradIndatorare, inchideCredit, programeazaUrmare } from './events.js';
import { adaugaJurnal, areFlag } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
const NUME = { garsoniera: 'garsoniera', apartament: 'apartamentul cu 2 camere' };
const CHEIE = { garsoniera: 'Garsoniera', apartament: 'Apartament' };

export const imobile = (state) => state.produse.filter((p) => p.tip === 'imobil');

function chiriePiata(state, ctx, marime) {
  return pret(state, ctx, `imobiliare.chirie${CHEIE[marime]}`);
}
function costProprietar(state, ctx, p) {
  return pret(state, ctx, `imobiliare.costLunarProprietar${CHEIE[p.marime]}`) + (p.chirias ? 0 : pret(state, ctx, 'imobiliare.utilitatiCandEGol'));
}

// ---------- Cumpărare ----------

// finantare: „cash” sau „credit” (avans = avansMinim din preț). Fără schimbări de stare.
export function simuleazaCumparare(state, ctx, marime, finantare) {
  if (!CHEIE[marime]) return { ok: false, mesaj: 'Alege garsonieră sau apartament.' };
  const valoare = pret(state, ctx, marime === 'garsoniera' ? 'locuinte.pretGarsoniera' : 'locuinte.pretApartament');
  const costuri = Math.round(valoare * cfg(ctx, 'imobiliare.costuriCumparare'));
  const chirie = chiriePiata(state, ctx, marime);
  const netAnual = 12 * (chirie * (1 - cfg(ctx, 'imobiliare.impozitChirie')) - pret(state, ctx, `imobiliare.costLunarProprietar${CHEIE[marime]}`));
  const rez = { marime, valoare, costuri, chirie, randamentNet: netAnual / (valoare + costuri), finantare };
  if (finantare === 'credit') {
    const avans = Math.round(valoare * cfg(ctx, 'imobiliare.avansMinim'));
    const suma = valoare - avans;
    const dae = cfg(ctx, 'ipotecar.daeFixa') + cfg(ctx, 'imobiliare.daeInPlus');
    const luni = cfg(ctx, 'imobiliare.luniCredit');
    const g = gradIndatorare(state, ctx, { suma, luni, dae });
    Object.assign(rez, { dePlatit: avans + costuri, credit: suma, dae, luni, rata: g.rataNoua, grad: g.grad });
    const c = state.produse.find((p) => p.tip === 'contractMunca');
    if (!c || c.contract === 'negru') return { ok: false, ...rez, mesaj: 'Banca refuză: are nevoie de un venit din salariu pe care să-l poată verifica.' };
    if (areFlag(state, 'executare_silita') || areFlag(state, 'istoric_restante') || areFlag(state, 'datorie_recuperator')) {
      return { ok: false, ...rez, mesaj: 'Banca refuză: istoricul de la Biroul de Credit nu e curat.' };
    }
    if (areFlag(state, 'cazier')) return { ok: false, ...rez, mesaj: 'Banca refuză: ai cazier.' };
    if (g.grad > cfg(ctx, 'indatorare.gradMaxim')) {
      return { ok: false, ...rez, mesaj: `Banca refuză: toate ratele ar lua ${Math.round(g.grad * 100)}% din salariul tău net (maximul e ${Math.round(cfg(ctx, 'indatorare.gradMaxim') * 100)}%). Chiria viitoare nu se pune la socoteală.` };
    }
  } else {
    rez.dePlatit = valoare + costuri;
  }
  if (baniDisponibili(state) < rez.dePlatit) return { ok: false, ...rez, mesaj: `Îți trebuie ${leiText(rez.dePlatit)} disponibili (ai ${leiText(baniDisponibili(state))}).` };
  return { ok: true, ...rez };
}

export function cumparaImobil(state, ctx, marime, finantare) {
  const sim = simuleazaCumparare(state, ctx, marime, finantare);
  if (!sim.ok) return sim;
  let creditId = null;
  if (finantare === 'credit') {
    const c = creeazaProdus({ tip: 'credit', furnizor: 'ipotecaInvestitie', suma: sim.credit, dae: sim.dae, luni: sim.luni }, state, ctx);
    state.produse.push(c);
    creditId = c.id;
  }
  plateste(state, sim.dePlatit);
  const imobil = creeazaProdus({ tip: 'imobil', valoare: sim.valoare, marime, creditId }, state, ctx);
  imobil.cumparatLa = state.luna;
  state.produse.push(imobil);
  adaugaJurnal(state, `Ai cumpărat ${marime === 'garsoniera' ? 'o garsonieră' : 'un apartament'} ca să-l dai în chirie (${leiText(sim.valoare)}${creditId ? ', cu credit' : ', cash'}).`);
  return {
    ok: true,
    mesaj: `Ai cumpărat ${NUME[marime]}. Acum îți cauți chiriaș: chiria de piață e cam ${leiText(sim.chirie)} pe lună.`,
    lectie: creditId
      ? 'Chiria trebuie să acopere rata, impozitul și lunile fără chiriaș. Dacă nu, plătești diferența din salariu.'
      : 'Banii puși într-un apartament nu mai sunt la îndemână: îl vinzi greu și cu costuri.',
    concepte: ['randament-chirie', 'declaratia-unica'],
  };
}

// ---------- Lunar ----------

// Întoarce { venit, cheltuieli, impozit } pentru rezumatul anului.
export function proceseazaImobile(state, ctx) {
  const r = { venit: 0, cheltuieli: 0, impozit: 0 };
  const b = bal(ctx, 'imobiliare');
  for (const p of imobile(state)) {
    if (!p.chirias) {
      p.luniGol += 1;
      if (sansa(state, 'actiuni', b.sansaGasesteChirias)) {
        p.chirias = true;
        p.chirie = chiriePiata(state, ctx, p.marime);
        adaugaJurnal(state, `Ai găsit chiriaș pentru ${NUME[p.marime]}: ${leiText(p.chirie)} pe lună.`);
      }
    } else if (sansa(state, 'actiuni', b.sansaChiriasPleacaAnual / 12)) {
      p.chirias = false;
      adaugaJurnal(state, `Chiriașul din ${NUME[p.marime]} s-a mutat. Locuința stă goală până găsești altul.`);
    } else if (sansa(state, 'actiuni', b.sansaChiriasNuPlatesteAnual / 12) && !state.urmari.some((u) => u.eveniment === 'imobil-chirias-nu-plateste')) {
      programeazaUrmare(state, ctx, { eveniment: 'imobil-chirias-nu-plateste', dupaLuni: 1, variabile: { chirie: Math.round(inLei(p.chirie ?? 0)) } }, null);
    } else {
      const impozit = Math.round(p.chirie * cfg(ctx, 'imobiliare.impozitChirie'));
      incaseaza(state, p.chirie - impozit);
      p.chirieIncasata += p.chirie - impozit;
      r.venit += p.chirie - impozit;
      r.impozit += impozit;
    }
    if (sansa(state, 'actiuni', b.sansaReparatieAnual / 12) && !state.urmari.some((u) => u.eveniment === 'imobil-reparatie')) {
      programeazaUrmare(state, ctx, { eveniment: 'imobil-reparatie', dupaLuni: 1 }, null);
    }
    const cost = costProprietar(state, ctx, p);
    r.cheltuieli += plateste(state, cost);
  }
  return r;
}

// La începutul fiecărui an: valoarea crește ca la locuințe, chiria urmează inflația.
export function actualizeazaImobileAnual(state, ctx, inflatie) {
  for (const p of imobile(state)) {
    p.valoare = Math.round(p.valoare * (1 + inflatie + cfg(ctx, 'locuinte.crestereRealaPretAnuala')));
    if (p.chirie) p.chirie = Math.round(p.chirie * (1 + inflatie));
  }
}

// ---------- Vânzare ----------

export function simuleazaVanzare(state, ctx, p) {
  const comision = Math.round(p.valoare * cfg(ctx, 'imobiliare.costuriVanzare'));
  const aniDetinut = (state.luna - (p.cumparatLa ?? p.deschisLa)) / 12;
  const impozit = Math.round(p.valoare * cfg(ctx, aniDetinut < 3 ? 'imobiliare.impozitVanzareSub3Ani' : 'imobiliare.impozitVanzarePeste3Ani'));
  const credit = p.creditId ? state.produse.find((x) => x.id === p.creditId) : null;
  const datorie = credit ? datorieProdus(credit) : 0;
  return { valoare: p.valoare, comision, impozit, datorie, net: p.valoare - comision - impozit - datorie };
}

export function vindeImobil(state, ctx, p) {
  if (p?.tip !== 'imobil') return { ok: false, mesaj: 'Nu ai o astfel de proprietate.' };
  const v = simuleazaVanzare(state, ctx, p);
  if (v.net < 0 && baniDisponibili(state) < -v.net) return { ok: false, mesaj: `Prețul nu acoperă creditul: îți mai trebuie ${leiText(-v.net)} ca să-l închizi.` };
  incaseaza(state, v.valoare - v.comision - v.impozit);
  const credit = p.creditId ? state.produse.find((x) => x.id === p.creditId) : null;
  if (credit) {
    plateste(state, v.datorie);
    credit.rest = 0;
    credit.restanta = 0;
    inchideCredit(state, credit);
  }
  state.produse = state.produse.filter((x) => x !== p);
  const castig = p.valoare - p.pretCumparare;
  adaugaJurnal(state, `Ai vândut ${NUME[p.marime]} de închiriat cu ${leiText(p.valoare)} (cumpărat cu ${leiText(p.pretCumparare)}).`);
  return {
    ok: true,
    mesaj: `Ai primit ${leiText(v.net)} după comision (${leiText(v.comision)}), impozit (${leiText(v.impozit)})${v.datorie ? ` și închiderea creditului (${leiText(v.datorie)})` : ''}.`,
    lectie: castig > 0 ? 'Câștigul la imobiliare vine din chirii adunate ani la rând și din creșterea prețului; costurile de cumpărare și vânzare mănâncă o parte din el.' : null,
  };
}

export function descrieImobile(state, ctx) {
  return imobile(state).map((p) => {
    const credit = p.creditId ? state.produse.find((x) => x.id === p.creditId) : null;
    return {
      id: p.id, marime: p.marime, titlu: p.marime === 'garsoniera' ? 'Garsonieră de închiriat' : 'Apartament de închiriat',
      valoare: p.valoare, pretCumparare: p.pretCumparare, chirias: p.chirias, chirie: p.chirie ?? chiriePiata(state, ctx, p.marime),
      luniGol: p.luniGol, chirieIncasata: p.chirieIncasata, rata: credit ? Math.min(credit.rata, credit.rest) : 0,
      cost: costProprietar(state, ctx, p), vanzare: simuleazaVanzare(state, ctx, p), varstaCumparare: varstaLa(p.cumparatLa ?? p.deschisLa),
    };
  });
}
