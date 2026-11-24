// Afacerea proprie (lotul 6a): pregătirea (plan, studiu de piață, curs, experiență), pornirea
// (domeniu, formă juridică PFA / II / SRL, capital din economii, credit, investitor sau grant),
// luna firmei (vânzări, costuri, taxe, contul firmei separat de al tău), banii scoși din firmă
// (la SRL: dividende impozitate) și închiderea (lichidare sau, la SRL fără bani, insolvență).
// Reușita nu e o aruncare de zar: pregătirea decide calitatea; norocul lunii e doar ±20%.

import { bal, cfg, clamp, formateazaLei, inLei } from './util.js';
import { aleator, normal, sansa } from './rng.js';
import { baniDisponibili, creeazaProdus, incaseaza, plateste, pret, rataAnuitate, rataLunara } from './finance.js';
import { programeazaUrmare } from './events.js';
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
  adaugaJurnal(state, `Ai făcut un studiu de piață pentru: ${d.titlu}.`);
  return { ok: true, mesaj: `Știi acum cine îți sunt clienții și cine e concurența pentru ${d.titlu}.` };
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
  // Rezerva: 3 luni de costuri fixe, plus lunile în care clienții încă nu plătesc sau marfa e cumpărată înainte.
  const luniRezerva = 3 + (d.incasareLuni ?? 0) + (d.stocLuni ?? 0);
  const capitalLucru = luniRezerva * costuriLunareFixe(state, ctx, d);
  const grant = areFlag(state, 'grant_aprobat') ? Math.min(pret(state, ctx, 'afaceri.grant'), investitie) : 0;
  const investitor = finantare.investitor ? Math.round(investitie * cfg(ctx, 'afaceri.capitalInvestitor')) : 0;
  const credit = finantare.credit ? Math.max(0, Math.round((investitie - grant - investitor) * 0.7)) : 0;
  const dinEconomii = Math.max(0, investitie - grant - investitor - credit) + capitalLucru;
  const p = pregatire(state, ctx, idDomeniu);
  const rez = {
    domeniu: d, forma, investitie, capitalLucru, luniRezerva, grant, investitor, credit, dinEconomii, pregatire: p,
    cota: finantare.investitor ? 1 - bal(ctx, 'afaceri.cotaInvestitor') : 1,
    estimare: estimareLunara(state, ctx, d, p.total),
    rataCredit: credit ? rataAnuitate(credit, rataLunara(cfg(ctx, 'afaceri.creditFirmaDae')), cfg(ctx, 'afaceri.creditFirmaLuni')) : 0,
  };
  if (afacereActiva(state)) return { ok: false, ...rez, mesaj: 'Ai deja o afacere.' };
  if (credit && (!areFlag(state, 'plan_afaceri') || p.total < 50)) return { ok: false, ...rez, mesaj: 'Banca dă credit pentru firmă doar cu un plan de afaceri și o pregătire de cel puțin 50 de puncte.' };
  if (credit && (areFlag(state, 'istoric_restante') || areFlag(state, 'executare_silita'))) return { ok: false, ...rez, mesaj: 'Banca refuză: istoricul tău de credit nu e curat.' };
  if (baniDisponibili(state) < dinEconomii) return { ok: false, ...rez, mesaj: `Îți trebuie ${leiText(dinEconomii)} din banii tăi (investiția neacoperită plus ${luniRezerva} luni de costuri fixe ca rezervă).` };
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
  adaugaJurnal(state, `Ți-ai deschis afacerea: ${sim.domeniu.titlu}, ca ${forme[forma]}. Investiție: ${leiText(sim.investitie)}.`);
  return {
    ok: true,
    mesaj: `Afacerea ta a pornit: ${sim.domeniu.titlu}! Primele luni sunt mai slabe: clienții vin treptat. Ai pus în firmă și ${leiText(sim.capitalLucru)} rezervă pentru costurile fixe.`,
    lectie: forma === 'srl'
      ? 'La SRL, datoriile firmei nu sunt ale tale, dar banii firmei nici ei nu sunt ai tăi: îi scoți ca dividende, cu impozit.'
      : 'La PFA și II, firma ești tu: dacă afacerea pierde bani, pierderile se plătesc din banii tăi.',
    concepte: ['pfa-srl', 'raspundere-limitata', 'capital-de-lucru'],
  };
}

// ---------- Luna firmei ----------

// Venitul potențial și costurile fixe, după extinderi (nivel 0, 1, 2).
function potentialFirma(state, ctx, a, d) {
  return Math.round(bani(state, ctx, d.id, 'venitPotential') * bal(ctx, 'afaceri.extindere.factorPotential') ** (a.nivel ?? 0));
}
function costuriFixeFirma(state, ctx, a, d) {
  const extra = (a.angajatiExtra ?? 0) * Math.round(pret(state, ctx, d.salariuAngajat) * (1 + cfg(ctx, 'afaceri.contributieAngajator')));
  return Math.round(costuriLunareFixe(state, ctx, d) * bal(ctx, 'afaceri.extindere.factorCosturi') ** (a.nivel ?? 0)) + extra + (a.marketing ?? 0);
}

// Lunar, din motor. Profitul (ce s-a vândut minus ce s-a consumat) nu e același lucru cu banii din cont:
// clienții unor firme plătesc după 1–2 luni, iar marfa se cumpără înainte. Întoarce rezultatele lunii.
export function proceseazaAfacere(state, ctx) {
  const a = afacereActiva(state);
  if (!a) return null;
  const d = domeniu(ctx, a.domeniu);
  const b = bal(ctx, 'afaceri');
  const p = b.pret[a.pret ?? 'mediu'];
  const potential = potentialFirma(state, ctx, a, d);
  const maturitate = Math.min(1, (a.luniActiva + 1) / d.luniMaturitate);
  const criza = state.an?.lunaCrash != null ? b.factorAnCuCriza : 1;
  const concurenta = areFlag(state, 'concurenta_afacere') ? b.riscuri.factorConcurenta : 1;
  const noroc = Math.exp(b.zgomotLunar * normal(state, 'actiuni') - (b.zgomotLunar * b.zgomotLunar) / 2);
  const marketing = b.marketing.bonusMax * (1 - Math.exp(-(a.marketing ?? 0) / (b.marketing.scalaMarketing * potential)));
  // Cererea (în „volum”, la prețul mediu) și capacitatea echipei.
  const reputatie = 0.85 + (a.reputatie ?? 30) / 200; // 30 = neutru; 100 = +20% clienți
  const cerere = potential * calitate(ctx, a.pregatire) * (0.3 + 0.7 * maturitate) * d.sezon[state.luna % 12] * criza * concurenta * noroc * p.volum * (1 + marketing) * reputatie;
  const capacitate = potential * (b.capacitateBaza + b.capacitateAngajat * (a.angajatiExtra ?? 0)) * Math.max(1, d.sezon[state.luna % 12]);
  const volum = Math.min(cerere, capacitate);
  a.clientiPierduti = Math.round(Math.max(0, cerere - capacitate) * p.pret);
  const venit = Math.round(volum * p.pret);
  const marfa = Math.round(volum * d.costVariabil);
  const costuri = costuriFixeFirma(state, ctx, a, d) + marfa;
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
  // Banii care intră luna asta: vânzările de acum (sau, la firme cu clienți-firme, cele de acum 1–2 luni).
  a.deIncasat = [...(a.deIncasat ?? []), venit];
  const incasat = a.deIncasat.length > (d.incasareLuni ?? 0) ? a.deIncasat.shift() : 0;
  // Marfa se cumpără cu stocLuni înainte: plătești acum marfa pentru luna viitoare (estimare = luna asta).
  let platitMarfa = marfa;
  if (d.stocLuni) {
    platitMarfa = a.stocCumparat == null ? marfa * 2 : marfa; // la început cumperi și stocul
    a.stocCumparat = marfa;
  }
  const cash = incasat - (costuri - marfa) - platitMarfa - taxe - rata;
  a.cont += cash;
  a.luniActiva += 1;
  a.reputatie = clamp((a.reputatie ?? 30) + p.reputatie * (a.pregatire / 100) + (marketing > 0.05 ? 0.3 : 0) - (a.clientiPierduti > 0 ? 0.5 : 0), 0, 100);
  a.istoric = [...a.istoric, { luna: state.luna, venit, costuri, taxe, profit: profitBrut - taxe, cash }].slice(-24);
  state.stat.energie += b.energieLunara;
  programeazaRiscuri(state, ctx, a, d);
  acoperaLipsa(state, ctx, a, d);
  return { venit, costuri, taxe, profit: profitBrut - taxe, cash };
}

// Riscurile firmei, ca evenimente cu decizie (fluxul RNG „actiuni”).
function programeazaRiscuri(state, ctx, a, d) {
  const r = bal(ctx, 'afaceri.riscuri');
  const deja = (id) => state.urmari.some((u) => u.eveniment === id);
  if (d.incasareLuni && sansa(state, 'actiuni', r.sansaClientNeplatitorAnual / 12) && !deja('afacere-client-neplatitor')) {
    const suma = a.deIncasat?.[0] ?? 0;
    if (suma > 0) {
      a.deIncasat[0] = 0; // banii acestui client nu mai vin de la sine
      programeazaUrmare(state, ctx, { eveniment: 'afacere-client-neplatitor', dupaLuni: 1, variabile: { suma: Math.round(inLei(suma)) } }, null);
    }
  }
  if (a.luniActiva > 6 && sansa(state, 'actiuni', r.sansaConcurentaAnual / 12) && !deja('afacere-concurenta') && !areFlag(state, 'concurenta_afacere')) {
    programeazaUrmare(state, ctx, { eveniment: 'afacere-concurenta', dupaLuni: 1 }, null);
  }
  if (a.luniActiva > 6 && sansa(state, 'actiuni', r.sansaControlFiscalAnual / 12) && !deja('afacere-control-fiscal')) {
    programeazaUrmare(state, ctx, { eveniment: 'afacere-control-fiscal', dupaLuni: 1 }, null);
  }
}

// ---------- Deciziile ----------

export function seteazaAfacere(state, ctx, { pret: pretNou, marketing, angajatiExtra }) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  const b = bal(ctx, 'afaceri');
  const mesaje = [];
  if (pretNou !== undefined) {
    if (!b.pret[pretNou]) return { ok: false, mesaj: 'Alege prețul: mic, mediu sau mare.' };
    a.pret = pretNou;
    mesaje.push({ mic: 'Prețuri mici: vin mai mulți clienți, dar câștigi mai puțin pe fiecare.', mediu: 'Prețuri ca la concurență.', mare: 'Prețuri mari: mai puțini clienți, dar câștigi mai mult pe fiecare.' }[pretNou]);
  }
  if (marketing !== undefined) {
    if (!(marketing >= 0)) return { ok: false, mesaj: 'Bugetul de marketing nu poate fi negativ.' };
    a.marketing = Math.round(marketing * 100);
    mesaje.push(marketing ? `Marketing: ${leiText(a.marketing)} pe lună. Primii lei aduc cei mai mulți clienți; după un punct, fiecare leu în plus aduce tot mai puțin.` : 'Fără marketing: clienții vin doar din recomandări.');
  }
  if (angajatiExtra !== undefined) {
    if (!(Number.isInteger(angajatiExtra) && angajatiExtra >= 0 && angajatiExtra <= b.angajatiMax)) return { ok: false, mesaj: `Între 0 și ${b.angajatiMax} angajați în plus.` };
    const d = domeniu(ctx, a.domeniu);
    a.angajatiExtra = angajatiExtra;
    mesaje.push(`Echipa: ${d.angajatiMinim + angajatiExtra} angajați. Fiecare costă salariul plus contribuția angajatorului, dar poți servi mai mulți clienți.`);
  }
  return { ok: true, mesaj: mesaje.join(' '), concepte: angajatiExtra !== undefined ? ['salariu-angajator'] : [] };
}

export function simuleazaExtindere(state, ctx) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  const e = bal(ctx, 'afaceri.extindere');
  const cost = Math.round(a.investitie * e.factorInvestitie);
  if ((a.nivel ?? 0) >= e.nivelMax) return { ok: false, cost, mesaj: 'Afacerea e deja la mărimea maximă.' };
  if (a.luniActiva < domeniu(ctx, a.domeniu).luniMaturitate) return { ok: false, cost, mesaj: 'Extinde-te după ce afacerea s-a așezat (clienții te cunosc).' };
  if (a.cont < cost) return { ok: false, cost, mesaj: `Extinderea costă ${leiText(cost)}; firma are ${leiText(a.cont)}.` };
  return { ok: true, cost };
}

export function extindeAfacerea(state, ctx) {
  const sim = simuleazaExtindere(state, ctx);
  if (!sim.ok) return sim;
  const a = afacereActiva(state);
  a.cont -= sim.cost;
  a.nivel = (a.nivel ?? 0) + 1;
  a.investitie += sim.cost;
  adaugaJurnal(state, `Ți-ai extins afacerea (${leiText(sim.cost)}).`);
  return { ok: true, mesaj: `Afacerea e mai mare: poate vinde mai mult, dar și costurile fixe au crescut. Ai nevoie de mai mulți clienți ca să merite.`, lectie: 'O extindere crește riscul: costurile fixe se plătesc și în lunile slabe.' };
}

// Împrumut pentru firmă, cu afacerea deja pornită (la SRL, cu garanția ta; la PFA / II, pe numele tău).
export function imprumutFirma(state, ctx, suma) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma.' };
  if (areFlag(state, 'istoric_restante') || areFlag(state, 'executare_silita')) return { ok: false, mesaj: 'Banca refuză: istoricul tău de credit nu e curat.' };
  if (a.credit || state.produse.some((p) => p.tip === 'credit' && p.furnizor === 'firma')) return { ok: false, mesaj: 'Firma are deja un credit.' };
  const ultimul = a.istoric.slice(-6);
  if (ultimul.length < 6 || ultimul.reduce((s, x) => s + x.profit, 0) <= 0) return { ok: false, mesaj: 'Banca vrea să vadă cel puțin 6 luni pe profit.' };
  const max = Math.round(potentialFirma(state, ctx, a, domeniu(ctx, a.domeniu)) * 3);
  if (suma > max) return { ok: false, mesaj: `Banca îți dă cel mult ${leiText(max)}.` };
  const dae = cfg(ctx, 'afaceri.creditFirmaDae');
  const luni = cfg(ctx, 'afaceri.creditFirmaLuni');
  if (a.forma === 'srl') {
    a.credit = { rest: suma, rata: rataAnuitate(suma, rataLunara(dae), luni), rLunar: rataLunara(dae), luniRamase: luni };
    a.garantiePersonala = true;
    a.cont += suma;
  } else {
    // La PFA / II creditul e pe numele tău (rata se plătește din banii tăi), dar banii merg în firmă.
    state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'firma', suma, dae, luni }, state, ctx));
    a.cont += suma;
  }
  adaugaJurnal(state, `Ai luat un credit de ${leiText(suma)} pentru firmă.`);
  return { ok: true, mesaj: `Firma a primit ${leiText(suma)}.${a.forma === 'srl' ? ' Ai semnat garanția personală: dacă firma nu plătește, plătești tu.' : ''}`, concepte: ['raspundere-limitata'] };
}

// ---------- Vânzarea firmei ----------

export function simuleazaVanzare(state, ctx) {
  const a = afacereActiva(state);
  if (!a) return { ok: false, mesaj: 'N-ai o afacere.' };
  const v = bal(ctx, 'afaceri.vanzare');
  const ultimul = a.istoric.slice(-12);
  const profitAn = ultimul.length ? (ultimul.reduce((s, x) => s + x.profit, 0) * 12) / ultimul.length : 0;
  const pretFirma = Math.max(0, Math.round(profitAn * v.multiplicatorProfitAnual));
  const datorii = a.datorii + (a.credit?.rest ?? 0);
  const brut = Math.round((pretFirma + a.cont - datorii) * a.cota);
  const impozit = Math.round(Math.max(0, brut - a.investitie * a.cota) * cfg(ctx, 'afaceri.impozitVanzareFirma'));
  const rez = { pretFirma, profitAn, datorii, brut, impozit, net: brut - impozit };
  if (a.luniActiva < v.luniMinime) return { ok: false, ...rez, mesaj: `Nimeni nu cumpără o afacere de ${NUME_LUNI(a.luniActiva)}: arată întâi un an de rezultate.` };
  if (profitAn <= 0) return { ok: false, ...rez, mesaj: 'O afacere care pierde bani nu are cumpărători. Poți doar s-o închizi.' };
  return { ok: true, ...rez };
}

export function vindeAfacerea(state, ctx) {
  const sim = simuleazaVanzare(state, ctx);
  if (!sim.ok) return sim;
  const a = afacereActiva(state);
  state.produse = state.produse.filter((p) => p !== a);
  incaseaza(state, sim.net);
  adaugaJurnal(state, `Ți-ai vândut afacerea: ai primit ${leiText(sim.net)}.`);
  return {
    ok: true,
    mesaj: `Ai vândut afacerea cu ${leiText(sim.pretFirma)} (cam ${(sim.pretFirma / Math.max(1, sim.profitAn)).toFixed(1)} ani de profit). Tu primești ${leiText(sim.net)}, după datorii${sim.impozit ? ` și ${leiText(sim.impozit)} impozit` : ''}.`,
    lectie: 'O afacere valorează cât profitul pe care îl va face. De aceea un an bun înainte de vânzare îți crește prețul.',
    concepte: ['evaluare-afacere'],
  };
}

const NUME_LUNI = (n) => (n === 1 ? 'o lună' : `${n} luni`);

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
  let mesaj = `Firma ta (${d.titlu}) a intrat în insolvență: n-a mai putut plăti furnizorii ${bal(ctx, 'afaceri.luniInsolventa')} luni la rând. Datoriile ei rămân ale firmei.`;
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
  adaugaJurnal(state, `Ai închis afacerea (${d.titlu}) după ${a.luniActiva} luni.`);
  return { ok: true, mesaj, lectie: 'Cele mai multe afaceri mici se închid în primii ani. Contează să știi când să te oprești, înainte să pierzi tot.' };
}
