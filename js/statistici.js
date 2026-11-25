// Statistici anonime pentru proiect: câți oameni joacă și până unde ajung. Merg la serverul Umami al echipei.
// - Doar de pe site-ul principal (nu preview, nu localhost, nu cu ?debug=1) și doar dacă browserul nu cere
//   „Do Not Track” / „Global Privacy Control”.
// - Fără cookie-uri și fără un identificator salvat pe dispozitiv: Umami deosebește vizitatorii după adresa IP
//   și browser, amestecate cu o sare care se schimbă periodic, fără să le păstreze.
// - Nu trimitem numele personajului, sume de bani sau alte date din joc: doar evenimentele de mai jos.
// - O eroare de rețea nu ajunge niciodată la jucător.
import { esteSitePrincipal, CHEI } from './storage.js';
import { varstaLa } from './util.js';

export const SERVER = 'https://mpetrar.go.ro/api/send';
export const SITE = 'fc94ac44-6e69-4c7c-9c98-275c5c2206dc';
// „Până unde au ajuns”: un eveniment la fiecare 5 ani; 65 de ani apare în finalul cu motivul „pensie”.
export const VARSTE_REPER = [20, 25, 30, 35, 40, 45, 50, 55, 60];
// Deciziile-cheie a căror alegere ne interesează pentru proiect.
export const DECIZII_URMARITE = new Set(['dupa-liceu', 'urgenta-2000', 'ifn-alegere', 'prabusire-bursa']);

export function statisticiActive(mediu = globalThis) {
  const loc = mediu.location;
  if (!loc || !esteSitePrincipal(loc)) return false;
  if (new URLSearchParams(loc.search ?? '').get('debug') === '1') return false;
  const nav = mediu.navigator ?? {};
  return !(nav.doNotTrack === '1' || nav.globalPrivacyControl === true);
}

function trimiteFetch(corp) {
  globalThis.fetch?.(SERVER, {
    method: 'POST',
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corp),
  })?.catch(() => {});
}

// storage: cel al jocului; ține minte, pe viață (seed), ultima vârstă-reper trimisă, ca o reîncărcare
// a paginii să nu trimită din nou aceleași vârste.
export function creeazaStatistici({ storage, mediu = globalThis, trimite = trimiteFetch } = {}) {
  const activ = statisticiActive(mediu);

  function eveniment(nume, date) {
    if (!activ) return;
    try {
      const loc = mediu.location;
      const ecran = mediu.screen;
      const payload = {
        website: SITE,
        hostname: loc.hostname,
        url: loc.pathname,
        language: mediu.navigator?.language ?? '',
        screen: ecran ? `${ecran.width}x${ecran.height}` : '',
        title: mediu.document?.title ?? 'Finventure',
        referrer: mediu.document?.referrer ?? '',
      };
      if (nume) Object.assign(payload, { name: nume }, date ? { data: date } : {});
      trimite({ type: 'event', payload });
    } catch { /* statisticile nu opresc jocul */ }
  }

  return {
    activ,
    vizita: () => eveniment(null),
    jocNou(state) {
      storage?.scrie(CHEI.statistici, { seed: state.seed, varsta: 0 });
      eveniment('joc-nou', { scenariu: state.scenariu ?? 'obisnuit' });
    },
    varsta(state) {
      if (!activ || state.final) return;
      const acum = varstaLa(state.luna);
      const salvat = storage?.citeste(CHEI.statistici, null);
      // O salvare de dinainte de statistici: notăm unde e, fără să trimitem vârstele trecute.
      if (salvat?.seed !== state.seed) {
        storage?.scrie(CHEI.statistici, { seed: state.seed, varsta: Math.max(0, ...VARSTE_REPER.filter((v) => v <= acum)) });
        return;
      }
      const noi = VARSTE_REPER.filter((v) => v > salvat.varsta && v <= acum);
      if (!noi.length) return;
      storage?.scrie(CHEI.statistici, { seed: state.seed, varsta: noi.at(-1) });
      noi.forEach((v) => eveniment('varsta', { varsta: v, scenariu: state.scenariu ?? 'obisnuit' }));
    },
    decizie(idEveniment, cale) {
      if (DECIZII_URMARITE.has(idEveniment)) eveniment('decizie', { eveniment: idEveniment, alegere: String(cale) });
    },
    final(state, { motiv, varsta, final }) {
      eveniment('final', { motiv, varsta, final: final ?? 'niciunul', scenariu: state.scenariu ?? 'obisnuit' });
    },
  };
}
