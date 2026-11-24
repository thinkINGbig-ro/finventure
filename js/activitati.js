// Activitățile din proprie inițiativă (meniul „Activități”) și bugetul de timp al anului.
// O activitate are aceleași efecte ca o alegere dintr-un eveniment (data/activitati.json),
// plus un cost în timp: fiecare an are un număr limitat de „acțiuni mari” (balans.timp).

import { bal, varstaLa } from './util.js';
import { alegePonderat } from './rng.js';
import { aplicaPachet, motivNeindeplinire, rezolvaVariabile, textCuVariabile } from './events.js';
import { jobCurent } from './cariera.js';
import { actualizeazaDerivate } from './state.js';

// ---------- Bugetul de timp ----------

const anCurent = (state) => Math.floor(state.luna / 12);

export function timpPeAn(state, ctx) {
  const t = bal(ctx, 'timp');
  const program = jobCurent(state, ctx)?.program;
  let n = t.baza;
  if (program === 'full-time') n += t.jobFullTime;
  else if (program === 'part-time') n += t.jobPartTime;
  if (state.situatie.studii) n += t.studii;
  if (state.produse.some((p) => p.tip === 'activitateSecundara')) n += t.jobSecundar;
  return Math.max(t.minim, n);
}

function timpulAnului(state) {
  if (state.timp?.an !== anCurent(state)) state.timp = { an: anCurent(state), folosit: 0, activitati: {} };
  return state.timp;
}

export function timpRamas(state, ctx) {
  const folosit = state.timp?.an === anCurent(state) ? state.timp.folosit : 0;
  return Math.max(0, timpPeAn(state, ctx) - folosit);
}

// null dacă ai timp pentru `n` acțiuni mari, altfel motivul.
export function motivTimp(state, ctx, n = 1) {
  const ramas = timpRamas(state, ctx);
  if (ramas >= n) return null;
  if (ramas === 0) return 'Ți-ai folosit tot timpul anul ăsta. Avansează un an.';
  return `Îți trebuie ${n} acțiuni mari; mai ai ${ramas} anul ăsta.`;
}

export function consumaTimp(state, n = 1, idActivitate = null) {
  const t = timpulAnului(state);
  t.folosit += n;
  if (idActivitate) t.activitati[idActivitate] = (t.activitati[idActivitate] ?? 0) + 1;
}

// ---------- Activități ----------

const NUME_EFECTE = { fericire: 'Fericire', energie: 'Energie', viitor: 'Viitor', skill: 'pregătire', retea: 'relații', reputatie: 'reputație' };

function motivActivitate(act, state, ctx, vars) {
  const timp = act.timp ?? 1;
  const deAnul = state.timp?.an === anCurent(state) ? state.timp.activitati[act.id] ?? 0 : 0;
  if (act.maxPeAn != null && deAnul >= act.maxPeAn) return 'Ai făcut deja asta anul ăsta.';
  return motivNeindeplinire(act.conditii, state, ctx, vars) ?? motivTimp(state, ctx, timp);
}

// Ce afișează meniul: textele finale, costul, efectele pe scurt și dacă se poate face acum.
export function descrieActivitati(state, ctx) {
  return [...(ctx.activitati?.values() ?? [])].map((act) => {
    const vars = rezolvaVariabile(act, state, ctx);
    const motiv = motivActivitate(act, state, ctx, vars);
    return {
      id: act.id,
      titlu: textCuVariabile(act.titlu, vars),
      emoji: act.emoji,
      categorie: act.categorie,
      descriere: textCuVariabile(act.descriere, vars),
      timp: act.timp ?? 1,
      efecte: rezumatEfecte(act),
      disponibil: motiv == null,
      motiv,
    };
  });
}

function rezumatEfecte(act) {
  if (act.rezultate) return 'rezultat incert';
  const e = act.efecte ?? {};
  return Object.entries(NUME_EFECTE).filter(([k]) => e[k]).map(([k, nume]) => `${e[k] > 0 ? '+' : '−'} ${nume}`).join(', ');
}

// Întoarce { ok, mesaj, lectie, concepteNoi } (mesajul = ce s-a întâmplat).
export function faActivitate(state, ctx, id) {
  const act = ctx.activitati?.get(id);
  if (!act) return { ok: false, mesaj: 'Activitatea asta nu mai există.' };
  const vars = rezolvaVariabile(act, state, ctx);
  const motiv = motivActivitate(act, state, ctx, vars);
  if (motiv) return { ok: false, mesaj: motiv };

  let pachet = act;
  if (act.rezultate) {
    const r = alegePonderat(state, 'actiuni', act.rezultate, (x) => x.pondere ?? 1);
    pachet = { ...act, ...r };
  }
  consumaTimp(state, act.timp ?? 1, act.id);
  const rezultat = aplicaPachet(state, ctx, pachet, vars, null);
  actualizeazaDerivate(state, ctx);
  return {
    ok: true,
    mesaj: rezultat.jurnal ?? `Ai făcut: ${textCuVariabile(act.titlu, vars).toLowerCase()}.`,
    lectie: rezultat.lectie,
    concepteNoi: rezultat.concepteNoi,
    varsta: varstaLa(state.luna),
  };
}
