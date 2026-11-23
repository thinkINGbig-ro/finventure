// Stratul de salvare. Restul jocului vorbește doar cu interfața de aici
// (citeste / scrie / sterge), ca mai târziu să putem adăuga un backend online
// fără să atingem jocul. Dacă localStorage e blocat, cădem pe memorie.

const PREFIX = 'finventure.';

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
    const test = PREFIX + '__test';
    ls.setItem(test, '1');
    ls.removeItem(test);
    return { tip: 'localStorage', getItem: (k) => ls.getItem(k), setItem: (k, v) => ls.setItem(k, v), removeItem: (k) => ls.removeItem(k) };
  } catch {
    return null;
  }
}

export function creeazaStorage(backend = backendLocalStorage() ?? backendMemorie()) {
  return {
    tip: backend.tip ?? 'custom',
    citeste(cheie, implicit = null) {
      try {
        const brut = backend.getItem(PREFIX + cheie);
        return brut == null ? implicit : JSON.parse(brut);
      } catch {
        return implicit;
      }
    },
    scrie(cheie, valoare) {
      try {
        backend.setItem(PREFIX + cheie, JSON.stringify(valoare));
        return true;
      } catch {
        return false; // plin sau blocat: jocul merge mai departe fără salvare
      }
    },
    sterge(cheie) {
      try {
        backend.removeItem(PREFIX + cheie);
      } catch { /* ignorăm */ }
    },
  };
}

export function creeazaStorageMemorie() {
  return creeazaStorage(backendMemorie());
}
