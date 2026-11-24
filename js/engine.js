// Motorul: bucla anuală („Avansează”), simularea lunară, opririle la evenimente,
// procesarea produselor, momentele-cheie și game over.
//
// Fluxul pentru UI:
//   avanseaza()  -> pornește anul și rulează lunile până la prima oprire
//   alege(id)    -> aplică alegerea din evenimentul curent și continuă
//   continua()   -> confirmă un moment-cheie / rezumatul anului și continuă
// Fiecare întoarce „oprirea” curentă (eveniment, moment, rezumat, final) sau null
// când jocul așteaptă următorul „Avansează”. Starea e salvabilă în orice punct.

import { bal, cfg, cloneaza, inBani, inLei, numeLuna, varstaLa, formateazaLei } from './util.js';
import { intreg, normal, sansa } from './rng.js';
import {
  CLASE_PIATA, baniDisponibili, cardDisponibil, contCurent, creeazaProdus, datorieProdus, facturiLunare, fluturas,
  incaseaza, plateste, pret, proceseazaCard, proceseazaContEconomii, proceseazaCredit, proceseazaDepozit,
  proceseazaTitluri, randamentLunar, rataAnuitate, rataLunara, valoareProdus,
} from './finance.js';
import {
  activeLichidabile, actualizeazaDerivate, adaugaJurnal, areFlag, avereNeta, creeazaStare, datoriiTotale, expiraFlaguri, multiplicatorStil, schimbaStil, seteazaFlag,
} from './state.js';
import {
  FLAG_FACTURA, NUME_FACTURI, alegeEvenimentAleator, aplicaAlegere, creeazaOprireEveniment, deschideProdus, descrieOprire,
  extrageUrmareScadenta, gasesteProduse, inchideCredit, inchideFactura, lichideaza, planificaSloturi, programeazaUrmare, ramburseaza,
} from './events.js';
import { bilantNou, inregistreazaAn, inregistreazaLuna, verificaIndependenta } from './bilant.js';
import { esteAsigurat } from './events.js';
import { areJobFullTime, cereMarire, contractCurent, sansaMarire } from './cariera.js';

export const VARSTA_PENSIE = 65;

// ---------- API ----------

export function jocNou(ctx, optiuni) {
  const state = creeazaStare(ctx, optiuni);
  state.bilant = bilantNou();
  adaugaJurnal(state, 'Ai terminat liceul. Urmează prima decizie mare.');
  persista(state, ctx);
  return state;
}

export function oprireCurenta(state, ctx) {
  return state.pendinte ? descrie(state.pendinte, state, ctx) : null;
}

export function avanseaza(state, ctx) {
  if (state.pendinte || state.final) return oprireCurenta(state, ctx);
  if (!state.an) {
    inceputAn(state, ctx);
    if (state.final) return seteazaPendinte(state, ctx, { tip: 'final', ...state.final });
  }
  return ruleaza(state, ctx);
}

export function alege(state, ctx, idAlegere) {
  const oprire = state.pendinte;
  if (oprire?.tip !== 'eveniment') throw new Error('Nu există un eveniment care așteaptă o decizie.');
  const ev = ctx.evenimente.get(oprire.eveniment);
  // Snapshot ÎNAINTE de decizie: reluarea redeschide exact cardul ăsta. Îl păstrăm dacă evenimentul
  // e marcat „checkpoint” sau dacă decizia a deschis o datorie (credit nou sau datorii mai mari).
  const snapshot = ctx.persistenta?.checkpoint ? cloneaza(state) : null;
  const creditInainte = state.produse.filter((p) => p.tip === 'credit').length;
  const rezultat = aplicaAlegere(state, ctx, oprire, idAlegere);
  if (snapshot) {
    const datorie = state.produse.filter((p) => p.tip === 'credit').length > creditInainte;
    if (ev.checkpoint || datorie) {
      ctx.persistenta.checkpoint(snapshot, `${varstaLa(snapshot.luna)} ani: ${ev.titlu ?? ev.id}`, { decizie: rezultat.decizie.id, datorie });
    }
  }
  ctx.persistenta?.concepte?.(rezultat.concepteNoi);
  state.pendinte = null;
  verificaFinal(state, ctx);
  // Lanț imediat (urmări cu dupaLuni: 0): următorul card apare acum, fără să consume o oprire din an.
  // Plasă de siguranță: un lanț imediat de peste 8 carduri (o greșeală de conținut) continuă luna viitoare.
  const lungimeLant = oprire.inLant ? (oprire.lungimeLant ?? 1) + 1 : 1;
  const imediata = state.final || lungimeLant > 8 ? null : extrageUrmareScadenta(state, ctx, { doarImediate: true });
  if (imediata) return { rezultat, oprire: seteazaPendinte(state, ctx, { ...imediata, inLant: true, lungimeLant }) };
  return { rezultat, oprire: ruleaza(state, ctx) };
}

export function continua(state, ctx) {
  const tip = state.pendinte?.tip;
  if (tip !== 'moment' && tip !== 'rezumat') return oprireCurenta(state, ctx);
  state.pendinte = null;
  return ruleaza(state, ctx);
}

// Debug: forțează un eveniment acum.
export function forteazaEveniment(state, ctx, idEveniment, variabile = {}) {
  const ev = ctx.evenimente.get(idEveniment);
  if (!ev) throw new Error(`Eveniment inexistent: ${idEveniment}`);
  return seteazaPendinte(state, ctx, creeazaOprireEveniment(ev, state, ctx, { variabile }));
}

// ---------- Bucla ----------

function ruleaza(state, ctx) {
  if (state.pendinte) return oprireCurenta(state, ctx);
  if (state.coada.length) return seteazaPendinte(state, ctx, state.coada.shift());
  if (state.final) return seteazaPendinte(state, ctx, { tip: 'final', ...state.final });
  const an = state.an;
  if (!an) {
    persista(state, ctx);
    return null;
  }

  while (state.luna < an.start + 12) {
    if (an.verificatLuna !== state.luna) {
      an.verificatLuna = state.luna;
      const oprire = cautaOprire(state, ctx);
      if (oprire) {
        an.opriri += 1;
        return seteazaPendinte(state, ctx, oprire);
      }
    }
    proceseazaLuna(state, ctx);
    if (state.final) return seteazaPendinte(state, ctx, { tip: 'final', ...state.final });
    if (state.coada.length) return seteazaPendinte(state, ctx, state.coada.shift());
  }

  incheieAn(state, ctx);
  return seteazaPendinte(state, ctx, state.coada.shift());
}

// Max. 1 oprire pe lună. Urmările au prioritate; ce nu încape trece în luna următoare.
function cautaOprire(state, ctx) {
  const an = state.an;
  if (an.opriri >= bal(ctx, 'evenimente.opririMaxPeAn')) return null;
  const urmare = extrageUrmareScadenta(state, ctx);
  if (urmare) return urmare;
  const i = an.sloturi.findIndex((l) => l <= state.luna);
  if (i >= 0) {
    an.sloturi.splice(i, 1);
    const ev = alegeEvenimentAleator(state, ctx);
    if (ev) return creeazaOprireEveniment(ev, state, ctx);
  }
  return null;
}

function seteazaPendinte(state, ctx, oprire) {
  state.pendinte = oprire ?? null;
  persista(state, ctx);
  return oprireCurenta(state, ctx);
}

function descrie(oprire, state, ctx) {
  const baza = oprire.tip === 'eveniment' ? descrieOprire(oprire, state, ctx) : { ...oprire };
  const luna = oprire.luna ?? state.luna;
  return { ...baza, varsta: varstaLa(luna), numeLuna: numeLuna(luna) };
}

function persista(state, ctx) {
  ctx.persistenta?.salveaza?.(state);
}

// ---------- Anul ----------

function inceputAn(state, ctx) {
  const start = state.luna;
  if (varstaLa(start) >= VARSTA_PENSIE) {
    state.final = { tip: 'final', motiv: 'pensie', luna: start };
    return;
  }
  // Fluxul „piete” se consumă la fel în fiecare an, indiferent de alegeri.
  const inflatie = cfg(ctx, 'inflatie.medieAnuala') + cfg(ctx, 'inflatie.deviatieAnuala') * normal(state, 'piete');
  const crash = sansa(state, 'piete', cfg(ctx, 'investitii.probabilitateCrashAnual'));
  const lunaCrash = start + intreg(state, 'piete', 0, 11);

  if (start > 0) {
    const i = cfg(ctx, 'ipotecar');
    state.piete.ircc = Math.min(i.irccMax.valoare, Math.max(i.irccMin.valoare, inflatie + i.irccPesteInflatie.valoare));
    for (const p of gasesteProduse(state, 'proprietate')) p.valoare = Math.round(p.valoare * (1 + inflatie + cfg(ctx, 'locuinte.crestereRealaPretAnuala')));
    for (const c of state.produse.filter((p) => p.tip === 'credit' && p.variabila && p.stadiu === 'activ' && p.luniRamase > 0)) {
      const rataVeche = c.rata;
      c.dae = cfg(ctx, 'ipotecar.marjaVariabila') + state.piete.ircc;
      c.rLunar = rataLunara(c.dae);
      c.rata = rataAnuitate(c.rest, c.rLunar, c.luniRamase);
      if (c.rata - rataVeche > rataVeche * cfg(ctx, 'ipotecar.crestereRataPentruEveniment')) {
        programeazaUrmare(state, ctx, { eveniment: 'rata-variabila-crescuta', dupaLuni: 1, variabile: { crestere: Math.round(inLei(c.rata - rataVeche)), rataNoua: Math.round(inLei(c.rata)) } }, c.cauza);
      }
    }
    state.indicePreturi *= 1 + inflatie;
    const crestere = inflatie * cfg(ctx, 'salarii.cresterePrinInflatie');
    for (const c of gasesteProduse(state, 'contractMunca')) c.brut = Math.round(c.brut * (1 + Math.max(0, crestere)));
  }

  state.an = {
    start,
    sloturi: planificaSloturi(state, ctx, start),
    opriri: 0,
    verificatLuna: null,
    inflatie: start > 0 ? inflatie : 0,
    lunaCrash: crash ? lunaCrash : null,
    avereStart: avereNeta(state),
    ac: {
      venituri: 0, taxe: 0, cheltuieliTrai: 0, rate: 0, dobanziPlatite: 0, dobanziPrimite: 0,
      comisioane: 0, castigInvestitii: 0, retinutPoprire: 0, neplatit: 0, luniCuLipsuri: 0,
      cheltuieliStil: 0, cheltuieliStilAnterior: 0,
    },
  };
}

function incheieAn(state, ctx) {
  const an = state.an;
  inregistreazaAn(state, ctx, an.ac);
  if (an.inflatie > 0 && !state.concepte.includes('puterea-de-cumparare')) state.concepte.push('puterea-de-cumparare');
  const areInvestitii = gasesteProduse(state, 'investitie').length > 0;
  if (areInvestitii && an.ac.castigInvestitii > 0 && !state.momente.primulAnPePlus) {
    adaugaMoment(state, 'primulAnPePlus', { castig: an.ac.castigInvestitii }, ['dobanda-compusa']);
  }
  state.coada.push({
    tip: 'rezumat',
    luna: state.luna - 1,
    varsta: varstaLa(an.start),
    inflatie: an.inflatie,
    crash: an.lunaCrash != null,
    ...an.ac,
    avereStart: an.avereStart,
    avereFinal: avereNeta(state),
    indicePreturi: state.indicePreturi,
    stilViata: state.stilViata,
    stilAnterior: state.stilAnterior,
  });
  state.an = null;
}

function adaugaMoment(state, id, date, concepte = []) {
  state.momente[id] = true;
  for (const c of concepte) if (!state.concepte.includes(c)) state.concepte.push(c);
  state.coada.push({ tip: 'moment', id, luna: state.luna, date, concepte });
}

// ---------- Luna ----------

export function proceseazaLuna(state, ctx) {
  const ac = state.an.ac;
  const lunar = bal(ctx, 'lunar');
  let neplatit = 0;
  expiraFlaguri(state);

  // 1. Piețele se mișcă mereu (și fără investiții), ca RNG-ul să nu depindă de alegeri.
  const crash = state.luna === state.an.lunaCrash;
  let valoareInainte = 0;
  let valoareDupa = 0;
  for (const clasa of CLASE_PIATA) {
    const factor = randamentLunar(clasa, normal(state, 'piete'), ctx, crash);
    const inainte = valoareClasa(state, clasa);
    state.piete[clasa] *= factor;
    const dupa = valoareClasa(state, clasa);
    ac.castigInvestitii += dupa - inainte;
    valoareInainte += inainte;
    valoareDupa += dupa;
  }
  // Prăbușirea bursei: decizia „vinzi sau păstrezi?”, doar pentru cine are investiții de piață.
  if (crash && valoareInainte - valoareDupa > 10000) {
    programeazaUrmare(state, ctx, {
      eveniment: 'prabusire-bursa', dupaLuni: 1,
      variabile: { pierdere: Math.round(inLei(valoareInainte - valoareDupa)), procent: Math.round((1 - valoareDupa / valoareInainte) * 100) },
    }, null);
  }

  // 2. Venituri
  const contract = gasesteProduse(state, 'contractMunca')[0];
  if (contract) proceseazaSalariu(state, ctx, contract);
  for (const r of state.recurente) {
    if (r.tip === 'venit') {
      incaseaza(state, r.suma);
      ac.venituri += r.suma;
    } else {
      const platit = plateste(state, r.suma);
      if (r.destinatie === 'pilon3') state.pensie.pilon3 = (state.pensie.pilon3 ?? 0) + platit; // economie, nu cheltuială
      else ac.cheltuieliTrai += platit;
      neplatit += r.suma - platit;
    }
    if (r.luniRamase != null) r.luniRamase -= 1;
  }
  // Recurențele legate de o locuință (ex. contribuția extra la părinți) se opresc când te muți.
  state.recurente = state.recurente.filter((r) => (r.luniRamase == null || r.luniRamase > 0) && (!r.locuinta || r.locuinta === state.situatie.locuinta));

  // 3. Studii: taxa la începutul fiecărui an de studiu
  const studii = state.situatie.studii;
  if (studii) {
    if ((state.luna - studii.inceputLa) % 12 === 0) {
      const taxa = pret(state, ctx, `studii.${studii.id}.taxaAnuala`);
      const platit = plateste(state, taxa);
      ac.cheltuieliTrai += platit;
      neplatit += taxa - platit;
    }
    state.stat.energie -= lunar.studiiEnergie;
    studii.luniRamase -= 1;
    if (studii.luniRamase <= 0) finalizeazaStudii(state, ctx);
  }

  // 4. Mâncare și transport primele (cumpărăturile pot trece pe cardul de credit).
  // Ce nu se poate plăti aici înseamnă lipsuri, nu datorie.
  const mancareBaza = pret(state, ctx, 'costTrai.mancareTransport');
  const mancare = Math.round(mancareBaza * multiplicatorStil(state, ctx));
  ac.cheltuieliStil += mancare;
  if (state.stilAnterior) ac.cheltuieliStilAnterior += Math.round(mancareBaza * multiplicatorStil(state, ctx, state.stilAnterior));
  let peCard = 0;
  const card = gasesteProduse(state, 'cardCredit')[0];
  if (card?.cumparaturiPeCard) {
    peCard = Math.min(Math.round(mancare * cfg(ctx, 'costTrai.procentCumparaturi')), cardDisponibil(card));
    card.soldNou += peCard;
  }
  const platitMancare = plateste(state, mancare - peCard);
  ac.cheltuieliTrai += platitMancare + peCard;
  neplatit += mancare - peCard - platitMancare;

  // 5. Facturile: ce rămâne neplătit devine restanță, cu penalități (vezi proceseazaRestante).
  ac.cheltuieliTrai += proceseazaFacturi(state, ctx);

  const cont = contCurent(state);
  if (cont) {
    if (cont.pachet === 'tineri' && varstaLa(state.luna) > cfg(ctx, 'conturi.contTineri.varstaMaxima')) {
      cont.pachet = 'standard';
      adaugaJurnal(state, 'Contul pentru tineri a devenit cont standard, cu comision lunar.');
    }
    const comision = inBani(cfg(ctx, cont.pachet === 'tineri' ? 'conturi.contTineri.comisionLunar' : 'conturi.contCurent.comisionLunar'));
    const luat = Math.min(comision, Math.max(0, cont.sold));
    cont.sold -= luat;
    ac.comisioane += luat;
  }

  // 6. Credite și carduri
  for (const p of [...state.produse]) {
    // Prima rată vine luna următoare celei în care ai luat creditul.
    if (p.tip === 'credit' && p.deschisLa === state.luna) continue;
    if (p.tip === 'credit') {
      const dobandaInainte = p.dobandaTotala;
      const { platit, inchis } = proceseazaCredit(p, state, ctx);
      ac.rate += platit;
      ac.dobanziPlatite += p.dobandaTotala - dobandaInainte;
      if (platit > 0 && !state.momente.primaRata) {
        adaugaMoment(state, 'primaRata', { suma: platit, furnizor: p.furnizor, ramase: p.luniRamase }, ['rata']);
      }
      if (inchis) inchideCredit(state, p);
    } else if (p.tip === 'cardCredit') {
      const { platit, dobanda } = proceseazaCard(p, state, ctx);
      ac.rate += platit;
      ac.dobanziPlatite += dobanda;
    }
  }

  // 7. Economii și titluri
  for (const p of [...state.produse]) {
    if (p.tip === 'depozit') ac.dobanziPrimite += proceseazaDepozit(p, ctx).dobandaNeta;
    if (p.tip === 'contEconomii') ac.dobanziPrimite += proceseazaContEconomii(p, ctx).dobandaNeta;
    if (p.tip === 'investitie' && p.clasa === 'titluriStat') {
      const { cupon, maturitate } = proceseazaTitluri(p);
      if (cupon) {
        incaseaza(state, cupon);
        ac.castigInvestitii += cupon;
      }
      if (maturitate) {
        incaseaza(state, p.principal);
        state.produse = state.produse.filter((x) => x !== p);
        adaugaJurnal(state, `Titlurile de stat au ajuns la maturitate: ai primit înapoi ${formateazaLei(inLei(p.principal))} lei.`);
      }
    }
  }
  state.pensie.pilon2 = Math.round(state.pensie.pilon2 * (1 + rataLunara(cfg(ctx, 'pilon2.randamentAnual'))));
  if (state.pensie.pilon3) state.pensie.pilon3 = Math.round(state.pensie.pilon3 * (1 + rataLunara(cfg(ctx, 'pilon2.randamentAnual'))));

  // 8. Energie și fericire revin spre o țintă, proporțional cu distanța. Așa fiecare
  // încărcare (job, studii) are un echilibru: țintă − cost/revenire (ex. curier: 75 − 4/0.15 ≈ 48).
  // Burnout-ul vine din cumul (2 joburi, evenimente), nu dintr-un job obișnuit.
  state.stat.energie += (lunar.energieTinta - state.stat.energie) * lunar.energieRevenire;
  state.stat.fericire += (lunar.fericireTinta - state.stat.fericire) * lunar.fericireRevenire;
  if (neplatit > 0) {
    penalizeaza(state, lunar.penalizari.lipsaBani);
    ac.neplatit += neplatit;
    ac.luniCuLipsuri += 1;
  }
  // Izolarea și epuizarea n-au podea: doar cumulul lor poate duce Fericirea la 0.
  const { izolare, epuizare, acasaTarziu } = lunar.penalizari;
  if (state.situatie.locuinta === 'acasa' && varstaLa(state.luna) >= acasaTarziu.varstaMin) penalizeaza(state, acasaTarziu);
  // O problemă de sănătate netratată te slăbește lună de lună.
  if (areFlag(state, lunar.penalizari.boalaNetratata.flag)) penalizeaza(state, lunar.penalizari.boalaNetratata);
  if (state.ascunse.retea < izolare.prag) penalizeaza(state, izolare);
  if (state.stat.energie < epuizare.prag) penalizeaza(state, epuizare);

  // 9. Restanțe: Biroul de Credit, somații, cesiune, executare silită; apoi poprirea pe cont
  proceseazaRestante(state, ctx);
  proceseazaPoprireCont(state, ctx);

  actualizeazaDerivate(state, ctx);
  inregistreazaLuna(state, ctx, { asigurat: esteAsigurat(state) });
  if (verificaIndependenta(state, ctx)) {
    adaugaJurnal(state, 'Investițiile și economiile tale îți acoperă acum cheltuielile. Ești independent financiar!');
    if (varstaLa(state.luna) < VARSTA_PENSIE - 1) programeazaUrmare(state, ctx, { eveniment: 'independenta-financiara', dupaLuni: 1 }, null);
  }
  verificaFinal(state, ctx, { lunar: true });
  state.luna += 1;
}

function valoareClasa(state, clasa) {
  return state.produse.reduce((s, p) => s + (p.tip === 'investitie' && p.clasa === clasa ? valoareProdus(p, state) : 0), 0);
}

function proceseazaSalariu(state, ctx, contract) {
  const ac = state.an.ac;
  const job = ctx.joburi.get(contract.jobId);
  const f = fluturas(contract.brut, contract.contract, ctx);

  // Poprirea se reține din net, până la limita legală (toate popririle la un loc).
  let limita = Math.round(f.net * cfg(ctx, 'poprire.procentMaxDinNet'));
  let retinut = 0;
  for (const p of gasesteProduse(state, 'poprire')) {
    const r = Math.min(p.datorie, limita);
    p.datorie -= r;
    p.retinutTotal += r;
    limita -= r;
    retinut += r;
    if (p.datorie === 0) {
      state.produse = state.produse.filter((x) => x !== p);
      adaugaJurnal(state, 'Poprirea s-a încheiat: datoria e acoperită. Salariul vine întreg de luna viitoare.');
    }
  }
  // Fără cont, salariul vine cash (la CIM, angajatorul va cere un cont: vezi evenimentul primul-cont).
  incaseaza(state, f.net - retinut, { cash: contract.contract === 'negru' });
  ac.venituri += f.net - retinut;
  ac.taxe += f.cas + f.cass + f.impozit + (f.retineri ?? 0);
  ac.retinutPoprire += retinut;

  if (contract.contract !== 'negru') {
    contract.luniVechime += 1;
    state.pensie.luniContributie += 1;
  }
  state.pensie.pilon2 += f.pilon2;

  state.stat.energie += job.energieLunara;
  state.stat.fericire += job.fericireLunara;
  state.ascunse.skill += job.skillAnual / 12;
  state.ascunse.reputatie += (job.reputatieAnual ?? 0) / 12;
  contract.luniLucrate = (contract.luniLucrate ?? 0) + 1;
  contract.luniDeLaMarire = (contract.luniDeLaMarire ?? 0) + 1;
  if (contract.luniLucrate === bal(ctx, 'cariera.luniPentruExperienta')) seteazaFlag(state, 'experienta_munca');

  if (!state.momente.primulSalariu) adaugaMoment(state, 'primulSalariu', { fluturas: f, job: job.titlu }, f.contract === 'negru' ? ['brut-net'] : ['brut-net', 'pilonii-pensiei']);
  if (retinut > 0 && !state.momente.primaPoprire) adaugaMoment(state, 'primaPoprire', { retinut, net: f.net }, ['poprire']);
}

function finalizeazaStudii(state, ctx) {
  const { id } = state.situatie.studii;
  const info = bal(ctx, `studii.${id}`);
  state.situatie.studii = null;
  state.situatie.nivelStudii = info.nivel;
  state.ascunse.skill += info.skillLaFinal;
  seteazaFlag(state, `absolvent_${info.nivel}`);
  adaugaJurnal(state, info.nivel === 'licenta' ? 'Ai terminat facultatea!' : 'Ai terminat școala și ai o calificare.');
  // Căminul e doar pentru studenți: la absolvire, camera se eliberează.
  if (state.situatie.locuinta === 'camin') {
    state.situatie.locuinta = 'acasa';
    adaugaJurnal(state, 'Ai predat camera de cămin și te-ai întors, deocamdată, la părinți.');
  }
  // Cu diploma în mână: CV-ul și primele oferte full-time.
  if (!areJobFullTime(state, ctx)) programeazaUrmare(state, ctx, { eveniment: bal(ctx, 'cariera.evenimentCV'), dupaLuni: 1 }, null);
}

// Penalizare lunară care nu coboară statistica sub „podea” (ce e deja sub podea rămâne neatins).
function penalizeaza(state, p) {
  const aplica = (obiect, cheie) => {
    if (!p[cheie] || obiect[cheie] <= p.podea) return;
    obiect[cheie] = Math.max(p.podea, obiect[cheie] - p[cheie]);
  };
  aplica(state.stat, 'fericire');
  aplica(state.stat, 'energie');
  aplica(state.ascunse, 'retea');
}

// Plătește facturile lunii plus restanțele. Întoarce cât s-a plătit.
function proceseazaFacturi(state, ctx) {
  const penalitate = cfg(ctx, 'facturi.penalitateLunara');
  let platitTotal = 0;
  for (const [categorie, sumaLuna] of Object.entries(facturiLunare(state, ctx))) {
    let f = gasesteProduse(state, `factura:${categorie}`)[0];
    if (!sumaLuna && !f) continue;
    if (f) {
      const pen = Math.round(f.restanta * penalitate);
      f.restanta += pen;
      f.penalitati += pen;
    }
    const datorat = sumaLuna + (f?.restanta ?? 0);
    const platit = plateste(state, datorat);
    platitTotal += platit;
    const ramas = datorat - platit;
    if (ramas > 0) {
      if (!f) {
        const cauza = categorie === 'telefon' ? null : state.situatie.cauzaLocuinta ?? null;
        f = creeazaProdus({ tip: 'factura', categorie, cauza }, state, ctx);
        state.produse.push(f);
      }
      f.restanta = ramas;
      f.luniRestanta += 1;
    } else if (f) {
      if (f.furnizor === 'utilitati' && areFlag(state, 'deconectat')) {
        const taxa = plateste(state, pret(state, ctx, 'facturi.taxaReconectare'));
        platitTotal += taxa;
        adaugaJurnal(state, 'Ți-au reconectat utilitățile, după ce ai plătit restanța și taxa de reconectare.');
      }
      inchideFactura(state, f);
    }
  }
  return platitTotal;
}

// Executorul poprește și contul curent, peste suma protejată.
// Executarea silită nu se oprește la salariu: executorul poprește contul curent (peste suma
// protejată), apoi economiile, sparge depozitele și vinde investițiile, până acoperă datoria.
function proceseazaPoprireCont(state, ctx) {
  const popriri = gasesteProduse(state, 'poprire');
  if (!popriri.length) return;
  const datorieTotala = () => popriri.reduce((t, p) => t + p.datorie, 0);
  const surse = [];
  const cont = contCurent(state);
  if (cont) surse.push({ tip: 'cont', disponibil: Math.max(0, cont.sold - pret(state, ctx, 'poprire.sumaProtejataCont')), ia: (x) => { cont.sold -= x; } });
  for (const e of gasesteProduse(state, 'contEconomii')) surse.push({ tip: 'economii', disponibil: e.sold, ia: (x) => { e.sold -= x; } });

  let dinCont = 0;
  let dinEconomii = 0;
  const imparte = (suma) => {
    for (const p of popriri) {
      const luat = Math.min(p.datorie, suma);
      p.datorie -= luat;
      p.retinutTotal += luat;
      suma -= luat;
    }
  };
  for (const sursa of surse) {
    const luat = Math.min(sursa.disponibil, datorieTotala());
    if (!luat) continue;
    sursa.ia(luat);
    imparte(luat);
    if (sursa.tip === 'cont') dinCont += luat;
    else dinEconomii += luat;
  }
  // Depozitele și investițiile se lichidează doar cât e nevoie, una câte una.
  for (const p of [...state.produse]) {
    if (datorieTotala() === 0) break;
    if (p.tip !== 'depozit' && !(p.tip === 'investitie' && p.clasa !== 'titluriStat')) continue;
    const suma = lichideaza(state, ctx, p); // banii ajung în portofel
    const luat = plateste(state, Math.min(suma, datorieTotala()));
    imparte(luat);
    dinEconomii += luat;
  }

  state.an.ac.retinutPoprire += dinCont + dinEconomii;
  if (dinCont && !state.momente.primaPoprireCont) adaugaMoment(state, 'primaPoprireCont', { retinut: dinCont }, ['poprire-cont']);
  if (dinEconomii) adaugaJurnal(state, `Executorul a luat ${formateazaLei(inLei(dinEconomii))} lei din economii și investiții.`);
  for (const p of popriri) {
    if (p.datorie === 0) {
      state.produse = state.produse.filter((x) => x !== p);
      adaugaJurnal(state, 'Poprirea s-a încheiat: datoria e acoperită.');
    }
  }
}

function proceseazaRestante(state, ctx) {
  const r = (k) => cfg(ctx, `restante.${k}`);
  const fc = (k) => cfg(ctx, `facturi.${k}`);
  const lunar = bal(ctx, 'lunar');
  let areRestante = false;

  for (const p of [...state.produse]) {
    if ((p.tip === 'factura' || p.tip === 'credit' || p.tip === 'poprire') && datorieProdus(p) > 0 && datorieProdus(p) < 100) {
      state.produse = state.produse.filter((x) => x !== p); // rest de rotunjire, sub 1 leu
      continue;
    }
    if (p.tip === 'factura' && p.luniRestanta > 0) {
      areRestante = true;
      escaladeazaFactura(state, ctx, p, fc);
      continue;
    }
    if ((p.tip !== 'credit' && p.tip !== 'cardCredit') || p.luniRestanta === 0) continue;
    areRestante = true;
    if (p.luniRestanta >= r('luniPanaLaRaportare')) {
      state.ascunse.scorCredit -= lunar.scorCreditPenalizareLunara;
      seteazaFlag(state, `istoric_restante:${r('aniInIstoric') * 12}`);
    }
    if (p.luniRestanta === 1 && p.laRestanta) {
      programeazaUrmare(state, ctx, { eveniment: p.laRestanta, dupaLuni: 1 }, p.cauza);
    }

    const cesionat = p.tip === 'credit' && p.stadiu === 'cesionat';
    if (!cesionat && p.luniRestanta >= r('luniPanaLaCesiune')) {
      cesioneaza(state, ctx, p);
    } else if (cesionat && p.luniRestanta >= r('luniPanaLaExecutare')) {
      state.produse = state.produse.filter((x) => x !== p);
      const poprire = creeazaProdus({ tip: 'poprire', suma: p.restanta, creditor: 'recuperator', cauza: p.cauza }, state, ctx);
      state.produse.push(poprire);
      delete state.flaguri.datorie_recuperator;
      seteazaFlag(state, `executare_silita:${r('aniInIstoric') * 12}`);
      adaugaJurnal(state, `A început executarea silită: poprire pe salariu până acoperi ${formateazaLei(inLei(p.restanta))} lei.`, { tip: 'datorie', cauza: p.cauza });
    }
  }

  if (areRestante) penalizeaza(state, lunar.penalizari.restante);
  if (areFlag(state, 'deconectat')) penalizeaza(state, lunar.penalizari.deconectat);
  if (areFlag(state, 'telefon_suspendat')) penalizeaza(state, lunar.penalizari.telefonSuspendat);

  // Istoricul bun crește încet scorul (doar dacă ai produse de credit și plătești la timp).
  const areCredit = state.produse.some((p) => p.tip === 'credit' || p.tip === 'cardCredit');
  if (areCredit && !areRestante) state.ascunse.scorCredit += lunar.scorCreditCrestereLunara;
}

// Lanțul facturilor: somație → deconectare / suspendare / evacuare → recuperare → executare.
function escaladeazaFactura(state, ctx, f, fc) {
  const n = f.luniRestanta;
  const nume = NUME_FACTURI[f.furnizor];
  if (n === fc('luniPanaLaSomatie')) {
    adaugaJurnal(state, `Ai primit o somație: restanță la ${nume}.`, { tip: 'datorie', cauza: f.cauza });
    if (!state.urmari.some((u) => u.eveniment === 'facturi-somatie')) {
      programeazaUrmare(state, ctx, { eveniment: 'facturi-somatie', dupaLuni: 1 }, f.cauza);
    }
  }
  if (f.furnizor === 'utilitati' && n === fc('luniPanaLaDeconectare')) {
    seteazaFlag(state, 'deconectat');
    adaugaJurnal(state, 'Ți-au tăiat curentul și gazul pentru neplată.', { tip: 'datorie', cauza: f.cauza });
  }
  if (f.furnizor === 'telefon' && n === fc('luniPanaLaSuspendare')) {
    seteazaFlag(state, 'telefon_suspendat');
    adaugaJurnal(state, 'Ți-au suspendat abonamentul de telefon.');
  }
  if (f.furnizor === 'chirie' && n === fc('luniPanaLaEvacuare')) {
    // Evacuarea e imediată; evenimentul care urmează decide unde stai de acum.
    state.situatie.locuinta = bal(ctx, 'locuintaDupaEvacuare');
    seteazaFlag(state, 'evacuat:24');
    adaugaJurnal(state, 'Proprietarul te-a evacuat pentru neplata chiriei. Datoria rămâne.', { tip: 'datorie', cauza: f.cauza });
    programeazaUrmare(state, ctx, { eveniment: 'evacuare', dupaLuni: 1 }, f.cauza);
  }
  if (n >= fc('luniPanaLaRecuperare')) {
    delete state.flaguri[FLAG_FACTURA[f.furnizor]];
    cesioneaza(state, ctx, f);
  }
}

// Datoria e vândută unei firme de recuperare: devine scadentă integral, plus costuri.
function cesioneaza(state, ctx, p) {
  const datorie = Math.round(datorieProdus(p) * (1 + cfg(ctx, 'restante.comisionRecuperare')));
  const nou = creeazaProdus({ tip: 'credit', furnizor: 'recuperator', suma: 0, dae: 0, luni: 1, cauza: p.cauza }, state, ctx);
  Object.assign(nou, { stadiu: 'cesionat', restanta: datorie, luniRestanta: p.luniRestanta, flag: 'datorie_recuperator' });
  state.produse = state.produse.map((x) => (x === p ? nou : x));
  seteazaFlag(state, 'datorie_recuperator');
  adaugaJurnal(state, `Datoria ta a fost vândută unei firme de recuperare. Acum ai de dat ${formateazaLei(inLei(datorie))} lei.`, { tip: 'datorie', cauza: p.cauza });
}

// ---------- Final ----------

// lunar = true doar la finalul unei luni (atunci se numără lunile de faliment).
function verificaFinal(state, ctx, { lunar = false } = {}) {
  if (state.final) return;
  const g = bal(ctx, 'gameOver');
  if (lunar) {
    const prag = inBani(g.falimentPragDatorii) * state.indicePreturi;
    const datorii = datoriiTotale(state);
    const insolvent = activeLichidabile(state) < datorii; // economii + depozite + investiții (fără Pilonul II)
    if (state.stat.bani === 0 && datorii >= prag && insolvent) state.contoare.luniFaliment += 1;
    else state.contoare.luniFaliment = 0;
  }

  let motiv = null;
  if (lunar) {
    // Renunțarea cere Fericire 0 câteva luni la rând: un șoc singur trece (Fericirea revine spre țintă);
    // doar cumulul (izolare, epuizare: penalizări fără podea) o poate ține jos.
    state.contoare.luniFericireZero = state.stat.fericire <= 0 ? (state.contoare.luniFericireZero ?? 0) + 1 : 0;
  }
  if (state.contoare.luniFaliment >= g.falimentLuni) motiv = 'faliment';
  else if (state.stat.energie <= 0) motiv = 'burnout';
  else if ((state.contoare.luniFericireZero ?? 0) >= g.renuntareLuni) motiv = 'renuntare';
  if (!motiv) return;

  // Decizia care a pornit cea mai mare datorie: de aici pornește „Ce s-a întâmplat?”.
  const datorii = state.produse.filter((p) => datorieProdus(p) > 0).sort((a, b) => datorieProdus(b) - datorieProdus(a));
  state.final = { tip: 'final', motiv, luna: state.luna, cauza: datorii[0]?.cauza ?? state.decizii.at(-1)?.id ?? null };
}

// ---------- Acțiuni din meniuri (între evenimente) ----------

const CAMPURI_SETABILE = { cardCredit: ['plata', 'cumparaturiPeCard'], contEconomii: ['fondUrgenta'], depozit: ['reinnoire'] };

export { sansaMarire };

// Toate acțiunile din meniuri. Fiecare întoarce { ok, mesaj }: mesajul e mereu un text de arătat
// jucătorului (confirmarea sau motivul refuzului), ca nicio apăsare să nu rămână fără răspuns.
export const ACTIUNI = ['deschide', 'seteaza', 'depune', 'retrage', 'lichideaza', 'ramburseaza', 'cumpara', 'stilViata', 'cereMarire', 'cautaJob'];

const NUME_PRODUS = { contCurent: 'contul curent', contEconomii: 'contul de economii', depozit: 'depozitul', cardCredit: 'cardul de credit', investitie: 'investiția' };
const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;

export function actiune(state, ctx, tip, param = {}) {
  const rez = executaActiune(state, ctx, tip, param);
  if (!rez.mesaj) rez.mesaj = rez.ok ? 'Gata.' : 'Nu se poate.';
  return rez;
}

function executaActiune(state, ctx, tip, param) {
  if (state.pendinte?.tip === 'eveniment' || state.final) return { ok: false, mesaj: 'Termină întâi decizia curentă.' };
  const prod = param.id ? state.produse.find((p) => p.id === param.id) : null;
  if (param.id && !prod) return { ok: false, mesaj: 'Produsul nu mai există.' };
  const suma = param.suma != null ? inBani(param.suma) : null;
  let rez;

  switch (tip) {
    case 'deschide': {
      const spec = { ...param, suma: suma ?? undefined, limita: param.limita != null ? inBani(param.limita) : undefined };
      if (spec.tip === 'cardCredit') {
        if (state.ascunse.scorCredit < bal(ctx, 'cardCredit.scorCreditMinim')) return { ok: false, mesaj: 'Banca refuză: istoricul de credit nu e suficient de bun.' };
        if (!gasesteProduse(state, 'contractMunca').length) return { ok: false, mesaj: 'Banca refuză: ai nevoie de un venit stabil.' };
      }
      if (['contCurent', 'cardCredit'].includes(spec.tip) && gasesteProduse(state, spec.tip).length) return { ok: false, mesaj: 'Ai deja unul.' };
      if (spec.tip === 'credit' || spec.tip === 'poprire' || spec.tip === 'contractMunca') return { ok: false, mesaj: 'Nu se deschide din meniu.' };
      if (spec.tip === 'depozit' && !(suma > 0)) return { ok: false, mesaj: 'Scrie suma pentru depozit.' };
      const p = deschideProdus(state, ctx, spec);
      if (!p) return { ok: false, mesaj: 'Nu ai destui bani.' };
      const texte = {
        contCurent: p.pachet === 'tineri' ? 'Ai deschis un cont pentru tineri.' : 'Ai deschis un cont curent.',
        contEconomii: 'Ai deschis un cont de economii.',
        depozit: `Ai deschis un depozit de ${leiText(p.sold)}.`,
        cardCredit: `Banca ți-a aprobat un card de credit cu limita de ${leiText(p.limita)}.`,
      };
      rez = { ok: true, produs: p, mesaj: texte[p.tip] ?? 'Gata.' };
      break;
    }
    case 'seteaza': {
      const permise = CAMPURI_SETABILE[prod?.tip] ?? [];
      const campuri = Object.keys(param.campuri ?? {});
      if (!campuri.length || campuri.some((c) => !permise.includes(c))) return { ok: false, mesaj: 'Setare nepermisă.' };
      Object.assign(prod, param.campuri);
      const c = param.campuri;
      const mesaj = 'fondUrgenta' in c ? (c.fondUrgenta ? 'Contul e acum fondul tău de urgență.' : 'Contul nu mai e fond de urgență.')
        : 'plata' in c ? (c.plata === 'integral' ? 'Vei achita tot extrasul în fiecare lună: 0 dobândă.' : 'Vei plăti doar minimul: restul face dobândă.')
          : 'cumparaturiPeCard' in c ? (c.cumparaturiPeCard ? 'Cumpărăturile merg pe cardul de credit.' : 'Cumpărăturile merg din contul tău.')
            : 'Setare salvată.';
      rez = { ok: true, mesaj };
      break;
    }
    case 'depune': {
      if (prod?.tip !== 'contEconomii' && prod?.tip !== 'contCurent') return { ok: false, mesaj: 'Poți depune doar într-un cont.' };
      if (!(suma > 0)) return { ok: false, mesaj: 'Scrie o sumă.' };
      const disponibil = prod.tip === 'contCurent' ? state.numerar : baniDisponibili(state);
      if (disponibil < suma) return { ok: false, mesaj: 'Nu ai destui bani.' };
      plateste(state, suma, prod.tip === 'contCurent' ? 'cash' : 'portofel');
      prod.sold += suma;
      rez = { ok: true, mesaj: `Ai depus ${leiText(suma)} în ${NUME_PRODUS[prod.tip]}.` };
      break;
    }
    case 'retrage': {
      if (prod?.tip !== 'contEconomii' && prod?.tip !== 'contCurent') return { ok: false, mesaj: 'Poți retrage doar dintr-un cont.' };
      if (!(suma > 0)) return { ok: false, mesaj: 'Scrie o sumă.' };
      if (prod.sold < suma) return { ok: false, mesaj: 'Nu ai atâția bani în cont.' };
      prod.sold -= suma;
      incaseaza(state, suma, { cash: prod.tip === 'contCurent' });
      rez = { ok: true, mesaj: `Ai retras ${leiText(suma)} din ${NUME_PRODUS[prod.tip]}.` };
      break;
    }
    case 'lichideaza': {
      if (!['depozit', 'investitie', 'contEconomii'].includes(prod?.tip)) return { ok: false, mesaj: 'Nu se poate lichida.' };
      if (prod.clasa === 'titluriStat') return { ok: false, mesaj: 'Titlurile de stat se încasează la maturitate.' };
      const s = lichideaza(state, ctx, prod);
      rez = { ok: true, suma: s, mesaj: `Ai închis ${NUME_PRODUS[prod.tip]} și ai primit ${leiText(s)}.` };
      break;
    }
    case 'ramburseaza': {
      if (!['credit', 'cardCredit', 'poprire', 'factura'].includes(prod?.tip)) return { ok: false, mesaj: 'Nu e o datorie.' };
      if (baniDisponibili(state) < datorieProdus(prod)) return { ok: false, mesaj: `Nu ai destui bani: îți trebuie ${leiText(datorieProdus(prod))}.` };
      const s = ramburseaza(state, prod);
      rez = { ok: true, suma: s, mesaj: prod.tip === 'factura' ? `Ai plătit ${leiText(s)} restanță la ${NUME_FACTURI[prod.furnizor]}.` : `Ai plătit ${leiText(s)}. Datoria e închisă.` };
      break;
    }
    case 'cumpara': {
      // Cumpărături din meniu: { suma (lei), eticheta, fericire?, peCard? }
      if (!(suma > 0)) return { ok: false, mesaj: 'Sumă invalidă.' };
      const card = gasesteProduse(state, 'cardCredit')[0];
      const sursa = param.peCard && card ? 'cardCredit' : 'portofel';
      const disponibil = sursa === 'cardCredit' ? cardDisponibil(card) : baniDisponibili(state);
      if (disponibil < suma) return { ok: false, mesaj: sursa === 'cardCredit' ? 'Limita cardului nu ajunge.' : 'Nu ai destui bani.' };
      plateste(state, suma, sursa);
      state.stat.fericire = Math.min(100, state.stat.fericire + (param.fericire ?? 0));
      const text = `Ai cumpărat ${param.eticheta ?? 'ceva'} (${leiText(suma)}${sursa === 'cardCredit' ? ', cu cardul de credit' : ''}).`;
      if (param.eticheta) adaugaJurnal(state, text);
      rez = { ok: true, mesaj: text };
      break;
    }
    case 'stilViata': {
      const r = schimbaStil(state, ctx, param.nivel);
      if (!r.schimbat) return { ok: false, mesaj: 'Ăsta e deja stilul tău.' };
      adaugaJurnal(state, `Ai trecut la un stil de viață ${r.nivel.nume.toLowerCase()}.`);
      rez = { ok: true, sus: r.sus, mesaj: r.sus ? 'Te bucuri de noul stil. O să te obișnuiești repede cu el.' : 'Primele luni o să fie mai greu, apoi te obișnuiești.' };
      break;
    }
    case 'cereMarire': {
      const c = contractCurent(state);
      if (!c) return { ok: false, mesaj: 'N-ai job.' };
      if (c.contract === 'negru') return { ok: false, mesaj: 'La negru nu există mărire „oficială”. Patronul râde.' };
      const r = cereMarire(state, ctx);
      if (r.preaDevreme) return { ok: false, mesaj: r.text };
      adaugaJurnal(state, r.text);
      rez = { ok: true, succes: r.succes, mesaj: r.text };
      break;
    }
    case 'cautaJob': {
      // Deschide imediat CV-ul; jocul continuă cu oprirea întoarsă aici.
      if (state.an) return { ok: false, mesaj: 'Poți căuta alt job între ani.' };
      if (areFlag(state, 'cautare_job')) return { ok: false, mesaj: 'Ai căutat de curând. Mai așteaptă puțin.' };
      seteazaFlag(state, 'cautare_job:12');
      const ev = ctx.evenimente.get(bal(ctx, 'cariera.evenimentCV'));
      state.pendinte = creeazaOprireEveniment(ev, state, ctx);
      persista(state, ctx);
      return { ok: true, mesaj: 'Hai să-ți facem CV-ul.', oprire: oprireCurenta(state, ctx) };
    }
    default:
      return { ok: false, mesaj: `Acțiune necunoscută: ${tip}` };
  }
  actualizeazaDerivate(state, ctx);
  persista(state, ctx);
  return rez;
}
