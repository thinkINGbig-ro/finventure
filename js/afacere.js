// Afacerea proprie (lotul 6a): pregătirea (plan, studiu de piață, curs, experiență), pornirea
// (domeniu, formă juridică PFA / II / SRL, capital din economii, credit, investitor sau grant),
// luna firmei (vânzări, costuri, taxe, contul firmei separat de al tău), banii scoși din firmă
// (la SRL: dividende impozitate) și închiderea (lichidare sau, la SRL fără bani, insolvență).
// Reușita nu e o aruncare de zar: pregătirea decide calitatea; norocul lunii e doar ±20%.

import { bal, cfg, clamp, formateazaLei, inLei } from './util.js';
import { aleator, normal } from './rng.js';
import { baniDisponibili, creeazaProdus, incaseaza, plateste, pret, rataAnuitate, rataLunara } from './finance.js';
import { adaugaJurnal, areFlag, seteazaFlag } from './state.js';
import { consumaTimp, motivTimp } from './activitati.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
export const afacereActiva = (state) => state.produse.find((p) => p.tip === 'afacere');
const domeniu = (ctx, id) => ctx.afaceri?.domenii.get(id);
const bani = (state, ctx, id, cheie) => pret(state, ctx, `afaceri.${id}.${cheie}`);

// ---------- Pregătirea ----------

export function pregatire(state, ctx, idDomeniu) {
  const p = bal(ctx, 'afaceri.pregatire');
  const d = domeniu(ctx, idDomeniu);
  const parti = {
    baza: p.baza,
    plan: areFlag(state, 'plan_afaceri') ? p.plan : 0,
    studiuPiata: areFlag(state, `studiu_piata_${idDomeniu}`) ? p.studiuPiata : 0,
    curs: areFlag(state, 'curs_antreprenoriat') ? p.curs : 0,
    experienta: (d?.experienta ?? []).some((x) => areFlag(state, `experienta_${x}`)) ? p.experienta : 0,
    skill: Math.round((state.ascunse.skill / 100) * p.skillMax),
  };
  return { total: clamp(Object.values(parti).reduce((s, x) => s + x, 0), 0, 100), parti };
}

export function faPlanAfaceri(state, ctx) {
  if (areFlag(state, 'plan_afaceri')) return { ok: false, mesaj: 'Ai deja un plan de afaceri.' };
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  seteazaFlag(state, 'plan_afaceri');
  adaugaJurnal(state, 'Ți-ai scris un plan de afaceri: costuri, prețuri, clienți, în cât timp își scoate banii.');
  return {
    ok: true, mesaj: 'Ai un plan de afaceri. Băncile și finanțatorii îl cer, iar tu știi acum unde pot apărea probleme.',
    lectie: 'Un plan de afaceri nu prezice viitorul, dar te obligă să faci calculele înainte să pui banii.', concepte: ['plan-de-afaceri'],
  };
}

export function faStudiuPiata(state, ctx, idDomeniu) {
  const d = domeniu(ctx, idDomeniu);
  if (!d) return { ok: false, mesaj: 'Alege un domeniu.' };
  if (areFlag(state, `studiu_piata_${idDomeniu}`)) return { ok: false, mesaj: 'Ai deja un studiu de piață pentru domeniul ăsta.' };
  const cost = pret(state, ctx, 'afaceri.costStudiuPiata');
  if (baniDisponibili(state) < cost) return { ok: false, mesaj: `Studiul costă ${leiText(cost)}.` };
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  plateste(state, cost);
  seteazaFlag(state, `studiu_piata_${idDomeniu}`);
  adaugaJurnal(state, `Ai făcut un studiu de piață pentru: ${d.titlu.toLowerCase()}.`);
  return { ok: true, mesaj: `Știi acum cine îți sunt clienții și cine e concurența pentru ${d.titlu.toLowerCase()}.` };
}

export function aplicaGrant(state, ctx) {
  if (areFlag(state, 'grant_incercat')) return { ok: false, mesaj: 'Ai aplicat deja la grant.' };
  if (!areFlag(state, 'plan_afaceri')) return { ok: false, mesaj: 'Pentru grant îți trebuie întâi un plan de afaceri.' };
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  seteazaFlag(state, 'grant_incercat');
  const p = Math.max(...[...ctx.afaceri.domenii.keys()].map((id) => pregatire(state, ctx, id).total));
  const sansa = bal(ctx, 'afaceri.sansaGrantBaza') + p / 200;
  if (aleator(state, 'actiuni') < sansa) {
    seteazaFlag(state, 'grant_aprobat');
    adaugaJurnal(state, `Ai câștigat un grant de ${leiText(pret(state, ctx, 'afaceri.grant'))} pentru afacerea ta.`);
    return { ok: true, mesaj: `Grantul de ${leiText(pret(state, ctx, 'afaceri.grant'))} a fost aprobat! Îl folosești când pornești afacerea.`, concepte: ['plan-de-afaceri'] };
  }
  adaugaJurnal(state, 'Aplicația pentru grant a fost respinsă.');
  return { ok: true, succes: false, mesaj: 'Aplicația a fost respinsă: au fost mulți candidați. O pregătire mai bună crește șansele.' };
}

// ---------- Pornirea ----------

// finantare: { credit: bool, investitor: bool }. Grantul aprobat se folosește automat.
export function simuleazaPornire(state, ctx, idDomeniu, forma, finantare = {}) {
  const d = domeniu(ctx, idDomeniu);
  if (!d) return { ok: false, mesaj: 'Alege un domeniu.' };
  if (!['pfa', 'ii', 'srl'].includes(forma)) return { ok: false, mesaj: 'Alege forma juridică.' };
  const investitie = bani(state, ctx, idDomeniu, 'investitie');
  const capitalLucru = 3 * costuriLunareFixe(state, ctx, d);
  const grant = areFlag(state, 'grant_aprobat') ? Math.min(pret(state, ctx, 'afaceri.grant'), investitie) : 0;
  const investitor = finantare.investitor ? Math.round(investitie * cfg(ctx, 'afaceri.capitalInvestitor')) : 0;
  const credit = finantare.credit ? Math.max(0, Math.round((investitie - grant - investitor) * 0.7)) : 0;
  const dinEconomii = Math.max(0, investitie - grant - investitor - credit) + capitalLucru;
  const p = pregatire(state, ctx, idDomeniu);
  const rez = {
    domeniu: d, forma, investitie, capitalLucru, grant, investitor, credit, dinEconomii, pregatire: p,
    cota: finantare.investitor ? 1 - bal(ctx, 'afaceri.cotaInvestitor') : 1,
    estimare: estimareLunara(state, ctx, d, p.total),
    rataCredit: credit ? rataAnuitate(credit, rataLunara(cfg(ctx, 'afaceri.creditFirmaDae')), cfg(ctx, 'afaceri.creditFirmaLuni')) : 0,
  };
  if (afacereActiva(state)) return { ok: false, ...rez, mesaj: 'Ai deja o afacere.' };
  if (credit && (!areFlag(state, 'plan_afaceri') || p.total < 50)) return { ok: false, ...rez, mesaj: 'Banca dă credit pentru firmă doar cu un plan de afaceri și o pregătire de cel puțin 50 de puncte.' };
  if (credit && (areFlag(state, 'istoric_restante') || areFlag(state, 'executare_silita'))) return { ok: false, ...rez, mesaj: 'Banca refuză: istoricul tău de credit nu e curat.' };
  if (baniDisponibili(state) < dinEconomii) return { ok: false, ...rez, mesaj: `Îți trebuie ${leiText(dinEconomii)} din banii tăi (investiția neacoperită plus 3 luni de costuri fixe ca rezervă).` };
  const faraTimp = motivTimp(state, ctx, bal(ctx, 'afaceri.timpPornire'));
  if (faraTimp) return { ok: false, ...rez, mesaj: faraTimp };
  return { ok: true, ...rez };
}

function costuriLunareFixe(state, ctx, d) {
  return bani(state, ctx, d.id, 'costuriFixe') + Math.round(d.angajatiMinim * pret(state, ctx, d.salariuAngajat) * (1 + cfg(ctx, 'afaceri.contributieAngajator')));
}

// Cât din venitul potențial atinge afacerea, după pregătire.
const calitate = (ctx, pregatireTotal) => bal(ctx, 'afaceri.calitateBaza') + pregatireTotal * bal(ctx, 'afaceri.calitatePerPunct');

// Profitul lunar estimat la maturitate, înainte de taxe, cu pregătirea dată (fără noroc și sezon).
export function estimareLunara(state, ctx, d, pregatireTotal) {
  const venit = Math.round(bani(state, ctx, d.id, 'venitPotential') * calitate(ctx, pregatireTotal));
  const costuri = costuriLunareFixe(state, ctx, d) + Math.round(venit * d.costVariabil);
  return { venit, costuri, profit: venit - costuri };
}

export function pornesteAfacere(state, ctx, idDomeniu, forma, finantare = {}) {
  const sim = simuleazaPornire(state, ctx, idDomeniu, forma, finantare);
  if (!sim.ok) return sim;
  consumaTimp(state, bal(ctx, 'afaceri.timpPornire'));
  plateste(state, sim.dinEconomii);
  if (sim.grant) delete state.flaguri.grant_aprobat;
  const a = creeazaProdus({ tip: 'afacere' }, state, ctx);
  Object.assign(a, {
    domeniu: idDomeniu, forma, cota: sim.cota, pregatire: sim.pregatire.total, investitie: sim.investitie,
    cont: sim.capitalLucru, datorii: 0, luniFaraPlata: 0, luniActiva: 0, istoric: [], totalScos: 0,
    credit: null, garantiePersonala: false,
  });
  if (sim.credit) {
    const dae = cfg(ctx, 'afaceri.creditFirmaDae');
    const luni = cfg(ctx, 'afaceri.creditFirmaLuni');
    if (forma === 'srl') {
      // Creditul e al firmei, dar banca cere garanția ta personală.
      a.credit = { rest: sim.credit, rata: sim.rataCredit, rLunar: rataLunara(dae), luniRamase: luni };
      a.garantiePersonala = true;
    } else {
      // La PFA / II firma ești tu: creditul e pe numele tău.
      const c = creeazaProdus({ tip: 'credit', furnizor: 'firma', suma: sim.credit, dae, luni }, state, ctx);
      state.produse.push(c);
    }
  }
  state.produse.push(a);
  const forme = { pfa: 'PFA', ii: 'întreprindere individuală', srl: 'SRL' };
  adaugaJurnal(state, `Ți-ai deschis afacerea: ${sim.domeniu.titlu.toLowerCase()}, ca ${forme[forma]}. Investiție: ${leiText(sim.investitie)}.`);
  return {
    ok: true,
    mesaj: `Afacerea ta a pornit (${sim.domeniu.titlu.toLowerCase()})! Primele luni sunt mai slabe: clienții vin treptat. Ai pus în firmă și ${leiText(sim.capitalLucru)} rezervă pentru costurile fixe.`,
    lectie: forma === 'srl'
      ? 'La SRL, datoriile firmei nu sunt ale tale, dar banii firmei nici ei nu sunt ai tăi: îi scoți ca dividende, cu impozit.'
      : 'La PFA și II, firma ești tu: dacă afacerea pierde bani, pierderile se plătesc din banii tăi.',
    concepte: ['pfa-srl', 'raspundere-limitata', 'capital-de-lucru'],
  };
}

// ---------- Luna firmei ----------

// Lunar, din motor. Întoarce { venit, costuri, taxe, profit } pentru rezumat (banii firmei, nu ai tăi).
export function proceseazaAfacere(state, ctx) {
  const a = afacereActiva(state);
  if (!a) return null;
  const d = domeniu(ctx, a.domeniu);
  const b = bal(ctx, 'afaceri');
  const maturitate = Math.min(1, (a.luniActiva + 1) / d.luniMaturitate);
  const criza = state.an?.lunaCrash != null ? b.factorAnCuCriza : 1;
  const noroc = Math.exp(b.zgomotLunar * normal(state, 'actiuni') - (b.zgomotLunar * b.zgomotLunar) / 2);
  const venit = Math.round(bani(state, ctx, d.id, 'venitPotential') * calitate(ctx, a.pregatire) * (0.3 + 0.7 * maturitate) * d.sezon[state.luna % 12] * criza * noroc);
  const costuri = costuriLunareFixe(state, ctx, d) + Math.round(venit * d.costVariabil);
  const profitBrut = venit - costuri;
  const taxe = a.forma === 'srl' ? Math.round(venit * cfg(ctx, 'afaceri.impozitMicro')) : Math.round(Math.max(0, profitBrut) * cfg(ctx, 'afaceri.taxeProfitPfa'));
  let rata = 0;
  if (a.credit && a.credit.rest > 0) {
    a.credit.rest += Math.round(a.credit.rest * a.credit.rLunar);
    rata = Math.min(a.credit.rata, a.credit.rest);
    a.credit.rest -= rata;
    a.credit.luniRamase -= 1;
    if (a.credit.rest <= 0) a.credit = null;
  }
  a.cont += profitBrut - taxe - rata;
  a.luniActiva += 1;
  a.istoric = [...a.istoric, { luna: state.luna, venit, costuri, taxe, profit: profitBrut - taxe }].slice(-24);
  state.stat.energie += b.energieLunara;
  acoperaLipsa(state, ctx, a, d);
  return { venit, costuri, taxe, profit: profitBrut - taxe };
}

// Contul firmei pe minus: la PFA / II plătești tu; la SRL rămân datorii ale firmei, iar după câteva luni vine insolvența.
function acoperaLipsa(state, ctx, a, d) {
  if (a.cont >= 0) {
    const dinDatorii = Math.min(a.datorii, a.cont);
    a.datorii -= dinDatorii;
    a.cont -= dinDatorii;
    a.luniFaraPlata = a.datorii > 0 ? a.luniFaraPlata + 1 : 0;
  } else if (a.forma === 'srl') {
    a.datorii += -a.cont;
    a.cont = 0;
    a.luniFaraPlata += 1;
  } else {
    const lipsa = -a.cont;
    const platit = plateste(state, lipsa);
    a.cont = 0;
    a.datorii += lipsa - platit;
    if (platit > 0 && !a.aPlatitDinBuzunar) {
      a.aPlatitDinBuzunar = true;
      adaugaJurnal(state, `Afacerea a avut o lună pe minus: ai acoperit ${leiText(platit)} din banii tăi (la ${a.forma === 'pfa' ? 'PFA' : 'II'}, firma ești tu).`);
    }
    a.luniFaraPlata = a.datorii > 0 ? a.luniFaraPlata + 1 : 0;
  }
  if (a.forma === 'srl' && a.luniFaraPlata >= bal(ctx, 'afaceri.luniInsolventa')) insolventa(state, ctx, a, d);
}

function insolventa(state, ctx, a, d) {
  state.produse = state.produse.filter((p) => p !== a);
  let mesaj = `Firma ta (${d.titlu.toLowerCase()}) a intrat în insolvență: n-a mai putut plăti furnizorii ${bal(ctx, 'afaceri.luniInsolventa')} luni la rând. Datoriile ei rămân ale firmei.`;
  if (a.credit && a.credit.rest > 0 && a.garantiePersonala) {
    const c = creeazaProdus({ tip: 'credit', furnizor: 'garantieFirma', suma: a.credit.rest, dae: cfg(ctx, 'afaceri.creditFirmaDae'), luni: Math.max(12, a.credit.luniRamase) }, state, ctx);
    state.produse.push(c);
    mesaj += ` Doar creditul pe care l-ai garantat personal (${leiText(a.credit.rest)}) trece pe numele tău.`;
  }
  adaugaJurnal(state, mesaj, { tip: 'datorie', cauza: a.cauza });
}

// ---------- Banii între tine și firmă ----------

export function retrageDinFirma(state, ctx, suma) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma.' };
  if (a.datorii > 0) return { ok: false, mesaj: 'Firma are datorii neplătite: întâi plătește furnizorii.' };
  if (a.cont < suma) return { ok: false, mesaj: `Firma are doar ${leiText(a.cont)} în cont.` };
  a.cont -= suma;
  if (a.forma === 'srl') {
    // Dividendele se împart după cote; partea ta se impozitează.
    const partea = Math.round(suma * a.cota);
    const impozit = Math.round(partea * (cfg(ctx, 'afaceri.impozitDividende') + cfg(ctx, 'afaceri.cassDividende')));
    incaseaza(state, partea - impozit);
    a.totalScos += partea - impozit;
    return {
      ok: true,
      mesaj: `Ai distribuit ${leiText(suma)} ca dividende: tu primești ${leiText(partea - impozit)} după ${leiText(impozit)} impozit și CASS${a.cota < 1 ? `; investitorul ia ${leiText(suma - partea)}` : ''}.`,
      concepte: ['dividende'],
    };
  }
  const partea = Math.round(suma * a.cota);
  incaseaza(state, partea);
  a.totalScos += partea;
  return { ok: true, mesaj: `Ai luat ${leiText(partea)} din afacere (taxele pe profit sunt deja plătite)${a.cota < 1 ? `; partenerul ia ${leiText(suma - partea)}` : ''}.` };
}

export function depuneInFirma(state, ctx, suma) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma.' };
  if (baniDisponibili(state) < suma) return { ok: false, mesaj: 'Nu ai destui bani.' };
  plateste(state, suma);
  a.cont += suma;
  const dinDatorii = Math.min(a.datorii, a.cont);
  a.datorii -= dinDatorii;
  a.cont -= dinDatorii;
  if (!a.datorii) a.luniFaraPlata = 0;
  return { ok: true, mesaj: `Ai pus ${leiText(suma)} în firmă${dinDatorii ? `; ${leiText(dinDatorii)} au mers la datorii` : ''}.` };
}

// ---------- Închiderea ----------

export function inchideAfacere(state, ctx) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  const d = domeniu(ctx, a.domeniu);
  // Echipamentele se vând la o fracție din cost; din bani se plătesc datoriile și creditul firmei.
  const echipamente = Math.round(a.investitie * 0.3);
  let disponibil = a.cont + echipamente - a.datorii - (a.credit?.rest ?? 0);
  state.produse = state.produse.filter((p) => p !== a);
  let mesaj;
  if (disponibil >= 0) {
    const partea = Math.round(disponibil * a.cota);
    incaseaza(state, partea);
    mesaj = `Ai închis afacerea. După datorii și vânzarea echipamentelor, ți-au rămas ${leiText(partea)}.`;
  } else if (a.forma === 'srl' && !(a.garantiePersonala && a.credit?.rest > 0)) {
    mesaj = 'Ai închis firma. Banii n-au ajuns pentru toate datoriile, dar la SRL ele rămân ale firmei, nu ale tale.';
  } else {
    // PFA / II: restul datoriilor e al tău. SRL: doar partea din creditul garantat personal.
    const datorie = a.forma === 'srl' ? Math.min(-disponibil, a.credit.rest) : -disponibil;
    disponibil = -datorie;
    const platit = plateste(state, datorie);
    disponibil += platit;
    if (disponibil < 0) state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'furnizori', suma: -disponibil, dae: 0, luni: 12 }, state, ctx));
    mesaj = `Ai închis afacerea. Datoriile ei au rămas ale tale: ai plătit ${leiText(platit)}${disponibil < 0 ? `, iar ${leiText(-disponibil)} rămân de plătit în rate` : ''}.`;
  }
  adaugaJurnal(state, `Ai închis afacerea (${d.titlu.toLowerCase()}) după ${a.luniActiva} luni.`);
  return { ok: true, mesaj, lectie: 'Cele mai multe afaceri mici se închid în primii ani. Contează să știi când să te oprești, înainte să pierzi tot.' };
}
