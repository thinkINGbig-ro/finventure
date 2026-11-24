// „Datoriile mele”: lista unificată a datoriilor și ce poți face cu ele (plata restanței,
// rambursare parțială sau integrală, eșalonare la recuperator, refinanțare / consolidare).
// Funcțiile de previzualizare (simuleaza…) nu schimbă starea: UI-ul arată cifrele înainte de decizie.

import { bal, cfg, formateazaLei, inLei } from './util.js';
import {
  baniDisponibili, contCurent, creeazaProdus, datorieProdus, fluturas, plataMinimaCard, plateste, rataAnuitate, rataLunara,
} from './finance.js';
import { NUME_FACTURI, inchideCredit, ramburseaza } from './events.js';
import { adaugaJurnal, areFlag } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;

const NUME_CREDIT = {
  ifn: 'Credit IFN', banca: 'Credit de nevoi personale', magazin: 'Rate la magazin', bnpl: 'Cumpără acum, plătește mai târziu',
  leasing: 'Leasing auto', ipoteca: 'Credit ipotecar', recuperator: 'Datorie la firma de recuperare', refinantare: 'Credit de refinanțare',
};

// ---------- Cât te mai costă ----------

// Cât mai plătești în total pe un credit activ dacă îl duci la capăt cum e acum (rate + restanță).
export function costRamasCredit(c) {
  if (c.stadiu !== 'activ') return c.restanta;
  let rest = c.rest;
  let n = c.luniRamase;
  let total = c.restanta;
  let lunaCredit = c.luni - c.luniRamase;
  while (rest > 0 && n > 0) {
    const dobanda = lunaCredit < c.luniFaraDobanda ? 0 : Math.round(rest * c.rLunar);
    rest += dobanda;
    const plata = n <= 1 ? rest : Math.min(c.rata, rest);
    rest -= plata;
    total += plata;
    n -= 1;
    lunaCredit += 1;
  }
  return total;
}

// Cardul de credit plătit doar cu minimul: în câte luni scapi și cât dai în total (fără cumpărături noi).
export function costCardDoarMinim(card, ctx) {
  let sold = card.soldScadent + card.soldNou;
  const r = rataLunara(card.dobandaAnuala);
  let total = 0;
  let luni = 0;
  while (sold > 0 && luni < 600) {
    const plata = plataMinimaCard(sold, ctx);
    sold -= plata;
    total += plata;
    sold += Math.round(sold * r);
    luni += 1;
  }
  return { luni, total, neterminat: sold > 0 };
}

function luniPentruRata(rest, r, rata) {
  if (rata <= 0) return Infinity;
  if (r === 0) return Math.ceil(rest / rata);
  const x = 1 - (rest * r) / rata;
  return x <= 0 ? Infinity : Math.ceil(-Math.log(x) / Math.log(1 + r));
}

// ---------- Lista ----------

export function esteDatorie(p) {
  return (p.tip === 'credit' || p.tip === 'cardCredit' || p.tip === 'factura' || p.tip === 'poprire') && datorieProdus(p) > 0;
}

// Tot ce afișează lista: sold, rată, DAE, luni restante, costul total rămas și acțiunile posibile.
export function listaDatorii(state, ctx) {
  return state.produse.filter(esteDatorie).map((p) => {
    const d = { id: p.id, tip: p.tip, sold: datorieProdus(p), restanta: 0, rata: null, dae: null, luniRestante: p.luniRestanta ?? 0, luniRamase: null, costRamas: datorieProdus(p) };
    if (p.tip === 'credit') {
      Object.assign(d, {
        titlu: p.esalonat ? 'Datorie la recuperator, eșalonată' : NUME_CREDIT[p.furnizor] ?? 'Credit',
        furnizor: p.furnizor, stadiu: p.stadiu, restanta: p.restanta, esalonat: !!p.esalonat,
        rata: p.stadiu === 'activ' ? Math.min(p.rata, p.rest) : null, dae: p.stadiu === 'activ' ? p.dae : null,
        luniRamase: p.stadiu === 'activ' ? p.luniRamase : null, costRamas: costRamasCredit(p),
      });
    } else if (p.tip === 'cardCredit') {
      const minim = costCardDoarMinim(p, ctx);
      Object.assign(d, { titlu: 'Card de credit', rata: plataMinimaCard(p.soldScadent, ctx), dae: p.dobandaAnuala, costRamas: minim.total, doarMinim: minim, plata: p.plata });
    } else if (p.tip === 'factura') {
      Object.assign(d, { titlu: `Restanță la ${NUME_FACTURI[p.furnizor]}`, restanta: p.restanta, penalitati: p.penalitati });
    } else {
      Object.assign(d, { titlu: 'Poprire (executare silită)', retinut: p.retinutTotal });
    }
    d.poateEsalona = p.tip === 'credit' && p.stadiu === 'cesionat';
    d.poateRambursaPartial = p.tip === 'credit' && p.stadiu === 'activ' && p.rest > 0;
    d.poateConsolida = motivConsolidareProdus(p) == null;
    return d;
  });
}

export const datoriiTotal = (state) => state.produse.filter(esteDatorie).reduce((s, p) => s + datorieProdus(p), 0);

// ---------- Plata restanței ----------

export function platesteRestanta(state, prod) {
  const restanta = prod.tip === 'cardCredit' ? prod.soldScadent : prod.restanta;
  if (!(restanta > 0)) return { ok: false, mesaj: 'Nu ai restanțe aici.' };
  if (prod.tip === 'factura') {
    if (baniDisponibili(state) < restanta) return { ok: false, mesaj: `Nu ai destui bani: îți trebuie ${leiText(restanta)}.` };
    const s = ramburseaza(state, prod);
    return { ok: true, mesaj: `Ai plătit ${leiText(s)} restanță la ${NUME_FACTURI[prod.furnizor]}.` };
  }
  const platit = plateste(state, restanta);
  if (!platit) return { ok: false, mesaj: 'Nu ai bani disponibili.' };
  if (prod.tip === 'cardCredit') {
    prod.soldScadent -= platit;
    if (prod.soldScadent === 0) prod.luniRestanta = 0;
  } else {
    prod.restanta -= platit;
    prod.totalPlatit += platit;
    if (prod.restanta === 0) prod.luniRestanta = 0;
    if (datorieProdus(prod) === 0) inchideCredit(state, prod);
  }
  const tot = platit === restanta;
  return { ok: true, mesaj: tot ? `Ai plătit restanța de ${leiText(platit)}. Penalitățile s-au oprit.` : `Ai plătit ${leiText(platit)} din restanța de ${leiText(restanta)}.` };
}

// ---------- Rambursare anticipată ----------

function comisionRambursare(c, suma, ctx) {
  if (c.furnizor === 'ifn' || c.furnizor === 'recuperator') return 0;
  return Math.round(suma * cfg(ctx, c.variabila ? 'rambursareAnticipata.comisionDobandaVariabila' : 'rambursareAnticipata.comisionDobandaFixa'));
}

// mod: „rata” (aceeași durată, rată mai mică) sau „durata” (aceeași rată, termini mai repede).
export function simuleazaRambursare(c, suma, mod, ctx) {
  if (c.tip !== 'credit' || c.stadiu !== 'activ') return { ok: false, mesaj: 'Se poate rambursa anticipat doar un credit activ.' };
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma pe care vrei s-o dai în plus.' };
  const s = Math.min(suma, c.rest);
  const comision = comisionRambursare(c, s, ctx);
  const inainte = costRamasCredit(c);
  const dupa = { ...c, rest: c.rest - s };
  if (dupa.rest > 0) {
    if (mod === 'durata') dupa.luniRamase = Math.min(c.luniRamase, luniPentruRata(dupa.rest, c.rLunar, c.rata));
    else dupa.rata = rataAnuitate(dupa.rest, c.rLunar, c.luniRamase);
  }
  const costDupa = dupa.rest > 0 ? costRamasCredit(dupa) : c.restanta;
  return {
    ok: true, suma: s, comision, integral: dupa.rest === 0,
    economie: Math.max(0, inainte - (costDupa + s + comision)),
    rataNoua: dupa.rest > 0 ? dupa.rata : 0, luniNoi: dupa.rest > 0 ? dupa.luniRamase : 0, produs: dupa,
  };
}

export function ramburseazaPartial(state, ctx, c, suma, mod) {
  const sim = simuleazaRambursare(c, suma, mod, ctx);
  if (!sim.ok) return sim;
  if (baniDisponibili(state) < sim.suma + sim.comision) return { ok: false, mesaj: `Nu ai ${leiText(sim.suma + sim.comision)} disponibili.` };
  // Metoda folosită, pentru lecție: cea mai mare DAE (avalanșă) sau cel mai mic sold (bulgăre de zăpadă)?
  const active = state.produse.filter((p) => p.tip === 'credit' && p.stadiu === 'activ' && p.rest > 0);
  const metoda = active.length < 2 ? null
    : c.dae >= Math.max(...active.map((p) => p.dae)) ? 'avalansa'
      : c.rest <= Math.min(...active.map((p) => p.rest)) ? 'bulgare' : 'alta';

  plateste(state, sim.suma + sim.comision);
  c.totalPlatit += sim.suma + sim.comision;
  c.rest -= sim.suma;
  if (c.rest === 0 && c.restanta === 0) {
    inchideCredit(state, c);
  } else {
    c.rata = sim.produs.rata;
    c.luniRamase = sim.produs.luniRamase;
  }
  const detalii = sim.integral ? 'Creditul e închis.' : mod === 'durata' ? `Termini cu ${sim.luniNoi} rate rămase.` : `Rata nouă: ${leiText(sim.rataNoua)}.`;
  adaugaJurnal(state, `Ai rambursat anticipat ${leiText(sim.suma)} din ${NUME_CREDIT[c.furnizor]?.toLowerCase() ?? 'credit'} și ai economisit ${leiText(sim.economie)} din dobândă.`);
  const lectii = {
    avalansa: 'Ai ales datoria cu cea mai mare DAE: metoda avalanșă. Economisești cel mai mult din dobânzi.',
    bulgare: 'Ai ales datoria cu soldul cel mai mic: metoda bulgărelui de zăpadă. Închizi repede o datorie, iar asta te motivează.',
    alta: 'Ai mai multe datorii: dă banii în plus întâi pe cea cu DAE mare (avalanșă) sau pe cea mai mică (bulgăre de zăpadă).',
  };
  return {
    ok: true,
    mesaj: `Ai dat ${leiText(sim.suma)} în plus${sim.comision ? ` (plus ${leiText(sim.comision)} comision)` : ''} și economisești ${leiText(sim.economie)} din dobândă. ${detalii}`,
    lectie: metoda ? lectii[metoda] : 'Fiecare leu dat în plus azi nu mai face dobândă de mâine.',
    concepte: metoda ? ['rambursare-anticipata', 'avalansa-bulgare'] : ['rambursare-anticipata'],
  };
}

// Achitare integrală, cu dobânda economisită pentru creditele active.
export function achitaTot(state, ctx, p) {
  const datorie = datorieProdus(p);
  const comision = p.tip === 'credit' && p.stadiu === 'activ' ? comisionRambursare(p, p.rest, ctx) : 0;
  if (baniDisponibili(state) < datorie + comision) return { ok: false, mesaj: `Nu ai destui bani: îți trebuie ${leiText(datorie + comision)}.` };
  const economie = p.tip === 'credit' && p.stadiu === 'activ' ? Math.max(0, costRamasCredit(p) - datorie - comision) : 0;
  if (comision) plateste(state, comision);
  const s = ramburseaza(state, p);
  const mesaj = p.tip === 'factura' ? `Ai plătit ${leiText(s)} restanță la ${NUME_FACTURI[p.furnizor]}.`
    : `Ai plătit ${leiText(s + comision)}. Datoria e închisă${economie ? ` și ai economisit ${leiText(economie)} din dobândă` : ''}.`;
  return { ok: true, suma: s, economie, mesaj, concepte: economie ? ['rambursare-anticipata'] : [] };
}

// ---------- Eșalonare la recuperator ----------

export function simuleazaEsalonare(state, ctx, c, luni) {
  if (c.tip !== 'credit' || c.stadiu !== 'cesionat') return { ok: false, mesaj: 'Se poate eșalona doar o datorie ajunsă la recuperatori.' };
  if (!bal(ctx, 'datorii.luniEsalonare').includes(luni)) return { ok: false, mesaj: 'Durată de eșalonare nepermisă.' };
  const avans = Math.round(c.restanta * cfg(ctx, 'esalonareRecuperator.avansProcent'));
  const rest = c.restanta - avans;
  const rata = rataAnuitate(rest, rataLunara(cfg(ctx, 'esalonareRecuperator.dobanda')), luni);
  return { ok: true, avans, rest, rata, luni };
}

export function esaloneaza(state, ctx, c, luni) {
  const sim = simuleazaEsalonare(state, ctx, c, luni);
  if (!sim.ok) return sim;
  if (baniDisponibili(state) < sim.avans) return { ok: false, mesaj: `Recuperatorul cere ${leiText(sim.avans)} ca primă plată.` };
  plateste(state, sim.avans);
  const dae = cfg(ctx, 'esalonareRecuperator.dobanda');
  Object.assign(c, {
    stadiu: 'activ', esalonat: true, rest: sim.rest, restanta: 0, luniRestanta: 0, dae, rLunar: rataLunara(dae),
    luni, luniRamase: luni, luniFaraDobanda: 0, rata: sim.rata, totalPlatit: (c.totalPlatit ?? 0) + sim.avans,
  });
  adaugaJurnal(state, `Ai negociat cu firma de recuperare: ${luni} rate de ${leiText(sim.rata)}. Executarea silită s-a oprit.`, { tip: 'datorie', cauza: c.cauza });
  return {
    ok: true,
    mesaj: `Ai dat ${leiText(sim.avans)} acum și plătești ${luni} rate de ${leiText(sim.rata)}. Dacă întârzii din nou, eșalonarea se anulează.`,
    lectie: 'Cu recuperatorii se poate negocia. Ce nu se poate: să-i ignori, pentru că urmează executorul.',
    concepte: ['esalonare'],
  };
}

// Apelată lunar de motor: o eșalonare cu întârzieri se anulează și datoria revine la recuperator.
export function verificaEsalonare(state, ctx, c) {
  if (!c.esalonat || c.luniRestanta < bal(ctx, 'datorii.luniRestanteAnuleazaEsalonarea')) return false;
  Object.assign(c, {
    stadiu: 'cesionat', esalonat: false, restanta: c.rest + c.restanta, rest: 0,
    luniRestanta: Math.max(c.luniRestanta, cfg(ctx, 'restante.luniPanaLaExecutare') - 1),
  });
  adaugaJurnal(state, 'Ai întârziat ratele din eșalonare: înțelegerea s-a anulat, iar recuperatorul cere toată datoria.', { tip: 'datorie', cauza: c.cauza });
  return true;
}

// ---------- Refinanțare / consolidare ----------

function motivConsolidareProdus(p) {
  if (p.tip === 'cardCredit') return datorieProdus(p) > 0 ? null : 'Cardul nu are sold.';
  if (p.tip !== 'credit') return 'Se refinanțează doar creditele și cardul.';
  if (p.stadiu !== 'activ' || p.esalonat) return 'Datoriile de la recuperatori nu se refinanțează.';
  if (p.furnizor === 'ipoteca') return 'Ipoteca se refinanțează separat, nu împreună cu creditele de consum.';
  if (p.restanta > 0) return 'Are restanțe: întâi plătește-le.';
  return null;
}

// Banca verifică venitul, istoricul și gradul de îndatorare (ratele înlocuite nu se mai pun la socoteală).
export function simuleazaConsolidare(state, ctx, ids, luni) {
  const produse = ids.map((id) => state.produse.find((p) => p.id === id)).filter(Boolean);
  if (!produse.length) return { ok: false, mesaj: 'Alege cel puțin o datorie.' };
  for (const p of produse) {
    const m = motivConsolidareProdus(p);
    if (m) return { ok: false, mesaj: m };
  }
  if (!bal(ctx, 'datorii.luniRefinantare').includes(luni)) return { ok: false, mesaj: 'Durată nepermisă.' };
  const c = state.produse.find((p) => p.tip === 'contractMunca');
  if (!c || c.contract === 'negru') return { ok: false, mesaj: 'Banca refuză: are nevoie de un venit pe care să-l poată verifica.' };
  if (areFlag(state, 'executare_silita') || areFlag(state, 'datorie_recuperator')) return { ok: false, mesaj: 'Banca refuză: ai o executare sau o datorie la recuperatori în istoric.' };
  if (areFlag(state, 'cazier')) return { ok: false, mesaj: 'Banca refuză: ai cazier.' };
  if (areFlag(state, 'istoric_restante')) return { ok: false, mesaj: 'Banca refuză: ai întârzieri recente la Biroul de Credit. Refinanțarea e pentru cine încă plătește la timp.' };
  if (state.ascunse.scorCredit < bal(ctx, 'datorii.scorCreditRefinantare')) return { ok: false, mesaj: 'Banca refuză: scorul tău de credit e prea mic.' };

  const suma = produse.reduce((s, p) => s + datorieProdus(p), 0);
  const dae = cfg(ctx, 'refinantare.dae');
  const rataNoua = rataAnuitate(suma, rataLunara(dae), luni);
  const rateVechi = produse.reduce((s, p) => s + (p.tip === 'credit' ? Math.min(p.rata, p.rest) : plataMinimaCard(p.soldScadent, ctx)), 0);
  const costVechi = produse.reduce((s, p) => s + (p.tip === 'credit' ? costRamasCredit(p) : costCardDoarMinim(p, ctx).total), 0);
  const costNou = costRamasCredit({ stadiu: 'activ', rest: suma, luniRamase: luni, luni, luniFaraDobanda: 0, rLunar: rataLunara(dae), rata: rataNoua, restanta: 0 });

  // Gradul de îndatorare: toate ratele rămase + rata nouă, raportate la venitul net.
  const net = fluturas(c.brut, c.contract, ctx).net;
  const alteRate = state.produse.reduce((t, p) => t + (produse.includes(p) ? 0
    : (p.tip === 'credit' && p.stadiu === 'activ' ? Math.min(p.rata, p.rest) : 0) + (p.tip === 'cardCredit' ? plataMinimaCard(p.soldScadent, ctx) : 0)), 0);
  const grad = (alteRate + rataNoua) / net;
  const max = cfg(ctx, 'indatorare.gradMaxim');
  const rez = { suma, dae, luni, rataNoua, rateVechi, costVechi, costNou, grad };
  if (grad > max) return { ok: false, ...rez, mesaj: `Banca refuză: toate ratele ar lua ${Math.round(grad * 100)}% din venitul tău net (maximul e ${Math.round(max * 100)}%).` };
  return { ok: true, ...rez };
}

export function consolideaza(state, ctx, ids, luni) {
  const sim = simuleazaConsolidare(state, ctx, ids, luni);
  if (!sim.ok) return sim;
  const produse = ids.map((id) => state.produse.find((p) => p.id === id));
  const nou = creeazaProdus({ tip: 'credit', furnizor: 'refinantare', suma: sim.suma, dae: sim.dae, luni, cauza: produse.find((p) => p.cauza)?.cauza ?? null }, state, ctx);
  state.produse.push(nou);
  // Banca plătește direct datoriile vechi: banii trec prin cont doar ca să le închidă.
  const cont = contCurent(state);
  if (cont) cont.sold += sim.suma;
  else state.numerar += sim.suma;
  for (const p of produse) ramburseaza(state, p);
  const multe = produse.length > 1;
  adaugaJurnal(state, `Ai ${multe ? `strâns ${produse.length} datorii într-un singur credit` : 'refinanțat un credit'}: ${leiText(sim.suma)}, rata ${leiText(sim.rataNoua)} pe ${luni} luni.`);
  const scumpMaiMult = sim.costNou > sim.costVechi;
  const cuCard = produse.some((p) => p.tip === 'cardCredit');
  return {
    ok: true,
    mesaj: `Rata lunară: ${leiText(sim.rataNoua)} în loc de ${leiText(sim.rateVechi)}. Cost total: ${leiText(sim.costNou)} față de ${leiText(sim.costVechi)} înainte.`,
    lectie: cuCard
      ? 'Cardul e acum gol, dar limita e tot acolo. Dacă îl umpli din nou, ai două datorii în loc de una.'
      : scumpMaiMult
        ? 'Rata e mai mică, dar plătești mai mult în total: ai întins datoria pe mai mulți ani. Contează costul total, nu doar rata.'
        : 'Ai înlocuit datorii scumpe cu una mai ieftină: aceeași datorie, mai puțină dobândă.',
    concepte: ['refinantare', 'cost-total-credit'],
  };
}

export const consolidabile = (state) => state.produse.filter((p) => esteDatorie(p) && motivConsolidareProdus(p) == null);
