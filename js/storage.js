// Stratul de salvare. Restul jocului vorbește doar cu interfața de aici
// (citeste / scrie / sterge), ca mai târziu să putem adăuga un backend online
// fără să atingem jocul. Dacă localStorage e blocat, cădem pe memorie.

// Prefixul cheilor depinde de adresă. Site-ul principal (thinkingbig-ro.github.io/finventure/) păstrează
// „finventure.”, ca salvările jucătorilor să rămână neatinse. Orice altă adresă din browser (preview-ul
// /finventure/preview/, alt repo pe același domeniu, localhost) folosește „finventure-preview.”: toate
// site-urile de pe thinkingbig-ro.github.io au același localStorage, iar un preview cu salvări de altă
// versiune ar strica salvarea de pe site-ul principal. Fără adresă (Node, teste), prefixul principal.
export const PREFIX_PRINCIPAL = 'finventure.';
export const PREFIX_PREVIEW = 'finventure-preview.';
const GAZDA_PRINCIPALA = 'thinkingbig-ro.github.io';

export function prefixPentru(loc = globalThis.location) {
  if (!loc) return PREFIX_PRINCIPAL;
  const gazda = String(loc.hostname ?? '').toLowerCase();
  const cale = String(loc.pathname ?? '').toLowerCase();
  const principal = gazda === GAZDA_PRINCIPALA
    && (cale === '/finventure' || cale.startsWith('/finventure/'))
    && !(cale === '/finventure/preview' || cale.startsWith('/finventure/preview/'));
  return principal ? PREFIX_PRINCIPAL : PREFIX_PREVIEW;
}

const PREFIX_ADRESA = prefixPentru();

export const CHEI = {
  salvare: 'salvare',
  checkpointuri: 'checkpointuri',
  concepte: 'concepte',
  achievements: 'achievements',
  clasament: 'clasament',
};

function backendMemorie() {
  const date = new Map();
  return {
    tip: 'memorie',
    getItem: (k) => (date.has(k) ? date.get(k) : null),
    setItem: (k, v) => date.set(k, String(v)),
    removeItem: (k) => date.delete(k),
  };
}

function backendLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const test = PREFIX_ADRESA + '__test';
    ls.setItem(test, '1');
    ls.removeItem(test);
    return { tip: 'localStorage', getItem: (k) => ls.getItem(k), setItem: (k, v) => ls.setItem(k, v), removeItem: (k) => ls.removeItem(k) };
  } catch {
    return null;
  }
}

export function creeazaStorage(backend = backendLocalStorage() ?? backendMemorie(), prefix = PREFIX_ADRESA) {
  return {
    tip: backend.tip ?? 'custom',
    prefix,
    citeste(cheie, implicit = null) {
      try {
        const brut = backend.getItem(prefix + cheie);
        return brut == null ? implicit : JSON.parse(brut);
      } catch {
        return implicit;
      }
    },
    scrie(cheie, valoare) {
      try {
        backend.setItem(prefix + cheie, JSON.stringify(valoare));
        return true;
      } catch {
        return false; // plin sau blocat: jocul merge mai departe fără salvare
      }
    },
    sterge(cheie) {
      try {
        backend.removeItem(prefix + cheie);
      } catch { /* ignorăm */ }
    },
  };
}

export function creeazaStorageMemorie() {
  return creeazaStorage(backendMemorie());
}
