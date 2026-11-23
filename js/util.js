// Banii din stare sunt întregi în bani (1 leu = 100 bani), ca să evităm erorile de float.
// JSON-urile de conținut și config-ul folosesc lei.

export const LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

// Anul de joc începe în septembrie: luna absolută 0 = septembrie, la 18 ani.
export const VARSTA_START = 18;
const INDEX_SEPTEMBRIE = 8;

export function numeLuna(lunaAbs) {
  return LUNI[(((lunaAbs % 12) + 12) % 12 + INDEX_SEPTEMBRIE) % 12];
}

export function varstaLa(lunaAbs) {
  return VARSTA_START + Math.max(0, Math.floor(lunaAbs / 12));
}

export const inBani = (lei) => Math.round(lei * 100);
export const inLei = (bani) => bani / 100;

export function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

export function cloneaza(obj) {
  return structuredClone(obj);
}

// Formatare pentru texte: 2000 -> „2.000”, 1234.5 -> „1.234,50”
export function formateazaLei(lei) {
  const intreg = Math.abs(lei - Math.round(lei)) < 0.005;
  return lei.toLocaleString('ro-RO', {
    minimumFractionDigits: intreg ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Valoare din config.json / balans.json; o cheie lipsă e o greșeală de programare,
// deci aruncăm eroare în loc să continuăm cu undefined.
export function cfg(ctx, cale) {
  const v = dupaCale(ctx.config, cale);
  if (v === undefined) throw new Error(`Lipsește din config.json: ${cale}`);
  return v;
}

export function bal(ctx, cale) {
  const v = dupaCale(ctx.balans, cale);
  if (v === undefined) throw new Error(`Lipsește din balans.json: ${cale}`);
  return v;
}

// Citește o valoare dintr-un obiect după cale („ifn.dae”). Dacă nodul e de forma
// { valoare, deVerificat, sursa } (config.json), întoarce doar valoarea.
export function dupaCale(obj, cale) {
  let nod = obj;
  for (const parte of cale.split('.')) {
    if (nod == null || typeof nod !== 'object' || !(parte in nod)) return undefined;
    nod = nod[parte];
  }
  if (nod && typeof nod === 'object' && 'valoare' in nod) return nod.valoare;
  return nod;
}
