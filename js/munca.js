// Ce poți face la job (meniul Carieră): ritmul de muncă, ore suplimentare, promovarea cerută,
// cursul plătit de firmă (cu clauză de fidelitate), demisia, jobul secundar și meseriile de artist,
// cu venit variabil și faimă. Zarurile (venitul artiștilor, vânzările online) folosesc fluxul „actiuni”.

import { bal, cfg, clamp, formateazaLei, inLei } from './util.js';
import { aleator, normal } from './rng.js';
import { creeazaProdus, fluturas, incaseaza, plateste, pret } from './finance.js';
import {
  RITMURI, contractCurent, indeplinesteCerinte, jobCurent, luniPanaLaPromovare, promovareDisponibila, promoveaza, schimbaJob,
} from './cariera.js';
import { adaugaJurnal, areFlag, seteazaFlag } from './state.js';
import { consumaTimp, motivTimp } from './activitati.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
const NUME_RITM = { relaxat: 'relaxat', normal: 'normal', intens: 'intens' };

// ---------- Ritmul de muncă ----------

export function seteazaRitm(state, ctx, ritmNou) {
  const c = contractCurent(state);
  if (!c) return { ok: false, mesaj: 'N-ai job.' };
  if (!RITMURI.includes(ritmNou)) return { ok: false, mesaj: 'Alege relaxat, normal sau intens.' };
  if ((c.ritm ?? 'normal') === ritmNou) return { ok: false, mesaj: `Lucrezi deja în ritm ${NUME_RITM[ritmNou]}.` };
  c.ritm = ritmNou;
  const texte = {
    relaxat: 'Lucrezi mai relaxat: ai mai multă energie, dar șefii observă. Măririle și promovarea vin mai greu.',
    normal: 'Lucrezi în ritm normal.',
    intens: 'Tragi tare: reputația crește și promovarea vine mai repede, dar energia scade lună de lună.',
  };
  return { ok: true, mesaj: texte[ritmNou], lectie: ritmNou === 'intens' ? 'Ritmul intens plătește pe termen lung doar dacă nu te arde. Energia la zero înseamnă burnout.' : null };
}

// ---------- Ore suplimentare ----------

export function simuleazaOreSuplimentare(state, ctx) {
  const c = contractCurent(state);
  const job = jobCurent(state, ctx);
  if (!c || job?.program !== 'full-time' || c.contract !== 'cim' || job.artist) return { ok: false, mesaj: 'Ore suplimentare plătite se fac la un job full-time cu contract de muncă.' };
  const m = (k) => cfg(ctx, `munca.${k}`);
  const brut = Math.round((c.brut / m('oreLunareNormale')) * m('oreSuplimentarePerTura') * (1 + m('sporOreSuplimentare')));
  const f = fluturas(c.brut, 'cim', ctx);
  const net = Math.round(brut * (f.net / f.brut));
  return { ok: true, brut, net };
}

export function oreSuplimentare(state, ctx) {
  const sim = simuleazaOreSuplimentare(state, ctx);
  if (!sim.ok) return sim;
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  const b = bal(ctx, 'cariera.oreSuplimentare');
  incaseaza(state, sim.net);
  state.stat.energie = clamp(state.stat.energie + b.energie, 0, 100);
  state.stat.fericire = clamp(state.stat.fericire + b.fericire, 0, 100);
  state.ascunse.reputatie = clamp(state.ascunse.reputatie + b.reputatie, 0, 100);
  if (state.an?.ac) state.an.ac.venituri += sim.net;
  adaugaJurnal(state, `Ai făcut ore suplimentare: ${leiText(sim.net)} în plus, net.`);
  return {
    ok: true,
    mesaj: `Ai lucrat peste program și ai primit ${leiText(sim.net)} net (cu spor de ${Math.round(cfg(ctx, 'munca.sporOreSuplimentare') * 100)}%).`,
    lectie: 'Orele suplimentare se plătesc cu spor, dar se plătesc și din energia ta. Nu-ți construi bugetul pe ele.',
    concepte: ['ore-suplimentare'],
  };
}

// ---------- Promovarea cerută ----------

export function cerePromovare(state, ctx) {
  const c = contractCurent(state);
  const job = jobCurent(state, ctx);
  if (!c) return { ok: false, mesaj: 'N-ai job.' };
  if (!job.urmator) return { ok: false, mesaj: 'Ești deja în vârful scării la postul ăsta. Ca să urci, schimbă jobul sau domeniul.' };
  if (c.contract === 'negru') return { ok: false, mesaj: 'La negru nu există promovări pe hârtie.' };
  if (!promovareDisponibila(state, ctx)) {
    const luni = luniPanaLaPromovare(state, ctx);
    const urm = ctx.joburi.get(job.urmator);
    return {
      ok: false,
      mesaj: luni > 0
        ? `Încă nu: șefii vor să mai vadă cam ${luni} luni de muncă bună. Ritmul intens scurtează timpul.`
        : `Pentru ${urm.titlu} îți trebuie mai multă pregătire (cursuri, studii, experiență).`,
    };
  }
  const r = promoveaza(state, ctx, null);
  adaugaJurnal(state, r.text);
  return { ok: true, mesaj: r.text, lectie: 'O promovare aduce de obicei o creștere mai mare decât o mărire pe același post.' };
}

// ---------- Curs plătit de firmă (clauză de fidelitate) ----------

export function cursFirma(state, ctx) {
  const c = contractCurent(state);
  const b = bal(ctx, 'cariera.cursFirma');
  if (!c || c.contract !== 'cim') return { ok: false, mesaj: 'Firma plătește cursuri doar angajaților cu contract de muncă.' };
  if (c.luniVechime < b.luniVechimeMin) return { ok: false, mesaj: `Firma plătește cursuri după ${b.luniVechimeMin} luni de vechime.` };
  if (areFlag(state, 'clauza_fidelitate')) return { ok: false, mesaj: 'Ai făcut deja un curs pe banii firmei; încă ești legat prin clauza de fidelitate.' };
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  state.ascunse.skill = clamp(state.ascunse.skill + b.skill, 0, 100);
  state.ascunse.reputatie = clamp(state.ascunse.reputatie + b.reputatie, 0, 100);
  seteazaFlag(state, `clauza_fidelitate:${b.luniClauza}`);
  adaugaJurnal(state, 'Ai făcut un curs plătit de firmă. Ai semnat o clauză de fidelitate.');
  return {
    ok: true,
    mesaj: `Cursul e gratis pentru tine, dar dacă pleci în următoarele ${b.luniClauza} luni, returnezi cam ${leiText(pret(state, ctx, 'munca.costCursFirma'))}.`,
    lectie: 'O clauză de fidelitate e corectă: firma investește în tine, tu rămâi o vreme. Citește-o înainte să semnezi.',
    concepte: ['clauza-fidelitate'],
  };
}

// ---------- Demisie ----------

export function demisie(state, ctx) {
  const c = contractCurent(state);
  if (!c) return { ok: false, mesaj: 'N-ai job.' };
  const job = jobCurent(state, ctx);
  let platit = 0;
  if (areFlag(state, 'clauza_fidelitate')) {
    platit = plateste(state, pret(state, ctx, 'munca.costCursFirma'));
    delete state.flaguri.clauza_fidelitate;
  }
  schimbaJob(state, ctx, null);
  adaugaJurnal(state, `Ți-ai dat demisia de la jobul de ${job.titlu}.`);
  return {
    ok: true,
    mesaj: `Ți-ai dat demisia.${platit ? ` Ai returnat firmei ${leiText(platit)} pentru curs (clauza de fidelitate).` : ''} De luna viitoare nu mai vine salariul.`,
    lectie: 'La demisie nu primești ajutor de șomaj. Pleacă având un job nou sau un fond de urgență pentru lunile dintre.',
    concepte: ['fond-urgenta'],
  };
}

// ---------- Artiști: venit variabil și faimă ----------

export const jobArtist = (job) => !!job?.artist;

export function devinoArtist(state, ctx, jobId) {
  const job = ctx.joburi.get(jobId);
  if (!jobArtist(job)) return { ok: false, mesaj: 'Nu e o meserie de artist.' };
  if (contractCurent(state)?.jobId === jobId) return { ok: false, mesaj: `Ești deja ${job.titlu}.` };
  if (!indeplinesteCerinte(job, state, ctx)) {
    return { ok: false, mesaj: state.flaguri.are_hobby ? 'Încă nu ești destul de bun: mai exersează (pregătirea ta trebuie să crească).' : 'Întâi apucă-te de un hobby (meniul Activități) și exersează.' };
  }
  const faraTimp = motivTimp(state, ctx, 1);
  if (faraTimp) return { ok: false, mesaj: faraTimp };
  consumaTimp(state, 1);
  const c = schimbaJob(state, ctx, { id: jobId, contract: 'pfa' });
  c.faima = bal(ctx, 'cariera.artist.faimaStart');
  adaugaJurnal(state, `Ți-ai făcut din hobby o meserie: de acum ești ${job.titlu}, pe cont propriu.`);
  return {
    ok: true,
    mesaj: `Ești ${job.titlu}. Venitul tău va varia mult de la o lună la alta: unele luni sunt bune, altele aproape goale.`,
    lectie: 'Cu venit variabil, bugetul se face pe luna slabă, nu pe cea bună, iar fondul de urgență trebuie să fie mai mare (6–12 luni).',
    concepte: ['venit-variabil', 'pfa-srl'],
  };
}

// Brutul lunii pentru un artist (bani). Faima crește cu munca și scade când lucrezi relaxat.
export function venitArtistLuna(state, ctx, c, job) {
  const v = job.venitVariabil;
  const a = bal(ctx, 'cariera.artist');
  const r = bal(ctx, `cariera.ritm.${c.ritm ?? 'normal'}`);
  c.faima = clamp((c.faima ?? a.faimaStart) + r.faimaLunara + normal(state, 'actiuni') * a.faimaZgomotLunar, 0, 100);
  const noroc = Math.exp(v.volatilitate * normal(state, 'actiuni') - (v.volatilitate * v.volatilitate) / 2);
  let brut = pret(state, ctx, job.salariu) * (0.5 + c.faima / 40) * noroc;
  if (aleator(state, 'actiuni') < v.sansaComandaMare) brut += pret(state, ctx, job.salariu) * v.multiplicatorComandaMare;
  if ((v.lunaVarf ?? []).includes(state.luna % 12)) brut *= a.multiplicatorLunaVarf;
  c.istoricVenit = [...(c.istoricVenit ?? []), Math.round(brut)].slice(-12);
  return Math.round(brut);
}

// ---------- Jobul secundar (side hustle) ----------

export const activitateSecundara = (state) => state.produse.find((p) => p.tip === 'activitateSecundara');

export function descrieSecundare(state, ctx) {
  const activa = activitateSecundara(state);
  return [...(ctx.secundare?.values() ?? [])].map((s) => {
    const cerinte = s.cerinte ?? {};
    let motiv = null;
    if (activa && activa.secundarId !== s.id) motiv = 'Ai deja o activitate în plus. Oprește-o întâi.';
    else if (cerinte.skillMin && state.ascunse.skill < cerinte.skillMin) motiv = 'Nu ai încă pregătirea necesară.';
    else if (cerinte.flagNecesar && !state.flaguri[cerinte.flagNecesar]) {
      motiv = { certificat_it: 'Îți trebuie un certificat IT (bootcamp, în meniul Educație).', are_hobby: 'Îți trebuie un hobby (meniul Activități).' }[cerinte.flagNecesar] ?? 'Nu îndeplinești cerințele.';
    } else if (!activa) motiv = motivTimp(state, ctx, 1);
    return { ...s, venitLunar: pret(state, ctx, s.venit), activa: activa?.secundarId === s.id, disponibil: motiv == null, motiv };
  });
}

export function incepeSecundar(state, ctx, id) {
  const s = descrieSecundare(state, ctx).find((x) => x.id === id);
  if (!s) return { ok: false, mesaj: 'Activitatea asta nu există.' };
  if (s.activa) return { ok: false, mesaj: 'Faci deja asta.' };
  if (!s.disponibil) return { ok: false, mesaj: s.motiv };
  state.produse.push({ ...creeazaProdus({ tip: 'activitateSecundara' }, state, ctx), secundarId: id });
  adaugaJurnal(state, `Te-ai apucat de ceva în plus: ${s.titlu.toLowerCase()}.`);
  return {
    ok: true,
    mesaj: `Ai început: ${s.titlu.toLowerCase()}, cam ${leiText(s.venitLunar)} pe lună înainte de taxe. Îți ia o acțiune de timp în fiecare an și energie lunar.`,
    lectie: 'Un venit în plus e cea mai rapidă cale spre fondul de urgență. Se declară în Declarația unică, iar două joburi obosesc.',
    concepte: ['declaratia-unica'],
  };
}

export function opresteSecundar(state) {
  const a = activitateSecundara(state);
  if (!a) return { ok: false, mesaj: 'Nu ai o activitate în plus.' };
  state.produse = state.produse.filter((p) => p !== a);
  return { ok: true, mesaj: 'Ai renunțat la activitatea în plus. Ai mai mult timp și energie.' };
}

// Lunar: venitul net (după impozitul simplificat) și oboseala. Întoarce { net, impozit }.
export function proceseazaSecundar(state, ctx) {
  const a = activitateSecundara(state);
  const s = a && ctx.secundare?.get(a.secundarId);
  if (!s) return { net: 0, impozit: 0 };
  let brut = pret(state, ctx, s.venit);
  if (s.variabil) brut = Math.round(brut * Math.exp(0.6 * normal(state, 'actiuni') - 0.18));
  const impozit = Math.round(brut * cfg(ctx, 'munca.retineriVenitSecundar'));
  incaseaza(state, brut - impozit);
  state.stat.energie += s.energieLunara;
  return { net: brut - impozit, impozit };
}
