// Cariera: joburi, CV și cele 3 oferte, negocierea salariului, mărirea, promovarea.
// Toate pragurile stau în balans.json (cariera.*), salariile în config.json (salarii.*).

import { bal, clamp, cfg } from './util.js';
import { aleator, alegePonderat, amesteca } from './rng.js';
import { creeazaProdus, pret } from './finance.js';

const R = 'evenimente'; // fluxul RNG folosit (deciziile jucătorului, nu piețele)

export const contractCurent = (state) => state.produse.find((p) => p.tip === 'contractMunca');
export const jobCurent = (state, ctx) => ctx.joburi.get(contractCurent(state)?.jobId);
export const areJobFullTime = (state, ctx) => jobCurent(state, ctx)?.program === 'full-time';

export function nivelStudii(state, ctx) {
  return bal(ctx, 'cariera.nivelStudii')[state.situatie.nivelStudii] ?? 0;
}

function indeplinesteCerinte(job, state, ctx, { skillInPlus = 0 } = {}) {
  const c = job.cerinte ?? {};
  const nivele = bal(ctx, 'cariera.nivelStudii');
  if (c.studiiMin && nivelStudii(state, ctx) < nivele[c.studiiMin]) return false;
  if (c.skillMin && state.ascunse.skill + skillInPlus < c.skillMin) return false;
  return true;
}

// ---------- Schimbarea jobului ----------

// spec: { id, contract, brut? (bani) } sau null pentru demisie
export function schimbaJob(state, ctx, spec, cauza = null) {
  state.produse = state.produse.filter((p) => p.tip !== 'contractMunca');
  if (!spec) return null;
  const job = ctx.joburi.get(spec.id);
  const brut = spec.brut ?? pret(state, ctx, job.salariu);
  const contract = creeazaProdus({ tip: 'contractMunca', jobId: job.id, contract: spec.contract, brut, cauza }, state, ctx);
  state.produse.push(contract);
  return contract;
}

// ---------- CV și oferte ----------

export function scorCV(state, ctx) {
  const cv = bal(ctx, 'cariera.cv');
  let scor = state.ascunse.skill + state.ascunse.reputatie / 2 + (cv.bonusStudii[state.situatie.nivelStudii] ?? 0);
  for (const [flag, bonus] of Object.entries(cv.bonusFlaguri)) {
    const f = state.flaguri[flag];
    if (f && (f.expiraLa == null || state.luna < f.expiraLa)) scor += bonus;
  }
  return Math.round(scor);
}

// Întoarce 0–3 oferte { jobId, titlu, brut (bani), contract, oras, beneficii[], crestere }.
// Un CV mai bun = mai multe oferte și joburi mai bine plătite.
export function genereazaOferte(state, ctx) {
  const b = bal(ctx, 'cariera');
  const scor = scorCV(state, ctx);
  const numar = b.cv.pragOferte.filter((p) => scor >= p).length;
  const umflat = !!state.flaguri.cv_umflat;
  const curent = contractCurent(state)?.jobId;
  const eligibile = [...ctx.joburi.values()].filter((j) => j.inOferte && j.program === 'full-time' && j.id !== curent
    && indeplinesteCerinte(j, state, ctx, { skillInPlus: umflat ? b.cv.skillInPlusDacaUmflat : 0 }));
  if (!eligibile.length || !numar) return [];

  // Ponderi: cu un scor mare, joburile bine plătite devin mult mai probabile.
  const salariu = (j) => cfg(ctx, j.salariu);
  const maxSal = Math.max(...eligibile.map(salariu));
  const pondere = (j) => 1 + Math.pow(salariu(j) / maxSal, 2) * (scor / 25);
  const alese = [];
  const ramase = [...eligibile];
  while (alese.length < numar && ramase.length) {
    const j = alegePonderat(state, R, ramase, pondere);
    ramase.splice(ramase.indexOf(j), 1);
    alese.push(j);
  }

  const o = b.oferte;
  return alese.map((j) => {
    const factor = 1 + (aleator(state, R) * 2 - 1) * o.variatieSalariu + (clamp(scor, 0, 100) / 100) * o.bonusSalariuLaScor100;
    const brut = Math.round((pret(state, ctx, j.salariu) * factor) / 5000) * 5000; // rotunjit la 50 lei
    const contract = j.contracte.includes('pfa') && aleator(state, R) < o.sansaPfa ? 'pfa' : 'cim';
    const beneficii = amesteca(state, R, o.beneficii).slice(0, Math.floor(aleator(state, R) * 3));
    return {
      jobId: j.id, titlu: j.titlu, brut, contract, crestere: j.crestere ?? 'medie',
      oras: o.orase[Math.floor(aleator(state, R) * o.orase.length)], beneficii,
    };
  });
}

export function descriereOferta(o) {
  const lei = (bani) => Math.round(bani / 100).toLocaleString('ro-RO');
  const extra = [o.oras, o.contract === 'pfa' ? 'PFA' : null, ...o.beneficii].filter(Boolean).join(', ');
  return `${o.titlu[0].toUpperCase()}${o.titlu.slice(1)}: ${lei(o.brut)} lei brut · ${extra} · creștere ${o.crestere}`;
}

// ---------- Negociere ----------

function sansa(p, state) {
  return clamp(p.sansaBaza + (state.ascunse.skill - 50) * p.pondereSkill + (state.ascunse.reputatie - 20) * p.pondereReputatie, p.sansaMin, p.sansaMax);
}

// Întoarce { rezultat: 'succes' | 'refuzat' | 'retras', brut }
export function negociaza(state, ctx, oferta) {
  const p = bal(ctx, 'cariera.negociere');
  if (aleator(state, R) < sansa(p, state)) {
    const crestere = p.cresteMin + aleator(state, R) * (p.cresteMax - p.cresteMin);
    return { rezultat: 'succes', brut: Math.round((oferta.brut * (1 + crestere)) / 5000) * 5000 };
  }
  if (aleator(state, R) < p.sansaRetragereLaEsec) return { rezultat: 'retras', brut: 0 };
  return { rezultat: 'refuzat', brut: oferta.brut };
}

// ---------- Mărire ----------

export function sansaMarire(state, ctx) {
  const p = bal(ctx, 'cariera.marire');
  const c = contractCurent(state);
  if (!c) return 0;
  const vechime = Math.min(36, c.luniDeLaMarire ?? 0);
  return clamp(sansa(p, state) + vechime * p.pondereLuniDeLaMarire - 12 * p.pondereLuniDeLaMarire, p.sansaMin, p.sansaMax);
}

// Întoarce { succes, brutVechi, brutNou, text }
export function cereMarire(state, ctx) {
  const p = bal(ctx, 'cariera.marire');
  const c = contractCurent(state);
  if (!c) return { succes: false, text: 'N-ai de la cine să ceri o mărire: n-ai job.' };
  if ((c.luniDeLaMarire ?? 0) < p.luniMinimeIntreMariri) return { succes: false, text: 'Ai cerut o mărire de curând. Mai așteaptă.', preaDevreme: true };
  const brutVechi = c.brut;
  // Peste un anumit nivel față de piață, firma nu mai dă măriri: crești doar prin promovare sau alt job.
  const plafon = pret(state, ctx, ctx.joburi.get(c.jobId).salariu) * p.maxPestePiata;
  if (c.brut >= plafon) {
    c.luniDeLaMarire = 0;
    return { succes: false, brutVechi, brutNou: brutVechi, peste: true, text: 'Ești deja plătit peste piață pentru postul ăsta. Ca să câștigi mai mult: promovare sau alt job.' };
  }
  if (aleator(state, R) < sansaMarire(state, ctx)) {
    const crestere = p.cresteMin + aleator(state, R) * (p.cresteMax - p.cresteMin);
    c.brut = Math.min(Math.round(plafon / 5000) * 5000, Math.round((c.brut * (1 + crestere)) / 5000) * 5000);
    c.luniDeLaMarire = 0;
    state.ascunse.reputatie = clamp(state.ascunse.reputatie + 2, 0, 100);
    return { succes: true, brutVechi, brutNou: c.brut, text: `Ai primit mărirea: de la ${lei(brutVechi)} la ${lei(c.brut)} lei brut.` };
  }
  c.luniDeLaMarire = Math.max(0, (c.luniDeLaMarire ?? 0) - 6); // mai încerci peste câteva luni
  state.stat.fericire = clamp(state.stat.fericire - 3, 0, 100);
  return { succes: false, brutVechi, brutNou: brutVechi, text: 'Ți-au spus „poate la anul”. Salariul rămâne la fel.' };
}

const lei = (bani) => Math.round(bani / 100).toLocaleString('ro-RO');

// ---------- Promovare ----------

export function promovareDisponibila(state, ctx) {
  const c = contractCurent(state);
  const job = c && ctx.joburi.get(c.jobId);
  const urm = job?.urmator && ctx.joburi.get(job.urmator);
  return !!urm && c.contract !== 'negru' && c.luniVechime >= (job.luniPanaLaPromovare ?? 36) && indeplinesteCerinte(urm, state, ctx);
}

export function promoveaza(state, ctx, cauza) {
  const c = contractCurent(state);
  const job = ctx.joburi.get(c.jobId);
  const urm = ctx.joburi.get(job.urmator);
  const brut = Math.max(pret(state, ctx, urm.salariu), Math.round(c.brut * (1 + bal(ctx, 'cariera.promovare.crestereMinima'))));
  const nou = schimbaJob(state, ctx, { id: urm.id, contract: urm.contracte.includes(c.contract) ? c.contract : 'cim', brut }, cauza);
  return { job: urm, brutVechi: c.brut, brutNou: nou.brut, text: `Ai fost promovat: acum ești ${urm.titlu}, cu ${lei(nou.brut)} lei brut.` };
}

