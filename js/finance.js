// Calcule financiare și produse. Toate sumele sunt în bani (întregi).
// Funcțiile de aici nu știu nimic de evenimente; engine.js le apelează în ordinea lunii.

import { cfg, inBani } from './util.js';

// ---------- Prețuri și inflație ----------

// O sumă din config (lei, prețuri de la start), ajustată cu inflația cumulată.
export function pret(state, ctx, cale) {
  return Math.round(cfg(ctx, cale) * state.indicePreturi * 100);
}

export const rataLunara = (anuala) => Math.pow(1 + anuala, 1 / 12) - 1;

// ---------- Salariu ----------

export function fluturas(brut, contract, ctx) {
  if (contract === 'cim') {
    const cas = Math.round(brut * cfg(ctx, 'taxe.cas'));
    const cass = Math.round(brut * cfg(ctx, 'taxe.cass'));
    const deducere = inBani(cfg(ctx, 'taxe.deducerePersonala'));
    const impozit = Math.round(Math.max(0, brut - cas - cass - deducere) * cfg(ctx, 'taxe.impozitVenit'));
    const pilon2 = Math.round(brut * cfg(ctx, 'pilon2.procentDinBrut'));
    return { contract, brut, cas, cass, impozit, deducere, net: brut - cas - cass - impozit, pilon2 };
  }
  if (contract === 'pfa') {
    const retineri = Math.round(brut * cfg(ctx, 'pfa.procentRetineri'));
    return { contract, brut, cas: 0, cass: 0, impozit: 0, retineri, net: brut - retineri, pilon2: 0 };
  }
  // la negru: fără taxe, fără vechime, fără pensie
  const net = Math.round(brut * cfg(ctx, 'muncaLaNegru.procentNetDinBrut'));
  return { contract, brut, cas: 0, cass: 0, impozit: 0, net, pilon2: 0 };
}

// ---------- Portofel: cont curent + numerar ----------

export const contCurent = (state) => state.produse.find((p) => p.tip === 'contCurent');
export const baniDisponibili = (state) => state.numerar + Math.max(0, contCurent(state)?.sold ?? 0);

export function fondUrgenta(state) {
  return state.produse
    .filter((p) => p.tip === 'contEconomii' && p.fondUrgenta)
    .reduce((s, p) => s + p.sold, 0);
}

export function cardDisponibil(card) {
  return Math.max(0, card.limita - card.soldNou - card.soldScadent);
}

export function incaseaza(state, suma, { cash = false } = {}) {
  const cont = contCurent(state);
  if (!cash && cont) cont.sold += suma;
  else state.numerar += suma;
}

// Plătește cât poate din sursa cerută. Întoarce suma plătită efectiv.
export function plateste(state, suma, sursa = 'portofel') {
  if (suma <= 0) return 0;
  let rest = suma;
  const ia = (disponibil) => {
    const luat = Math.min(rest, Math.max(0, disponibil));
    rest -= luat;
    return luat;
  };
  if (sursa === 'portofel' || sursa === 'cont') {
    const cont = contCurent(state);
    if (cont) cont.sold -= ia(cont.sold);
  }
  if (sursa === 'portofel' || sursa === 'cash') {
    state.numerar -= ia(state.numerar);
  }
  if (sursa === 'fondUrgenta') {
    for (const p of state.produse) {
      if (p.tip === 'contEconomii' && p.fondUrgenta) p.sold -= ia(p.sold);
    }
  }
  if (sursa === 'cardCredit') {
    const card = state.produse.find((p) => p.tip === 'cardCredit');
    if (card) card.soldNou += ia(cardDisponibil(card));
  }
  return suma - rest;
}

// ---------- Produse ----------

export const TIPURI_PRODUSE = ['contCurent', 'contEconomii', 'depozit', 'cardCredit', 'credit', 'investitie', 'poprire', 'contractMunca', 'factura', 'proprietate'];
export const CATEGORII_FACTURI = ['chirie', 'utilitati', 'telefon'];

// Facturile lunii, în ordinea în care se plătesc când banii nu ajung.
export function facturiLunare(state, ctx) {
  const loc = `locuinte.${state.situatie.locuinta}`;
  return {
    chirie: pret(state, ctx, `${loc}.chirie`),
    utilitati: pret(state, ctx, `${loc}.utilitati`),
    telefon: pret(state, ctx, 'costTrai.telefon'),
  };
}
export const CLASE_INVESTITII = ['etf', 'actiuni', 'crypto', 'aur', 'titluriStat'];
export const CLASE_PIATA = ['etf', 'actiuni', 'crypto', 'aur'];

// Sumele din spec sunt deja în bani. Cine creează produsul plătește/încasează separat.
export function creeazaProdus(spec, state, ctx) {
  const baza = { id: `p${++state.contoare.id}`, tip: spec.tip, deschisLa: state.luna, cauza: spec.cauza ?? null };
  switch (spec.tip) {
    case 'contCurent':
      return { ...baza, pachet: spec.pachet ?? 'standard', sold: 0 };
    case 'contEconomii':
      return {
        ...baza, sold: spec.suma ?? 0, fondUrgenta: !!spec.fondUrgenta,
        dobandaAnuala: spec.dobandaAnuala ?? cfg(ctx, 'conturi.contEconomii.dobandaAnuala'),
      };
    case 'depozit': {
      const luni = spec.luni ?? cfg(ctx, 'conturi.depozit.luniStandard');
      return {
        ...baza, sold: spec.suma, luni, luniRamase: luni, dobandaAcumulata: 0, reinnoire: spec.reinnoire ?? true,
        dobandaAnuala: spec.dobandaAnuala ?? cfg(ctx, 'conturi.depozit.dobandaAnuala'),
      };
    }
    case 'cardCredit':
      return {
        ...baza, limita: spec.limita ?? inBani(cfg(ctx, 'cardCredit.limitaStandard')),
        dobandaAnuala: spec.dobandaAnuala ?? cfg(ctx, 'cardCredit.dobandaAnuala'),
        soldNou: 0, soldScadent: 0, plata: spec.plata ?? 'integral', cumparaturiPeCard: !!spec.cumparaturiPeCard,
        luniRestanta: 0, dobandaTotala: 0,
      };
    case 'credit': {
      spec = { ...spec, luni: luniCreditDupaVarsta(state, ctx, spec.luni) };
      // Dobânda variabilă = marja băncii + indicele de referință din anul curent (state.piete.ircc).
      if (spec.variabila) spec = { ...spec, dae: cfg(ctx, 'ipotecar.marjaVariabila') + ircc(state, ctx) };
      const rLunar = rataLunara(spec.dae);
      return {
        ...baza, furnizor: spec.furnizor ?? 'banca', stadiu: 'activ',
        sumaInitiala: spec.suma, rest: spec.suma, dae: spec.dae, rLunar,
        luni: spec.luni, luniRamase: spec.luni, luniFaraDobanda: spec.luniFaraDobanda ?? 0,
        rata: rataAnuitate(spec.suma, rLunar, spec.luni),
        restanta: 0, luniRestanta: 0, totalPlatit: 0, dobandaTotala: 0, penalitati: 0,
        laRestanta: spec.laRestanta ?? null, flag: spec.flag ?? null, variabila: !!spec.variabila,
      };
    }
    case 'investitie': {
      const clasa = spec.clasa;
      const comision = Math.round(spec.suma * cfg(ctx, `investitii.${clasa}.comision`));
      const investit = spec.suma - comision;
      if (clasa === 'titluriStat') {
        const luni = spec.luni ?? cfg(ctx, 'investitii.titluriStat.luniMaturitate');
        return {
          ...baza, clasa, principal: investit, cost: spec.suma, luniRamase: luni, luniPanaLaCupon: 12,
          dobandaAnuala: spec.dobandaAnuala ?? cfg(ctx, 'investitii.titluriStat.dobandaAnuala'),
        };
      }
      return { ...baza, clasa, unitati: investit / state.piete[clasa], cost: spec.suma };
    }
    case 'poprire':
      return { ...baza, creditor: spec.creditor ?? 'recuperator', datorie: spec.suma, retinutTotal: 0 };
    case 'contractMunca':
      return { ...baza, jobId: spec.jobId, contract: spec.contract, brut: spec.brut, luniVechime: 0 };
    case 'proprietate':
      return { ...baza, valoare: spec.valoare, pretCumparare: spec.valoare };
    case 'factura':
      // „furnizor” = categoria, ca selectorul „factura:chirie” să funcționeze ca la credite
      return { ...baza, furnizor: spec.categorie, restanta: 0, luniRestanta: 0, penalitati: 0 };
    default:
      throw new Error(`Tip de produs necunoscut: ${spec.tip}`);
  }
}

// Indicele de referință pentru creditele cu dobândă variabilă (simplificare: urmează inflația).
export function ircc(state, ctx) {
  return state.piete.ircc ?? cfg(ctx, 'inflatie.medieAnuala') + cfg(ctx, 'ipotecar.irccPesteInflatie');
}

// Creditele lungi (ipoteca, 20+ ani) trebuie să se termine până la vârsta maximă din config.
export function luniCreditDupaVarsta(state, ctx, luni) {
  if (luni < 240) return luni;
  const varsta = 18 + Math.max(0, Math.floor(state.luna / 12));
  return Math.max(60, Math.min(luni, (cfg(ctx, 'ipotecar.varstaMaximaLaScadenta') - varsta) * 12));
}

export function rataAnuitate(principal, r, n) {
  if (n <= 0) return principal;
  if (r === 0) return Math.ceil(principal / n);
  return Math.ceil((principal * r) / (1 - Math.pow(1 + r, -n)));
}

export function valoareProdus(p, state) {
  switch (p.tip) {
    case 'contCurent':
    case 'contEconomii':
      return Math.max(0, p.sold);
    case 'depozit':
      return p.sold;
    case 'proprietate':
      return p.valoare;
    case 'investitie':
      return p.clasa === 'titluriStat' ? p.principal : Math.round(p.unitati * state.piete[p.clasa]);
    default:
      return 0;
  }
}

export function datorieProdus(p) {
  switch (p.tip) {
    case 'credit':
      return p.rest + p.restanta;
    case 'cardCredit':
      return p.soldNou + p.soldScadent;
    case 'poprire':
      return p.datorie;
    case 'factura':
      return p.restanta;
    case 'contCurent':
      return Math.max(0, -p.sold);
    default:
      return 0;
  }
}

export function plataMinimaCard(sold, ctx) {
  if (sold <= 0) return 0;
  const minim = Math.max(Math.round(sold * cfg(ctx, 'cardCredit.plataMinimaProcent')), inBani(cfg(ctx, 'cardCredit.plataMinimaFixa')));
  return Math.min(sold, minim);
}

// ---------- Procesare lunară ----------
// Fiecare funcție modifică produsul și întoarce ce s-a întâmplat, pentru rezumat.

export function proceseazaCredit(credit, state, ctx) {
  const lunaCredit = credit.luni - credit.luniRamase;
  if (credit.stadiu === 'activ') {
    const dobanda = lunaCredit < credit.luniFaraDobanda ? 0 : Math.round(credit.rest * credit.rLunar);
    credit.rest += dobanda;
    credit.dobandaTotala += dobanda;
  }
  if (credit.restanta > 0) {
    const pen = Math.round(credit.restanta * cfg(ctx, 'restante.penalitateLunara'));
    credit.restanta += pen;
    credit.penalitati += pen;
  }
  const scadent = credit.stadiu !== 'activ' ? 0 : credit.luniRamase <= 1 ? credit.rest : Math.min(credit.rata, credit.rest);
  credit.rest -= scadent;
  const datorat = credit.restanta + scadent;
  const platit = plateste(state, datorat);
  credit.restanta = datorat - platit;
  credit.totalPlatit += platit;
  credit.luniRamase = Math.max(0, credit.luniRamase - 1);
  credit.luniRestanta = credit.restanta > 0 ? credit.luniRestanta + 1 : 0;
  return { platit, inchis: credit.rest === 0 && credit.restanta === 0 };
}

export function proceseazaCard(card, state, ctx) {
  const datorat = card.soldScadent;
  const minim = plataMinimaCard(datorat, ctx);
  const deplatit = card.plata === 'integral' ? datorat : minim;
  const platit = plateste(state, deplatit);
  let ramas = datorat - platit;
  if (platit < minim) {
    ramas += Math.round((minim - platit) * cfg(ctx, 'restante.penalitateLunara'));
    card.luniRestanta += 1;
  } else {
    card.luniRestanta = 0;
  }
  // Dobânda se aplică doar pe ce n-ai achitat: plata integrală = perioadă de grație = 0 dobândă.
  const dobanda = Math.round(ramas * rataLunara(card.dobandaAnuala));
  card.dobandaTotala += dobanda;
  card.soldScadent = ramas + dobanda + card.soldNou;
  card.soldNou = 0;
  return { platit, dobanda };
}

export function proceseazaDepozit(dep, ctx) {
  dep.dobandaAcumulata += Math.round(dep.sold * (dep.dobandaAnuala / 12));
  dep.luniRamase -= 1;
  if (dep.luniRamase > 0) return { dobandaNeta: 0 };
  const dobandaNeta = Math.round(dep.dobandaAcumulata * (1 - cfg(ctx, 'taxe.impozitDobanzi')));
  dep.sold += dobandaNeta;
  dep.dobandaAcumulata = 0;
  dep.luniRamase = dep.luni;
  return { dobandaNeta, scadent: true };
}

export function proceseazaContEconomii(cont, ctx) {
  if (cont.sold <= 0) return { dobandaNeta: 0 };
  const dobandaNeta = Math.round(cont.sold * (cont.dobandaAnuala / 12) * (1 - cfg(ctx, 'taxe.impozitDobanzi')));
  cont.sold += dobandaNeta;
  return { dobandaNeta };
}

// Titluri de stat: cupon anual fix, principalul revine la maturitate.
export function proceseazaTitluri(t) {
  t.luniRamase -= 1;
  t.luniPanaLaCupon -= 1;
  let cupon = 0;
  if (t.luniPanaLaCupon <= 0) {
    cupon = Math.round(t.principal * t.dobandaAnuala);
    t.luniPanaLaCupon = 12;
  }
  return { cupon, maturitate: t.luniRamase <= 0 };
}

// Randament lunar pentru o clasă de piață, dintr-o normală standard z.
// randamentAnual = creșterea medie pe termen lung (anualizată), INCLUSIV anii cu crash:
// tendința lunară scade cât „costă” în medie crash-urile, ca să nu fie numărate de două ori.
export function randamentLunar(clasa, z, ctx, crash) {
  const mu = cfg(ctx, `investitii.${clasa}.randamentAnual`);
  const sigma = cfg(ctx, `investitii.${clasa}.volatilitateAnuala`);
  const soc = cfg(ctx, `investitii.${clasa}.socCrash`);
  const pCrash = cfg(ctx, 'investitii.probabilitateCrashAnual');
  const tendinta = (Math.log(1 + mu) - pCrash * Math.log(1 + soc)) / 12;
  let factor = Math.exp(tendinta + (sigma / Math.sqrt(12)) * z);
  if (crash) factor *= 1 + soc;
  return factor;
}

// Vânzarea unei investiții de piață: comision + impozit pe câștig.
export function valoareVanzare(inv, state, ctx) {
  const brut = valoareProdus(inv, state);
  const comision = Math.round(brut * cfg(ctx, `investitii.${inv.clasa}.comision`));
  const castig = Math.max(0, brut - comision - inv.cost);
  const impozit = Math.round(castig * cfg(ctx, 'taxe.impozitCastiguriInvestitii'));
  return { brut, comision, impozit, net: brut - comision - impozit };
}
