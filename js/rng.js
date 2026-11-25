// RNG cu seed (mulberry32). Starea fiecărui flux e un singur întreg salvat în
// state.rng, așa că o salvare reluată produce exact aceleași numere.
// Fluxuri separate: „evenimente” (ce se întâmplă), „piete” (randamente, inflație) și „actiuni”
// (rezultatul acțiunilor din meniuri), ca alegerile jucătorului să nu schimbe evoluția pieței
// și nici ce evenimente vin.

export function hashSeed(seed) {
  const s = String(seed);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function creeazaFluxuri(seed) {
  return {
    evenimente: hashSeed(`${seed}/evenimente`),
    piete: hashSeed(`${seed}/piete`),
    actiuni: hashSeed(`${seed}/actiuni`),
    companii: hashSeed(`${seed}/companii`),
  };
}

// Număr în [0, 1)
export function aleator(state, flux) {
  let a = (state.rng[flux] + 0x6d2b79f5) | 0;
  state.rng[flux] = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function intreg(state, flux, min, max) {
  return min + Math.floor(aleator(state, flux) * (max - min + 1));
}

export function sansa(state, flux, probabilitate) {
  if (probabilitate >= 1) return true;
  if (probabilitate <= 0) return false;
  return aleator(state, flux) < probabilitate;
}

// Distribuție normală standard (Box-Muller)
export function normal(state, flux) {
  const u = 1 - aleator(state, flux);
  const v = aleator(state, flux);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function alegePonderat(state, flux, elemente, pondere) {
  const total = elemente.reduce((s, e) => s + pondere(e), 0);
  if (total <= 0) return null;
  let r = aleator(state, flux) * total;
  for (const e of elemente) {
    r -= pondere(e);
    if (r < 0) return e;
  }
  return elemente[elemente.length - 1];
}

export function amesteca(state, flux, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleator(state, flux) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
