// Tiparele de la final: comportamentele de fond care au dus la rezultat.
// „Ce te-a costat” (negative) și „Ce te-a ajutat” (pozitive), fiecare cu cifre,
// „Ce trebuia să faci” / de ce a contat și un concept din enciclopedie.

import { bal } from './util.js';
import { castigInvestitiiAzi, estimeazaPensie } from './bilant.js';

const ani = (luni) => Math.floor(luni / 12);
const lei = (bani) => `${Math.round(bani / 100).toLocaleString('ro-RO')} lei`;
// 1 an / 5 ani / 25 de ani; la fel pentru orice substantiv.
const cuDe = (n) => (n % 100 >= 20 || (n % 100 === 0 && n > 0) ? 'de ' : '');
const numar = (n, singular, plural) => (n === 1 ? `1 ${singular}` : `${n} ${cuDe(n)}${plural}`);
const pluralAni = (n) => numar(n, 'an', 'ani');

// Fiecare tipar: cand(bilant, state, ctx) -> null sau { scor, fapt }.
const NEGATIVE = [
  {
    id: 'stil-peste-venit', titlu: 'Stil peste posibilități', concept: 'stil-de-viata',
    cand: (bl) => bl.aniStilPesteVenit >= 1 && { scor: bl.aniStilPesteVenit * 3, fapt: `${pluralAni(bl.aniStilPesteVenit)} cu stil confortabil sau lux, în care ai cheltuit peste 90% din venit.` },
    ceTrebuia: 'Stilul crește după ce ai fond și economii, nu odată cu salariul. O regulă simplă: din fiecare mărire, cel mult jumătate merge pe cheltuieli.',
  },
  {
    id: 'fara-fond', titlu: 'Fără plasă de siguranță', concept: 'fond-urgenta',
    cand: (bl) => ani(bl.luniFaraFond) >= 2 && { scor: ani(bl.luniFaraFond) * 2, fapt: `${pluralAni(ani(bl.luniFaraFond))} fără un fond de urgență de măcar 3 luni de cheltuieli.` },
    ceTrebuia: 'Pune deoparte automat 10% din salariu, într-un cont separat, până ai 3–6 luni de cheltuieli. Abia apoi investiții sau upgrade-uri.',
  },
  {
    id: 'card-minim', titlu: 'Cardul pe plata minimă', concept: 'plata-minima',
    cand: (bl) => bl.luniCardMinim >= 3 && { scor: Math.min(12, bl.luniCardMinim / 2), fapt: `${numar(bl.luniCardMinim, 'lună', 'luni')} în care ai plătit doar minimul la cardul de credit.` },
    ceTrebuia: 'Cardul de credit e gratuit doar dacă achiți tot extrasul până la scadență. Dacă nu poți, nu-l folosi pentru cumpărături.',
  },
  {
    id: 'cheltuieli-90', titlu: 'Totul se ducea pe cheltuieli', concept: 'buget',
    cand: (bl) => bl.aniCheltuieliPeste90 >= 2 && { scor: bl.aniCheltuieliPeste90 * 2, fapt: `${pluralAni(bl.aniCheltuieliPeste90)} în care cheltuielile au trecut de 90% din venit.` },
    ceTrebuia: 'Un buget 50/30/20: jumătate pentru necesar, 30% pentru dorințe, 20% pus deoparte. Economisirea se face prima, nu cu ce rămâne.',
  },
  {
    id: 'ifn', titlu: 'Credite rapide', concept: 'ifn',
    cand: (bl) => bl.ifnLuate >= 1 && { scor: bl.ifnLuate * 5, fapt: `Ai luat ${numar(bl.ifnLuate, 'credit', 'credite')} de la IFN.${bl.ifnLuate >= 2 ? ' Unul l-a acoperit pe altul.' : ''}` },
    ceTrebuia: 'Un IFN e ultima variantă, nu prima: fond de urgență, ajutor de la cineva apropiat sau un credit bancar costă de câteva ori mai puțin.',
  },
  {
    id: 'restante-ignorate', titlu: 'Somații ignorate', concept: 'restante-facturi',
    cand: (bl) => bl.somatiiIgnorate >= 1 && { scor: bl.somatiiIgnorate * 4, fapt: `Ai ignorat ${numar(bl.somatiiIgnorate, 'somație', 'somații')} de plată.` },
    ceTrebuia: 'Sună creditorul înainte de deconectare sau executare și cere eșalonare. Ignorată, datoria crește cu penalități și ajunge la executor.',
  },
  {
    id: 'la-negru', titlu: 'Muncă la negru', concept: 'cim',
    cand: (bl) => ani(bl.luniNegru) >= 1 && { scor: ani(bl.luniNegru) * 2, fapt: `${pluralAni(ani(bl.luniNegru))} de muncă fără contract: fără vechime, fără pensie.` },
    ceTrebuia: 'Cere contract de muncă. Banii în plus de azi nu compensează pensia, asigurarea medicală și istoricul pe care le pierzi.',
  },
  {
    id: 'fara-asigurare', titlu: 'Fără asigurare medicală', concept: 'asigurare-sanatate',
    cand: (bl) => ani(bl.luniFaraAsigurare) >= 1 && { scor: ani(bl.luniFaraAsigurare) * 1.5, fapt: `${pluralAni(ani(bl.luniFaraAsigurare))} fără asigurare medicală. Orice problemă de sănătate se plătea integral.` },
    ceTrebuia: 'Un contract de muncă sau PFA plătește CASS și îți dă tratament gratuit la stat. Fără el, o boală devine o cheltuială de mii de lei.',
  },
  {
    id: 'vanzare-panica', titlu: 'Ai vândut în panică', concept: 'prabusirea-bursei',
    cand: (bl) => (bl.vanzariPanica ?? 0) >= 1 && { scor: bl.vanzariPanica * 4, fapt: bl.vanzariPanica === 1 ? 'Ai vândut investițiile în panică, în timpul unei prăbușiri a bursei, exact când erau cele mai ieftine.' : `Ai vândut investițiile în panică în ${numar(bl.vanzariPanica, 'prăbușire', 'prăbușiri')} ale bursei, exact când erau cele mai ieftine.` },
    ceTrebuia: 'Când bursa scade, nu face nimic sau cumpără puțin, dacă ai bani de care nu ai nevoie. Pierderea e doar pe hârtie până vinzi.',
  },
  {
    id: 'salariu-inghitit', titlu: 'Salariul înghițit de inflație', concept: 'puterea-de-cumparare',
    cand: (bl) => bl.aniFaraMarire >= 3 && { scor: bl.aniFaraMarire, fapt: `${pluralAni(bl.aniFaraMarire)} fără mărire, în timp ce prețurile creșteau.` },
    ceTrebuia: 'Cere o mărire o dată pe an, cu argumente, sau caută o ofertă mai bună. Un salariu care nu crește e un salariu care scade.',
  },
];

const POZITIVE = [
  {
    id: 'investitii-regulate', titlu: 'Investiții regulate', concept: 'dobanda-compusa',
    cand: (bl, state) => {
      const castig = castigInvestitiiAzi(state);
      return ani(bl.luniInvestitii) >= 5 && castig > 0 && {
        scor: castig / 1e7,
        fapt: `${pluralAni(ani(bl.luniInvestitii))} cu bani investiți. Dobânda compusă ți-a adus ${lei(castig)} peste cât ai pus (în lei de azi).`,
      };
    },
    deCe: 'Timpul a făcut cea mai mare parte din muncă: câștigurile au produs la rândul lor câștiguri.',
  },
  {
    id: 'fond-constant', titlu: 'Fond de urgență constant', concept: 'fond-urgenta',
    cand: (bl) => ani(bl.luniCuFond) >= 5 && {
      scor: ani(bl.luniCuFond) + bl.socuriAbsorbite * 3,
      fapt: `${pluralAni(ani(bl.luniCuFond))} cu fond de urgență. A absorbit ${numar(bl.socuriAbsorbite, 'șoc', 'șocuri')} fără nicio datorie.`,
    },
    deCe: 'Neprevăzutul n-a mai fost o criză: a fost doar o cheltuială.',
  },
  {
    id: 'rabdare-criza', titlu: 'Răbdare în criză', concept: 'prabusirea-bursei',
    cand: (bl) => (bl.crizeTraversate ?? 0) >= 1 && { scor: bl.crizeTraversate * 3, fapt: bl.crizeTraversate === 1 ? 'Ai trecut printr-o prăbușire a bursei fără să vinzi în panică.' : `Ai trecut prin ${numar(bl.crizeTraversate, 'prăbușire', 'prăbușiri')} ale bursei fără să vinzi în panică.` },
    deCe: 'Investițiile și-au revenit pentru că le-ai lăsat timp. Asta nu se poate face decât cu un fond de urgență separat.',
  },
  {
    id: 'negociere', titlu: 'Ai negociat', concept: 'negociere-salariu',
    cand: (bl) => bl.castigNegociereAzi > 0 && { scor: bl.castigNegociereAzi / 5e6, fapt: `Din măriri cerute și oferte negociate ai câștigat în plus ${lei(bl.castigNegociereAzi)} brut (în lei de azi).` },
    deCe: 'Fiecare mărire s-a adunat peste cele de dinainte, an de an.',
  },
  {
    id: 'contract', titlu: 'Contract de muncă', concept: 'pilonii-pensiei',
    cand: (bl, state, ctx) => {
      if (ani(bl.luniCIM) < 10) return null;
      const p = estimeazaPensie(state, ctx);
      return { scor: ani(bl.luniCIM) / 2, fapt: `${pluralAni(p.aniContributie)} de contribuții. Pensia de stat estimată: ${lei(p.pilon1)} pe lună, plus ${lei(p.pilon2)} din Pilonii II și III (în lei de azi).` };
    },
    deCe: 'Contribuțiile de azi sunt venitul tău de mâine. Anii la negru nu se adună aici.',
  },
];

function evalueaza(lista, state, ctx, max) {
  const bl = state.bilant;
  if (!bl) return [];
  return lista
    .map((t) => {
      const r = t.cand(bl, state, ctx);
      return r ? { id: t.id, titlu: t.titlu, concept: t.concept, ceTrebuia: t.ceTrebuia, deCe: t.deCe, ...r } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.scor - a.scor)
    .slice(0, max);
}

export function calculeazaTipare(state, ctx) {
  const max = bal(ctx, 'bilant.tipareMax');
  return { negative: evalueaza(NEGATIVE, state, ctx, max), pozitive: evalueaza(POZITIVE, state, ctx, max) };
}

export const TIPARE_NEGATIVE = NEGATIVE.map((t) => t.id);
export const TIPARE_POZITIVE = POZITIVE.map((t) => t.id);
