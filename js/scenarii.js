// Scenariile de start (data/scenarii.json): se aplică o singură dată, la începutul unei vieți noi.

import { cfg, clamp, inBani } from './util.js';
import { creeazaProdus, pret } from './finance.js';
import { seteazaFlag } from './state.js';

const valoare = (ctx, v) => (typeof v === 'string' && v.startsWith('config:') ? cfg(ctx, v.slice(7)) : v);
const VIZIBILE = ['fericire', 'energie', 'viitor'];
const ASCUNSE = ['skill', 'scorCredit', 'retea', 'reputatie'];

export function aplicaScenariu(state, ctx, id) {
  const sc = ctx.scenarii?.get(id);
  if (!sc) return null;
  state.scenariu = sc.id;
  if (sc.datorie) {
    // Banii s-au cheltuit deja: rămâne doar creditul.
    const d = sc.datorie;
    state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'banca', suma: inBani(d.suma * state.indicePreturi), dae: valoare(ctx, d.dae), luni: d.luni }, state, ctx));
  }
  for (const f of sc.flaguri ?? []) seteazaFlag(state, f);
  if (sc.imobil) {
    const v = pret(state, ctx, sc.imobil === 'garsoniera' ? 'locuinte.pretGarsoniera' : 'locuinte.pretApartament');
    const imobil = creeazaProdus({ tip: 'imobil', valoare: v, marime: sc.imobil, creditId: null }, state, ctx);
    imobil.cumparatLa = state.luna;
    imobil.mostenit = true;
    state.produse.push(imobil);
  }
  for (const [k, v] of Object.entries(sc.efecte ?? {})) {
    if (VIZIBILE.includes(k)) state.stat[k] = clamp(state.stat[k] + v, 0, 100);
    else if (ASCUNSE.includes(k)) state.ascunse[k] = clamp(state.ascunse[k] + v, 0, 100);
  }
  for (const c of sc.concepte ?? []) if (!state.concepte.includes(c)) state.concepte.push(c);
  return sc;
}
