// Simulare automată: multe vieți cu alegeri aleatoare, pentru echilibrare.
// Folosită de tests/simulare.js (Node) și, mai târziu, de modul debug din browser.

import { alege, avanseaza, continua, jocNou } from './engine.js';
import { lantDecizii } from './events.js';
import { hashSeed } from './rng.js';
import { avereNeta } from './state.js';
import { inLei, varstaLa } from './util.js';

// Alegeri „aleatoare” deterministe (LCG separat de RNG-ul jocului). Știe de grupuri (sub-alegeri).
export function strategieAleatoare(seed) {
  let x = hashSeed(`strategie/${seed}`); // seed-uri consecutive -> secvențe necorelate
  const urmator = (n) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return Math.floor((x / 4294967296) * n); // biții de sus: cei de jos ai unui LCG au perioadă scurtă
  };
  return (oprire) => {
    const disp = oprire.alegeri.filter((a) => a.disponibil);
    const a = disp[urmator(disp.length)];
    if (!a.grup) return a.cale;
    const sub = a.subalegeri.filter((s) => s.disponibil);
    return sub[urmator(sub.length)].cale;
  };
}

// O viață întreagă. `laSfarsitDeAn(state)` e opțional (ex. verificări de invarianți în teste).
export function simuleazaViata(ctx, seed, strategie, { aniMax = 60, laSfarsitDeAn } = {}) {
  const state = jocNou(ctx, { seed });
  const alese = [];
  const consuma = (oprire) => {
    while (oprire && oprire.tip !== 'final') {
      if (oprire.tip === 'eveniment') {
        const cale = strategie(oprire);
        alese.push(`${oprire.eveniment} › ${cale}`);
        oprire = alege(state, ctx, cale).oprire;
      } else {
        oprire = continua(state, ctx);
      }
    }
  };
  consuma(avanseaza(state, ctx));
  for (let an = 0; an < aniMax && !state.final; an++) {
    consuma(avanseaza(state, ctx));
    laSfarsitDeAn?.(state);
  }
  return { state, alese };
}

export function simuleazaVieti(ctx, { n = 1000, seed = 'sim', aniMax = 60, laSfarsitDeAn } = {}) {
  const finaluri = {};
  const cauze = {};
  const varste = { toate: [], gameOver: [] };
  const averi = [];
  const aparitii = Object.fromEntries([...ctx.evenimente.keys()].map((id) => [id, 0]));
  const alegeriVazute = new Set();

  for (let i = 0; i < n; i++) {
    const { state, alese } = simuleazaViata(ctx, `${seed}-${i}`, strategieAleatoare(i + 1), { aniMax, laSfarsitDeAn });
    alese.forEach((a) => alegeriVazute.add(a));
    for (const [id, luni] of Object.entries(state.istoricEvenimente)) aparitii[id] += luni.length;

    const motiv = state.final?.motiv ?? 'neterminat';
    finaluri[motiv] = (finaluri[motiv] ?? 0) + 1;
    const varsta = varstaLa(state.final?.luna ?? state.luna);
    varste.toate.push(varsta);
    averi.push(inLei(avereNeta(state)));
    if (motiv !== 'pensie' && motiv !== 'neterminat') {
      varste.gameOver.push(varsta);
      // Cauza = prima decizie din lanțul care a dus la final.
      const lant = state.final.cauza ? lantDecizii(state, state.final.cauza) : [];
      const radacina = lant[0] ? `${lant[0].eveniment} › ${lant[0].alegere}` : 'fără decizie în lanț (ex. venit prea mic)';
      const cheie = `${motiv}: ${radacina}`;
      cauze[cheie] = (cauze[cheie] ?? 0) + 1;
    }
  }

  const toateAlegerile = [];
  for (const ev of ctx.evenimente.values()) {
    for (const a of ev.alegeri) {
      if (a.subalegeri) a.subalegeri.forEach((s) => toateAlegerile.push(`${ev.id} › ${a.id}/${s.id}`));
      else toateAlegerile.push(`${ev.id} › ${a.id}`);
    }
  }

  return {
    n,
    finaluri,
    varstaMedie: medie(varste.toate),
    varstaMedieGameOver: medie(varste.gameOver),
    avereMediana: mediana(averi),
    cauzeGameOver: Object.entries(cauze).sort((a, b) => b[1] - a[1]),
    evenimenteNeaparute: Object.entries(aparitii).filter(([, k]) => k === 0).map(([id]) => id),
    alegeriNealese: toateAlegerile.filter((a) => !alegeriVazute.has(a)),
    aparitii,
  };
}

const medie = (xs) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
function mediana(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
}

const NUME_FINALURI = { pensie: 'pensie (65 de ani)', faliment: 'faliment personal', burnout: 'burnout', renuntare: 'renunțare', neterminat: 'neterminat' };

export function formateazaRaport(r) {
  const pct = (k) => `${((k / r.n) * 100).toFixed(1)}%`;
  const linii = [
    `Simulare: ${r.n} vieți cu alegeri aleatoare`,
    '',
    'Finaluri:',
    ...Object.entries(r.finaluri).sort((a, b) => b[1] - a[1]).map(([m, k]) => `  ${(NUME_FINALURI[m] ?? m).padEnd(22)} ${String(k).padStart(5)}  ${pct(k)}`),
    '',
    `Vârsta medie la final:      ${r.varstaMedie ?? '-'}`,
    `Vârsta medie la game over:  ${r.varstaMedieGameOver ?? '-'}`,
    `Avere netă mediană la final: ${r.avereMediana?.toLocaleString('ro-RO') ?? '-'} lei`,
    '',
    'Cauzele game over-ului (prima decizie din lanț):',
    ...(r.cauzeGameOver.length ? r.cauzeGameOver.slice(0, 15).map(([c, k]) => `  ${String(k).padStart(5)}  ${c}`) : ['  (niciunul)']),
    '',
    `Evenimente care n-au apărut niciodată (${r.evenimenteNeaparute.length}):`,
    ...(r.evenimenteNeaparute.length ? r.evenimenteNeaparute.map((id) => `  ${id}`) : ['  (niciunul)']),
    '',
    `Alegeri care n-au fost alese niciodată (${r.alegeriNealese.length}):`,
    ...(r.alegeriNealese.length ? r.alegeriNealese.map((a) => `  ${a}`) : ['  (niciuna)']),
  ];
  return linii.join('\n');
}
