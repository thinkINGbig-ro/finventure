// Meniul Educație: studii lungi la orice vârstă (facultate, postliceală, master, doctorat), cu taxă,
// credit de studii sau bursă, și cursuri scurte (certificate, calificări, permis) care merg în paralel.
// Conținutul e în data/educatie.json; banii în config.json (studii.*, cursuri.*).

import { bal, cfg, dupaCale, formateazaLei, inLei } from './util.js';
import { baniDisponibili, creeazaProdus, incaseaza, plateste, pret } from './finance.js';
import { motivNeindeplinire } from './events.js';
import { adaugaJurnal, seteazaFlag } from './state.js';
import { consumaTimp, motivTimp } from './activitati.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
const bilant = (state) => state.bilant ?? {};

// ---------- Studii lungi ----------

const durata = (ctx, id) => cfg(ctx, `studii.${id}.durataLuni`);
const taxaAnuala = (state, ctx, id) => pret(state, ctx, `studii.${id}.taxaAnuala`);
const ani = (luni) => Math.round(luni / 12);

function motivProgram(state, ctx, p) {
  if (state.situatie.studii) return 'Ești deja la studii. Termină-le întâi sau renunță la ele.';
  return motivNeindeplinire(p.conditii, state, ctx) ?? motivTimp(state, ctx, bal(ctx, 'educatie.timpProgramLung'));
}

// Bursa lunară la care ai dreptul la înscriere (bani, la prețurile de azi), sau 0.
function bursaLaInscriere(state, ctx, id, program) {
  if (id === 'doctorat') return 'studii.doctorat.bursaLunara';
  if (program.bursaMerit && state.ascunse.skill >= bal(ctx, 'educatie.skillBursaMerit')) return 'studii.bursaMeritLunara';
  return null;
}

export function descrieProgram(state, ctx, p) {
  const taxa = taxaAnuala(state, ctx, p.id);
  const luni = durata(ctx, p.id);
  const motiv = motivProgram(state, ctx, p);
  const bursa = bursaLaInscriere(state, ctx, p.id, p);
  return {
    id: p.id, titlu: p.titlu, emoji: p.emoji, descriere: p.descriere,
    taxaAnuala: taxa, luni, costTotal: taxa * ani(luni), bursaLunara: bursa ? pret(state, ctx, bursa) : 0,
    creditStudii: !!p.creditStudii && taxa > 0, disponibil: motiv == null, motiv,
  };
}

// credit: true = taxa întregii perioade se plătește cu un credit de studii.
export function inscrieProgram(state, ctx, id, { credit = false } = {}) {
  const p = ctx.educatie?.programe.get(id);
  if (!p) return { ok: false, mesaj: 'Programul ăsta nu există.' };
  const motiv = motivProgram(state, ctx, p);
  if (motiv) return { ok: false, mesaj: motiv };
  const taxa = taxaAnuala(state, ctx, id);
  const luni = durata(ctx, id);
  const studii = { id, luniRamase: luni, inceputLa: state.luna };

  if (credit && taxa > 0) {
    if (!p.creditStudii) return { ok: false, mesaj: 'Pentru programul ăsta nu se dă credit de studii.' };
    const suma = taxa * ani(luni);
    const c = creeazaProdus({
      tip: 'credit', furnizor: 'studii', suma, dae: cfg(ctx, 'studii.creditStudii.dae'),
      luni: cfg(ctx, 'studii.creditStudii.luni'), luniFaraDobanda: cfg(ctx, 'studii.creditStudii.luniFaraDobanda'),
    }, state, ctx);
    state.produse.push(c);
    studii.taxaPlatita = true;
    inregistreazaCost(state, suma);
  } else if (taxa > 0 && baniDisponibili(state) < taxa) {
    return { ok: false, mesaj: `Pentru primul an îți trebuie ${leiText(taxa)}.${p.creditStudii ? ' Poți lua un credit de studii.' : ''}` };
  }
  const bursa = bursaLaInscriere(state, ctx, id, p);
  if (bursa) studii.bursa = bursa;
  state.situatie.studii = studii;
  consumaTimp(state, bal(ctx, 'educatie.timpProgramLung'));
  adaugaJurnal(state, `Te-ai înscris: ${p.titlu.toLowerCase()}${credit && taxa ? ', cu un credit de studii' : ''}${bursa ? ', cu bursă' : ''}.`);
  const detalii = [
    `${ani(luni)} ani`,
    taxa ? (credit ? `taxa plătită cu un credit de ${leiText(taxa * ani(luni))}` : `taxa: ${leiText(taxa)} pe an`) : 'fără taxă',
    bursa ? `bursă de ${leiText(pret(state, ctx, bursa))} pe lună` : null,
  ].filter(Boolean).join(', ');
  return { ok: true, mesaj: `Te-ai înscris la ${p.titlu.toLowerCase()}: ${detalii}.`, lectie: p.lectie ?? null, concepte: p.concepte ?? [] };
}

export function renuntaStudii(state, ctx) {
  const s = state.situatie.studii;
  if (!s) return { ok: false, mesaj: 'Nu ești la studii.' };
  const p = ctx.educatie?.programe.get(s.id);
  state.situatie.studii = null;
  if (state.situatie.locuinta === 'camin') state.situatie.locuinta = 'acasa';
  adaugaJurnal(state, `Ai renunțat la ${p?.titlu.toLowerCase() ?? 'studii'}.`);
  return {
    ok: true,
    mesaj: 'Ai renunțat la studii. Taxele plătite nu se mai întorc.',
    lectie: 'Banii dați deja pe o școală sunt cheltuiți oricum: decizia corectă se ia doar după ce urmează, nu după ce ai plătit.',
  };
}

// Lunar, din motor: bursa și taxa anuală (fără taxă dacă e plătită cu credit). Întoarce { venit, cheltuiala, neplatit }.
export function proceseazaStudiiLuna(state, ctx) {
  const s = state.situatie.studii;
  const r = { venit: 0, cheltuiala: 0, neplatit: 0 };
  if (!s) return r;
  if (s.bursa) {
    r.venit = pret(state, ctx, s.bursa);
    incaseaza(state, r.venit);
  }
  if (!s.taxaPlatita && (state.luna - s.inceputLa) % 12 === 0 && dupaCale(ctx.config, `studii.${s.id}.taxaAnuala`)) {
    const taxa = taxaAnuala(state, ctx, s.id);
    r.cheltuiala = plateste(state, taxa);
    r.neplatit = taxa - r.cheltuiala;
    inregistreazaCost(state, r.cheltuiala);
  }
  return r;
}

// ---------- Cursuri scurte ----------

function motivCurs(state, ctx, c, vars) {
  if (state.flaguri[c.flag]) return 'Ai deja certificatul ăsta.';
  if ((state.cursuri ?? []).some((x) => x.id === c.id)) return 'Ești deja înscris la cursul ăsta.';
  return motivNeindeplinire(c.conditii, state, ctx, vars)
    ?? (baniDisponibili(state) < vars.pret ? `Cursul costă ${leiText(vars.pret)}.` : null)
    ?? motivTimp(state, ctx, c.timp ?? 1);
}

// „pret”: calea din config.json (cu sau fără „pret:” în față), ajustată cu inflația, în bani.
function varsCurs(state, ctx, c) {
  return { pret: pret(state, ctx, c.pret.replace(/^pret:/, '')) };
}

export function descrieCurs(state, ctx, c) {
  const vars = varsCurs(state, ctx, c);
  const motiv = motivCurs(state, ctx, c, vars);
  const activ = (state.cursuri ?? []).find((x) => x.id === c.id);
  return {
    id: c.id, titlu: c.titlu, emoji: c.emoji, descriere: c.descriere,
    pret: vars.pret, luni: c.luni, timp: c.timp ?? 1, terminat: !!state.flaguri[c.flag], luniRamase: activ?.luniRamase ?? null,
    disponibil: motiv == null, motiv,
  };
}

export function inscrieCurs(state, ctx, id) {
  const c = ctx.educatie?.cursuri.get(id);
  if (!c) return { ok: false, mesaj: 'Cursul ăsta nu există.' };
  const vars = varsCurs(state, ctx, c);
  const motiv = motivCurs(state, ctx, c, vars);
  if (motiv) return { ok: false, mesaj: motiv };
  plateste(state, vars.pret);
  inregistreazaCost(state, vars.pret);
  consumaTimp(state, c.timp ?? 1);
  (state.cursuri ??= []).push({ id, luniRamase: c.luni, inceputLa: state.luna });
  adaugaJurnal(state, `Te-ai înscris la ${c.titlu.toLowerCase()}${vars.pret ? ` (${leiText(vars.pret)})` : ''}.`);
  return { ok: true, mesaj: `Te-ai înscris. Cursul durează ${c.luni === 1 ? 'o lună' : `${c.luni} luni`}.`, lectie: c.lectie ?? null, concepte: c.concepte ?? [] };
}

// Lunar, din motor: oboseala cursurilor și certificatele la final.
export function proceseazaCursuriLuna(state, ctx) {
  if (!state.cursuri?.length) return;
  for (const activ of [...state.cursuri]) {
    const c = ctx.educatie?.cursuri.get(activ.id);
    if (!c) { state.cursuri = state.cursuri.filter((x) => x !== activ); continue; }
    if (c.energieLunara) state.stat.energie += c.energieLunara;
    activ.luniRamase -= 1;
    if (activ.luniRamase > 0) continue;
    state.cursuri = state.cursuri.filter((x) => x !== activ);
    state.ascunse.skill += c.skillLaFinal ?? 0;
    seteazaFlag(state, c.flag);
    adaugaJurnal(state, `Ai terminat ${c.titlu.toLowerCase()} și ai primit certificatul.`);
  }
}

// ---------- Educația ca investiție (pentru finalul vieții) ----------

function inregistreazaCost(state, bani) {
  if (!state.bilant) return;
  state.bilant.costEducatieAzi = (state.bilant.costEducatieAzi ?? 0) + bani / state.indicePreturi;
}

// Cât ai dat pe educație și cât au adus în plus salariile tale față de jobul de bază cu doar liceul
// (în lei de azi). Nu toată diferența vine din școală: o spunem și în text.
export function bilantEducatie(state, ctx) {
  const bl = bilant(state);
  const nivel = state.situatie.nivelStudii;
  const certificate = (ctx.educatie ? [...ctx.educatie.cursuri.values()] : []).filter((c) => state.flaguri[c.flag]).length;
  if (nivel === 'liceu' && !certificate && !bl.costEducatieAzi) return null;
  const referinta = cfg(ctx, bal(ctx, 'educatie.salariuReferintaLiceu')) * 100;
  const peste = bl.luniCIM ? bl.sumaBrutRealCIM - bl.luniCIM * referinta : 0;
  return { cost: Math.round(bl.costEducatieAzi ?? 0), castigSalarii: Math.round(peste), nivel, certificate, aniMunca: Math.floor((bl.luniCIM ?? 0) / 12) };
}
