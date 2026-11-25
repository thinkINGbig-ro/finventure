// Încărcarea conținutului JSON + validarea schemei. Fiecare greșeală devine o eroare clară
// { fisier, id, camp, mesaj }. Evenimentele invalide NU intră în joc, iar erorile se afișează
// (consolă acum, banner în UI din Faza B), ca o greșeală de scriere să nu treacă neobservată.

import { dupaCale } from './util.js';
import { CLASE_INVESTITII, TIPURI_PRODUSE } from './finance.js';
import { SURSE_STARE } from './events.js';
import { CONDITII_FINAL } from './finaluri.js';
import { ACTIUNI_FAMILIE } from './familie.js';

const FISIERE = {
  config: 'data/config.json',
  balans: 'data/balans.json',
  joburi: 'data/jobs.json',
  concepte: 'data/concepts.json',
  indexEvenimente: 'data/events/index.json',
  finaluri: 'data/endings.json',
  activitati: 'data/activitati.json',
  educatie: 'data/educatie.json',
  investitii: 'data/investitii.json',
  afaceri: 'data/afaceri.json',
  cumparaturi: 'data/cumparaturi.json',
  scenarii: 'data/scenarii.json',
};

// citeste(cale) -> Promise<string>; cale relativă la rădăcina proiectului
export async function incarcaContinut(citeste) {
  const erori = [];
  const avertismente = [];
  // Fișierele se cer toate deodată (pe o rețea mobilă, fiecare cerere înseamnă o latență întreagă);
  // se prelucrează apoi în ordinea fixă de mai jos, ca erorile să apară mereu în aceeași ordine.
  const cereri = new Map();
  const cere = (fisier) => {
    if (!cereri.has(fisier)) {
      cereri.set(fisier, Promise.resolve().then(() => citeste(fisier)).then((text) => ({ text }), (eroare) => ({ eroare })));
    }
    return cereri.get(fisier);
  };
  const citesteJson = async (fisier) => {
    const { text, eroare } = await cere(fisier);
    if (eroare) {
      erori.push({ fisier, mesaj: `nu pot citi fișierul (${eroare.message})` });
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      erori.push({ fisier, mesaj: `JSON invalid: ${e.message}` });
      return null;
    }
  };

  Object.values(FISIERE).forEach(cere);
  const config = (await citesteJson(FISIERE.config)) ?? {};
  const balans = (await citesteJson(FISIERE.balans)) ?? {};
  const joburiJson = (await citesteJson(FISIERE.joburi)) ?? { joburi: [] };
  const concepteJson = (await citesteJson(FISIERE.concepte)) ?? { concepte: [] };
  const index = (await citesteJson(FISIERE.indexEvenimente)) ?? { fisiere: [] };
  const finaluriJson = (await citesteJson(FISIERE.finaluri)) ?? { finaluri: [] };
  const activitatiJson = (await citesteJson(FISIERE.activitati)) ?? { activitati: [] };
  const educatieJson = (await citesteJson(FISIERE.educatie)) ?? { programe: [], cursuri: [] };
  const investitiiJson = (await citesteJson(FISIERE.investitii)) ?? { clase: [], companii: [], strategii: [] };
  const afaceriJson = (await citesteJson(FISIERE.afaceri)) ?? { domenii: [], forme: [] };
  const cumparaturiJson = (await citesteJson(FISIERE.cumparaturi)) ?? { categorii: [], bunuri: [] };
  const scenariiJson = (await citesteJson(FISIERE.scenarii)) ?? { scenarii: [] };

  const brute = [];
  (index.fisiere ?? []).forEach((nume) => cere(`data/events/${nume}`));
  for (const nume of index.fisiere ?? []) {
    const fisier = `data/events/${nume}`;
    const json = await citesteJson(fisier);
    if (!json) continue;
    if (!Array.isArray(json.evenimente)) {
      erori.push({ fisier, camp: 'evenimente', mesaj: 'fișierul trebuie să aibă forma { "evenimente": [ ... ] }' });
      continue;
    }
    json.evenimente.forEach((ev, i) => brute.push({ ev, fisier, pozitie: i }));
  }

  const rezultat = construiesteContinut({ config, balans, joburiJson, concepteJson, brute, finaluriJson, activitatiJson, educatieJson, investitiiJson, afaceriJson, cumparaturiJson, scenariiJson }, erori, avertismente);
  return { ...rezultat, erori, avertismente };
}

export function construiesteContinut({
  config, balans, joburiJson, concepteJson, brute, finaluriJson = { finaluri: [] }, activitatiJson = { activitati: [] }, educatieJson = { programe: [], cursuri: [] },
  investitiiJson = { clase: [], companii: [], strategii: [] }, afaceriJson = { domenii: [], forme: [] }, cumparaturiJson = { categorii: [], bunuri: [] }, scenariiJson = { scenarii: [] },
}, erori = [], avertismente = []) {
  valideazaConfig(config, FISIERE.config, erori);

  const joburi = new Map();
  for (const j of joburiJson.joburi ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.joburi, id: j.id, camp, mesaj });
    if (typeof j.id !== 'string') { err('id', 'lipsește id-ul'); continue; }
    if (joburi.has(j.id)) err('id', 'id duplicat');
    if (typeof dupaCale(config, j.salariu ?? '') !== 'number') err('salariu', `„${j.salariu}” nu există în config.json`);
    if (!['part-time', 'full-time'].includes(j.program)) err('program', 'trebuie să fie „part-time” sau „full-time”');
    campuriNecunoscute(j.cerinte ?? {}, ['studiiMin', 'skillMin', 'flagInLocDeStudii', 'flagNecesar', 'faraCazier'], 'cerinte', err);
    if (j.cerinte?.studiiMin && balans?.cariera?.nivelStudii?.[j.cerinte.studiiMin] === undefined) err('cerinte.studiiMin', `nivel necunoscut „${j.cerinte.studiiMin}”`);
    for (const k of ['flagInLocDeStudii', 'flagNecesar']) if (j.cerinte?.[k] !== undefined && !RE_FLAG_NUME.test(j.cerinte[k])) err(`cerinte.${k}`, 'nume de flag invalid');
    if (j.venitVariabil !== undefined) {
      campuriNecunoscute(j.venitVariabil, ['volatilitate', 'sansaComandaMare', 'multiplicatorComandaMare', 'lunaVarf'], 'venitVariabil', err);
      for (const k of ['volatilitate', 'sansaComandaMare', 'multiplicatorComandaMare']) if (typeof j.venitVariabil[k] !== 'number') err(`venitVariabil.${k}`, 'trebuie să fie număr');
    }
    joburi.set(j.id, j);
  }
  // Joburile secundare (side hustle): venit lunar din config, oboseală, cerințe.
  const secundare = new Map();
  for (const s of joburiJson.secundare ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.joburi, id: s.id, camp, mesaj });
    campuriNecunoscute(s, ['id', 'titlu', 'emoji', 'venit', 'energieLunara', 'descriere', 'cerinte', 'variabil'], '', err);
    if (typeof dupaCale(config, s.venit ?? '') !== 'number') err('venit', `„${s.venit}” nu există în config.json`);
    if (typeof s.energieLunara !== 'number') err('energieLunara', 'trebuie să fie număr');
    campuriNecunoscute(s.cerinte ?? {}, ['skillMin', 'flagNecesar'], 'cerinte', err);
    if (secundare.has(s.id)) err('id', 'id duplicat');
    secundare.set(s.id, s);
  }

  const concepte = new Map();
  for (const c of concepteJson.concepte ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.concepte, id: c.id, camp, mesaj });
    if (typeof c.id !== 'string') { err('id', 'lipsește id-ul'); continue; }
    if (concepte.has(c.id)) err('id', 'id duplicat');
    if (typeof c.titlu !== 'string' || typeof c.text !== 'string') err('titlu/text', 'conceptul are nevoie de „titlu” și „text”');
    concepte.set(c.id, c);
  }

  const cumparaturi = construiesteCumparaturi(cumparaturiJson, config, erori);
  const ctxValidare = { config, balans, joburi, concepte, ids: new Set(), referinte: [] };
  const evenimente = new Map();
  for (const { ev, fisier, pozitie } of brute) {
    const id = typeof ev?.id === 'string' ? ev.id : `#${pozitie}`;
    const eroriEv = [];
    const err = (camp, mesaj) => eroriEv.push({ fisier, id, camp, mesaj });
    const warn = (camp, mesaj) => avertismente.push({ fisier, id, camp, mesaj });
    if (evenimente.has(id) || ctxValidare.ids.has(id)) err('id', 'id duplicat (există deja un eveniment cu acest id)');
    ctxValidare.ids.add(id);
    valideazaEveniment(ev, err, warn, ctxValidare, fisier);
    if (eroriEv.length) erori.push(...eroriEv);
    else evenimente.set(id, ev);
  }

  // Referințe între fișiere: se verifică după ce avem toate id-urile.
  for (const ref of ctxValidare.referinte) {
    if (ref.tip === 'eveniment' && !ctxValidare.ids.has(ref.valoare)) {
      erori.push({ ...ref.unde, mesaj: `evenimentul „${ref.valoare}” nu există` });
      evenimente.delete(ref.unde.id);
    }
    if (ref.tip === 'bun' && !cumparaturi.bunuri.has(ref.valoare)) {
      erori.push({ ...ref.unde, mesaj: `produsul „${ref.valoare}” nu există în data/cumparaturi.json` });
      evenimente.delete(ref.unde.id);
    }
  }
  const start = balans?.start?.evenimentStart;
  if (start && !evenimente.has(start)) erori.push({ fisier: FISIERE.balans, camp: 'start.evenimentStart', mesaj: `evenimentul de start „${start}” lipsește sau e invalid` });

  const finaluri = new Map();
  for (const f of finaluriJson.finaluri ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.finaluri, id: f.id, camp, mesaj });
    if (typeof f.id !== 'string') { err('id', 'lipsește id-ul'); continue; }
    if (finaluri.has(f.id)) err('id', 'id duplicat');
    for (const c of ['titlu', 'descriere', 'emoji']) if (typeof f[c] !== 'string') err(c, 'trebuie să fie text');
    if (typeof f.prioritate !== 'number') err('prioritate', 'trebuie să fie un număr');
    campuriNecunoscute(f.conditii ?? {}, CONDITII_FINAL, 'conditii', err);
    if (!Array.isArray(f.conditii?.motiv)) err('conditii.motiv', 'listă de motive (ex. ["pensie"])');
    finaluri.set(f.id, f);
  }

  const activitati = new Map();
  for (const a of activitatiJson.activitati ?? []) {
    const id = typeof a?.id === 'string' ? a.id : '?';
    const eroriA = [];
    const err = (camp, mesaj) => eroriA.push({ fisier: FISIERE.activitati, id, camp, mesaj });
    const warn = (camp, mesaj) => avertismente.push({ fisier: FISIERE.activitati, id, camp, mesaj });
    if (activitati.has(id)) err('id', 'id duplicat');
    const cvA = { ...ctxValidare, referinte: [] };
    valideazaActivitate(a, err, warn, cvA, FISIERE.activitati);
    for (const ref of cvA.referinte) if (!evenimente.has(ref.valoare)) err(ref.unde.camp, `evenimentul „${ref.valoare}” nu există`);
    if (eroriA.length) erori.push(...eroriA);
    else activitati.set(id, a);
  }

  const educatie = construiesteEducatie(educatieJson, { ...ctxValidare, referinte: [] }, erori, avertismente);

  const investitii = construiesteInvestitii(investitiiJson, erori);

  const afaceri = construiesteAfaceri(afaceriJson, config, erori);

  const scenarii = construiesteScenarii(scenariiJson, config, concepte, erori);

  return { ctx: { config, balans, joburi, secundare, concepte, evenimente, finaluri, activitati, educatie, investitii, afaceri, cumparaturi, scenarii } };
}

// ---------- Scenariile de start ----------

const CAMPURI_SCENARIU = ['id', 'titlu', 'emoji', 'descriere', 'datorie', 'flaguri', 'imobil', 'efecte', 'jurnal', 'concepte'];

function construiesteScenarii(json, config, concepte, erori) {
  const scenarii = new Map();
  for (const s of json.scenarii ?? []) {
    const id = typeof s?.id === 'string' ? s.id : '?';
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.scenarii, id, camp, mesaj });
    campuriNecunoscute(s, CAMPURI_SCENARIU, '', err);
    if (scenarii.has(id)) err('id', 'id duplicat');
    for (const c of ['titlu', 'emoji', 'descriere', 'jurnal']) if (typeof s[c] !== 'string' || !s[c].trim()) err(c, 'trebuie să fie text');
    if (s.datorie) {
      campuriNecunoscute(s.datorie, ['suma', 'dae', 'luni'], 'datorie', err);
      if (typeof s.datorie.suma !== 'number' || !Number.isInteger(s.datorie.luni)) err('datorie', 'suma (lei) și luni (întreg)');
      const dae = s.datorie.dae;
      if (!(typeof dae === 'number' || (typeof dae === 'string' && dae.startsWith('config:') && typeof dupaCale(config, dae.slice(7)) === 'number'))) err('datorie.dae', 'număr sau „config:…” existent');
    }
    if (s.imobil !== undefined && !['garsoniera', 'apartament'].includes(s.imobil)) err('imobil', 'garsoniera sau apartament');
    for (const k of Object.keys(s.efecte ?? {})) if (!CAMPURI_EFECTE.includes(k) || k === 'numerar') err(`efecte.${k}`, 'statistică necunoscută');
    for (const c of s.concepte ?? []) if (!concepte.has(c)) err('concepte', `conceptul „${c}” nu există`);
    scenarii.set(id, s);
  }
  if (!scenarii.has('obisnuit')) erori.push({ fisier: FISIERE.scenarii, mesaj: 'lipsește scenariul „obisnuit”' });
  return scenarii;
}

// ---------- Cumpărături (catalog) ----------

function construiesteCumparaturi(json, config, erori) {
  const fisier = FISIERE.cumparaturi;
  const categorii = new Map((json.categorii ?? []).map((c) => [c.id, c]));
  const bunuri = new Map();
  for (const b of json.bunuri ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier, id: b?.id, camp, mesaj });
    campuriNecunoscute(b, ['id', 'categorie', 'titlu', 'emoji', 'calitate', 'pret', 'depreciere', 'fericire', 'fericireLunara', 'energie', 'retea', 'skill',
      'costLunar', 'vandabil', 'consumabil', 'rate', 'bnpl', 'flag'], '', err);
    if (!categorii.has(b.categorie)) err('categorie', `categorie necunoscută „${b.categorie}”`);
    for (const k of ['pret', 'costLunar']) if (b[k] !== undefined && typeof dupaCale(config, b[k]) !== 'number') err(k, `„${b[k]}” nu există în config.json`);
    if (!(b.depreciere >= 0 && b.depreciere <= 1)) err('depreciere', 'fracție anuală între 0 și 1');
    if (!['buget', 'mediu', 'premium'].includes(b.calitate)) err('calitate', 'buget, mediu sau premium');
    if (b.flag !== undefined && !RE_FLAG_NUME.test(b.flag)) err('flag', 'nume de flag invalid');
    if (bunuri.has(b.id)) err('id', 'id duplicat');
    bunuri.set(b.id, b);
  }
  return { categorii, bunuri };
}

// ---------- Afaceri (domenii + forme juridice) ----------

function construiesteAfaceri(json, config, erori) {
  const fisier = FISIERE.afaceri;
  const domenii = new Map();
  const forme = new Map();
  for (const d of json.domenii ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier, id: d?.id, camp, mesaj });
    campuriNecunoscute(d, ['id', 'titlu', 'emoji', 'descriere', 'costVariabil', 'angajatiMinim', 'salariuAngajat', 'luniMaturitate', 'sezon', 'experienta', 'incasareLuni', 'stocLuni'], '', err);
    for (const k of ['incasareLuni', 'stocLuni']) if (d[k] !== undefined && !(Number.isInteger(d[k]) && d[k] >= 0 && d[k] <= 3)) err(k, 'număr întreg între 0 și 3');
    for (const k of ['investitie', 'costuriFixe', 'venitPotential']) if (typeof dupaCale(config, `afaceri.${d.id}.${k}`) !== 'number') err(k, `lipsește config.afaceri.${d.id}.${k}`);
    if (typeof dupaCale(config, d.salariuAngajat ?? '') !== 'number') err('salariuAngajat', `„${d.salariuAngajat}” nu există în config.json`);
    if (!(d.costVariabil >= 0 && d.costVariabil < 1)) err('costVariabil', 'fracție între 0 și 1');
    if (!Number.isInteger(d.angajatiMinim) || d.angajatiMinim < 0) err('angajatiMinim', 'număr întreg ≥ 0');
    if (!(Number.isInteger(d.luniMaturitate) && d.luniMaturitate > 0)) err('luniMaturitate', 'număr întreg > 0');
    if (!Array.isArray(d.sezon) || d.sezon.length !== 12 || d.sezon.some((x) => typeof x !== 'number')) err('sezon', '12 numere, de la septembrie la august');
    if (!Array.isArray(d.experienta)) err('experienta', 'listă de domenii de job (poate fi goală)');
    domenii.set(d.id, d);
  }
  for (const f of json.forme ?? []) forme.set(f.id, f);
  for (const id of ['pfa', 'ii', 'srl']) if (!forme.has(id)) erori.push({ fisier, camp: 'forme', mesaj: `lipsește forma juridică „${id}”` });
  return { domenii, forme };
}

// ---------- Investiții (clase, companii inventate, strategii de rebalansare) ----------

function construiesteInvestitii(json, erori) {
  const fisier = FISIERE.investitii;
  const clase = new Map();
  const companii = new Map();
  const strategii = new Map();
  const text = (x, campuri, err) => { for (const c of campuri) if (typeof x[c] !== 'string' || !x[c].trim()) err(c, 'trebuie să fie text'); };
  for (const c of json.clase ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier, id: c?.id, camp, mesaj });
    campuriNecunoscute(c, ['id', 'titlu', 'emoji', 'risc', 'descriere'], '', err);
    if (!CLASE_INVESTITII.includes(c.id)) err('id', `clasă necunoscută; permise: ${CLASE_INVESTITII.join(', ')}`);
    text(c, ['titlu', 'emoji', 'risc', 'descriere'], err);
    clase.set(c.id, c);
  }
  for (const c of json.companii ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier, id: c?.id, camp, mesaj });
    campuriNecunoscute(c, ['id', 'titlu', 'emoji', 'sector', 'descriere', 'beta', 'alfa', 'volatilitate', 'riscFalimentAnual'], '', err);
    if (typeof c.id !== 'string' || !/^co-[a-z0-9-]+$/.test(c.id)) err('id', 'id-ul unei companii începe cu „co-” (ex. „co-voltara”)');
    text(c, ['titlu', 'emoji', 'sector', 'descriere'], err);
    for (const k of ['beta', 'alfa', 'volatilitate', 'riscFalimentAnual']) if (typeof c[k] !== 'number') err(k, 'trebuie să fie număr');
    if (!(c.riscFalimentAnual >= 0 && c.riscFalimentAnual < 1)) err('riscFalimentAnual', 'între 0 și 1');
    if (companii.has(c.id)) err('id', 'id duplicat');
    companii.set(c.id, c);
  }
  for (const s of json.strategii ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier, id: s?.id, camp, mesaj });
    campuriNecunoscute(s, ['id', 'titlu', 'descriere', 'alocare'], '', err);
    text(s, ['titlu', 'descriere'], err);
    const alocare = Object.entries(s.alocare ?? {});
    for (const [k] of alocare) if (!CLASE_INVESTITII.includes(k)) err(`alocare.${k}`, 'clasă necunoscută');
    const suma = alocare.reduce((t, [, v]) => t + v, 0);
    if (Math.abs(suma - 1) > 0.001) err('alocare', `procentele trebuie să facă 1 (acum ${suma})`);
    strategii.set(s.id, s);
  }
  return { clase, companii, strategii };
}

// ---------- Educație (programe lungi + cursuri scurte) ----------

const CAMPURI_PROGRAM = ['id', 'titlu', 'emoji', 'descriere', 'conditii', 'bursaMerit', 'creditStudii', 'lectie', 'concepte'];
const CAMPURI_CURS = ['id', 'titlu', 'emoji', 'descriere', 'pret', 'luni', 'timp', 'energieLunara', 'skillLaFinal', 'flag', 'stergeFlag', 'conditii', 'lectie', 'concepte'];

function construiesteEducatie(json, cv, erori, avertismente) {
  const fisier = FISIERE.educatie;
  const programe = new Map();
  const cursuri = new Map();
  const comun = (x, campuri, err) => {
    campuriNecunoscute(x, campuri, '', err);
    if (typeof x.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(x.id)) err('id', 'id invalid');
    for (const c of ['titlu', 'descriere', 'emoji']) if (typeof x[c] !== 'string' || !x[c].trim()) err(c, 'trebuie să fie text');
    valideazaConditii(x.conditii, 'conditii', err, cv, new Set());
    verificaText(x.lectie, 'lectie', err, new Set());
    (x.concepte ?? []).forEach((k) => { if (!cv.concepte.has(k)) err('concepte', `conceptul „${k}” nu există`); });
  };
  for (const p of json.programe ?? []) {
    const eroriP = [];
    const err = (camp, mesaj) => eroriP.push({ fisier, id: p?.id, camp, mesaj });
    comun(p, CAMPURI_PROGRAM, err);
    if (typeof dupaCale(cv.config, `studii.${p.id}.durataLuni`) !== 'number') err('id', `lipsește config.studii.${p.id} (taxaAnuala, durataLuni)`);
    if (!cv.balans?.studii?.[p.id]) err('id', `lipsește balans.studii.${p.id} (nivel, skillLaFinal)`);
    if (programe.has(p.id)) err('id', 'id duplicat');
    if (eroriP.length) erori.push(...eroriP); else programe.set(p.id, p);
  }
  for (const c of json.cursuri ?? []) {
    const eroriC = [];
    const err = (camp, mesaj) => eroriC.push({ fisier, id: c?.id, camp, mesaj });
    comun(c, CAMPURI_CURS, err);
    if (typeof c.pret !== 'string' || typeof dupaCale(cv.config, c.pret.replace(/^pret:/, '')) !== 'number') err('pret', '„pret:cale_din_config”, ex. „pret:cursuri.engleza”');
    if (!(Number.isInteger(c.luni) && c.luni > 0)) err('luni', 'număr întreg de luni > 0');
    for (const k of ['timp', 'energieLunara', 'skillLaFinal']) if (c[k] !== undefined && typeof c[k] !== 'number') err(k, 'trebuie să fie număr');
    if (typeof c.flag !== 'string' || !RE_FLAG_NUME.test(c.flag)) err('flag', 'flag-ul certificatului (litere mici, cifre, _)');
    if (cursuri.has(c.id)) err('id', 'id duplicat');
    if (eroriC.length) erori.push(...eroriC); else cursuri.set(c.id, c);
  }
  return { programe, cursuri };
}

export function formateazaEroare(e) {
  return [e.fisier, e.id, e.camp].filter(Boolean).join(' › ') + `: ${e.mesaj}`;
}

// ---------- Config ----------

function valideazaConfig(nod, fisier, erori, cale = '') {
  if (nod == null || typeof nod !== 'object') return;
  if ('valoare' in nod) {
    if (typeof nod.deVerificat !== 'boolean') erori.push({ fisier, camp: cale, mesaj: 'lipsește „deVerificat” (true/false)' });
    if (typeof nod.sursa !== 'string') erori.push({ fisier, camp: cale, mesaj: 'lipsește „sursa” (text, poate fi gol)' });
    return;
  }
  for (const [k, v] of Object.entries(nod)) {
    if (k.startsWith('_')) continue;
    const c = cale ? `${cale}.${k}` : k;
    if (typeof v === 'number') erori.push({ fisier, camp: c, mesaj: 'valoare fără { "valoare", "deVerificat", "sursa" }' });
    else valideazaConfig(v, fisier, erori, c);
  }
}

// ---------- Evenimente ----------

const CAMPURI_EVENIMENT = ['id', 'titlu', 'faza', 'conditii', 'pondere', 'cooldownLuni', 'maxAparitii', 'doarUrmare', 'checkpoint', 'text', 'variabile', 'oferte', 'alegeri'];
const CAMPURI_EFECT_REZULTAT = ['efecte', 'sursaPlata', 'flaguri', 'stergeFlaguri', 'produsNou', 'lichideaza', 'ramburseaza',
  'seteazaProdus', 'transferaInCont', 'job', 'situatie', 'recurente', 'urmari', 'lectie', 'concepte', 'jurnal',
  'acceptaOferta', 'negociazaOferta', 'cereMarire', 'promovare', 'stilViata', 'etichete', 'retrageEconomii', 'retragere', 'afacere', 'bunNou',
  'infractiune', 'pedeapsa', 'familie'];
const CAMPURI_ALEGERE = ['id', 'eticheta', 'cere', 'rezultate', ...CAMPURI_EFECT_REZULTAT];
const CAMPURI_REZULTAT = ['pondere', ...CAMPURI_EFECT_REZULTAT];
const CAMPURI_EFECTE = ['numerar', 'fericire', 'energie', 'viitor', 'skill', 'scorCredit', 'retea', 'reputatie'];
const STATISTICI = ['bani', 'fericire', 'energie', 'viitor'];
const ASCUNSE = ['skill', 'scorCredit', 'retea', 'reputatie'];
const SURSE_PLATA = ['portofel', 'cash', 'cont', 'fondUrgenta', 'cardCredit'];
const CAMPURI_SETABILE = { plata: ['integral', 'minim'], cumparaturiPeCard: 'bool', fondUrgenta: 'bool', reinnoire: 'bool', chirias: 'bool' };
const CAMPURI_PRODUS = {
  contCurent: { pachet: ['standard', 'tineri'] },
  contEconomii: { suma: 'num', fondUrgenta: 'bool', dobandaAnuala: 'num' },
  depozit: { suma: 'num', luni: 'num', dobandaAnuala: 'num', reinnoire: 'bool' },
  cardCredit: { limita: 'num', plata: ['integral', 'minim'], cumparaturiPeCard: 'bool', dobandaAnuala: 'num' },
  credit: { furnizor: 'str', suma: 'num', dae: 'num', luni: 'num', luniFaraDobanda: 'num', laRestanta: 'eveniment', flag: 'str', variabila: 'bool', coDebitor: 'bool' },
  proprietate: { valoare: 'num', marime: ['garsoniera', 'apartament'] },
  imobil: { valoare: 'num', marime: ['garsoniera', 'apartament'] }, // de închiriat sau de vândut (ex. o casă moștenită)
  investitie: { clasa: CLASE_INVESTITII, suma: 'num', luni: 'num' },
};
const PRODUSE_OBLIGATORII = { credit: ['suma', 'luni'], depozit: ['suma'], investitie: ['clasa', 'suma'], proprietate: ['valoare'], imobil: ['valoare', 'marime'] };
const RE_FLAG = /^[a-z0-9_]+(:\d+)?$/;
const RE_FLAG_NUME = /^[a-z0-9_]+$/;
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_STARE = /^stare:([a-zA-Z]+)(?::([a-zA-Z]+(?::[a-zA-Z]+)?))?(?:\*([\d.]+))?$/;

function valideazaEveniment(ev, err, warn, cv, fisier) {
  if (!ev || typeof ev !== 'object') return err('', 'evenimentul trebuie să fie un obiect');
  campuriNecunoscute(ev, CAMPURI_EVENIMENT, '', err);
  if (typeof ev.id !== 'string' || !RE_ID.test(ev.id)) err('id', 'id-ul trebuie să fie text cu litere mici, cifre și cratime (ex. „urgenta-2000”)');
  if (typeof ev.text !== 'string' || !ev.text.trim()) err('text', 'lipsește textul evenimentului');

  if (!ev.doarUrmare) {
    if (!Array.isArray(ev.faza) || !ev.faza.length || ev.faza.some((f) => ![1, 2, 3, 4, 5].includes(f))) {
      err('faza', 'trebuie să fie o listă cu faze între 1 și 5 (ex. [2, 3])');
    }
  } else if (ev.faza !== undefined && !Array.isArray(ev.faza)) err('faza', 'trebuie să fie o listă');
  for (const c of ['pondere', 'cooldownLuni', 'maxAparitii']) {
    if (ev[c] !== undefined && !(typeof ev[c] === 'number' && ev[c] >= 0)) err(c, 'trebuie să fie un număr ≥ 0');
  }
  for (const c of ['doarUrmare', 'checkpoint']) {
    if (ev[c] !== undefined && typeof ev[c] !== 'boolean') err(c, 'trebuie să fie true sau false');
  }

  const vars = valideazaVariabile(ev.variabile, err, cv);
  if (ev.oferte !== undefined && typeof ev.oferte !== 'boolean') err('oferte', 'trebuie să fie true sau false');
  // Cu "oferte": true, motorul generează variabilele {oferta1..3} (text) și {brut1..3} (lei).
  if (ev.oferte) for (let i = 1; i <= 3; i++) vars.add(`oferta${i}`).add(`brut${i}`);

  verificaText(ev.text, 'text', err, vars);
  verificaText(ev.titlu, 'titlu', err, vars);
  valideazaConditii(ev.conditii, 'conditii', err, cv, vars);

  valideazaListaAlegeri(ev.alegeri, 'alegeri', { err, warn, cv, vars, fisier, idEv: ev.id, permiteGrup: true });
}

// „variabile” (la evenimente și activități): număr, „pret:…”, „stare:…”, „config:…”, „balans:…”.
function valideazaVariabile(variabile, err, cv) {
  const vars = new Set(Object.keys(variabile ?? {}));
  for (const [nume, def] of Object.entries(variabile ?? {})) {
    const camp = `variabile.${nume}`;
    if (typeof def === 'number') continue;
    if (typeof def !== 'string') { err(camp, 'trebuie să fie număr sau text („config:…”, „stare:…”)'); continue; }
    if (def.startsWith('text:')) continue; // un text (de obicei suprascris de urmarea care deschide evenimentul)
    if (def.startsWith('pret:')) {
      const [c, f] = def.slice(5).split('*');
      if (typeof dupaCale(cv.config, c) !== 'number' || (f !== undefined && !(Number(f) > 0))) err(camp, `„${def}” nu e valid: „pret:cale_din_config” sau „pret:cale*factor”`);
    } else if (def.startsWith('stare:')) {
      const m = def.match(RE_STARE);
      if (!m || !SURSE_STARE.includes(m[1])) err(camp, `„${def}” nu e validă; surse: ${SURSE_STARE.join(', ')}`);
    } else verificaReferinta(def, camp, err, cv, vars);
  }
  return vars;
}

// ---------- Activități (meniul „Activități”) ----------

export const CATEGORII_ACTIVITATI = ['sanatate', 'social', 'timpLiber', 'dezvoltare'];
const CAMPURI_ACTIVITATE = ['id', 'titlu', 'emoji', 'descriere', 'categorie', 'timp', 'maxPeAn', 'variabile', 'conditii', 'rezultate', ...CAMPURI_EFECT_REZULTAT];

function valideazaActivitate(a, err, warn, cv, fisier) {
  if (!a || typeof a !== 'object') return err('', 'activitatea trebuie să fie un obiect');
  campuriNecunoscute(a, CAMPURI_ACTIVITATE, '', err);
  if (typeof a.id !== 'string' || !RE_ID.test(a.id)) err('id', 'id-ul: litere mici, cifre și cratime');
  for (const c of ['titlu', 'descriere', 'emoji']) if (typeof a[c] !== 'string' || !a[c].trim()) err(c, 'trebuie să fie text');
  if (!CATEGORII_ACTIVITATI.includes(a.categorie)) err('categorie', `una dintre: ${CATEGORII_ACTIVITATI.join(', ')}`);
  for (const c of ['timp', 'maxPeAn']) if (a[c] !== undefined && !(Number.isInteger(a[c]) && a[c] >= (c === 'timp' ? 0 : 1))) err(c, 'trebuie să fie un număr întreg');
  const vars = valideazaVariabile(a.variabile, err, cv);
  verificaText(a.titlu, 'titlu', err, vars);
  verificaText(a.descriere, 'descriere', err, vars);
  valideazaConditii(a.conditii, 'conditii', err, cv, vars);
  // Pe card: doar efecte directe (fără oferte de job, credite sau programarea unui final).
  for (const c of ['acceptaOferta', 'negociazaOferta', 'retragere']) if (a[c] !== undefined) err(c, 'nu se poate folosi la o activitate');
  valideazaRezultat(a, '', err, warn, cv, vars, fisier, a.id);
  if (a.rezultate !== undefined) {
    if (!Array.isArray(a.rezultate) || a.rezultate.length < 2) return err('rezultate', 'trebuie să fie o listă cu cel puțin 2 rezultate');
    a.rezultate.forEach((r, j) => {
      campuriNecunoscute(r, CAMPURI_REZULTAT, `rezultate[${j}]`, err);
      valideazaRezultat(r, `rezultate[${j}]`, err, warn, cv, vars, fisier, a.id);
    });
  }
}

// Max. `alegeriMax` pe ecran, pe fiecare nivel. O alegere cu „subalegeri” e un grup (al doilea pas):
// are doar id, eticheta, cere opțional și subalegeri; efectele stau în subalegeri.
function valideazaListaAlegeri(lista, caleLista, o) {
  const { err, cv } = o;
  const max = cv.balans?.evenimente?.alegeriMax ?? 4;
  const min = 2;
  if (!Array.isArray(lista) || lista.length < min || lista.length > max) {
    return err(caleLista, `trebuie să fie între ${min} și ${max} alegeri (pentru mai multe, grupează-le cu „subalegeri”)`);
  }
  const ids = new Set();
  lista.forEach((a, i) => {
    const cale = `${caleLista}[${i}]${a?.id ? ` (${a.id})` : ''}`;
    if (!a || typeof a !== 'object') return err(cale, 'alegerea trebuie să fie un obiect');
    if (typeof a.id !== 'string' || !/^[a-z0-9-]+$/.test(a.id)) err(`${cale}.id`, 'id-ul alegerii: litere mici, cifre, cratime');
    else if (ids.has(a.id)) err(`${cale}.id`, 'id duplicat pe acest nivel');
    ids.add(a.id);
    if (typeof a.eticheta !== 'string' || !a.eticheta.trim()) err(`${cale}.eticheta`, 'lipsește eticheta (textul butonului)');
    verificaText(a.eticheta, `${cale}.eticheta`, o.err, o.vars);
    valideazaConditii(a.cere, `${cale}.cere`, o.err, cv, o.vars);
    if (a.subalegeri !== undefined) {
      if (!o.permiteGrup) return err(`${cale}.subalegeri`, 'sub-alegerile nu pot avea la rândul lor sub-alegeri');
      campuriNecunoscute(a, ['id', 'eticheta', 'cere', 'subalegeri'], cale, err);
      return valideazaListaAlegeri(a.subalegeri, `${cale}.subalegeri`, { ...o, permiteGrup: false });
    }
    valideazaAlegereFinala(a, cale, o);
  });
}

function valideazaAlegereFinala(a, cale, { err, warn, cv, vars, fisier, idEv }) {
  campuriNecunoscute(a, CAMPURI_ALEGERE, cale, err);
  valideazaRezultat(a, cale, err, warn, cv, vars, fisier, idEv);
  if (a.rezultate === undefined) return;
  if (!Array.isArray(a.rezultate) || a.rezultate.length < 2) return err(`${cale}.rezultate`, 'trebuie să fie o listă cu cel puțin 2 rezultate');
  a.rezultate.forEach((r, j) => {
    const cr = `${cale}.rezultate[${j}]`;
    campuriNecunoscute(r, CAMPURI_REZULTAT, cr, err);
    if (r.pondere !== undefined && !(typeof r.pondere === 'number' && r.pondere > 0)) err(`${cr}.pondere`, 'trebuie să fie un număr > 0');
    valideazaRezultat(r, cr, err, warn, cv, vars, fisier, idEv);
  });
}

function valideazaRezultat(r, cale, err, warn, cv, vars, fisier, idEv) {
  const num = (v, c) => verificaNumar(v, `${cale}.${c}`, err, cv, vars);
  const sel = (v, c) => verificaSelector(v, `${cale}.${c}`, err);

  if (r.efecte !== undefined) {
    campuriNecunoscute(r.efecte, CAMPURI_EFECTE, `${cale}.efecte`, err);
    for (const [k, v] of Object.entries(r.efecte)) num(v, `efecte.${k}`);
  }
  for (const c of ['acceptaOferta', 'negociazaOferta']) {
    if (r[c] !== undefined && ![1, 2, 3].includes(r[c])) err(`${cale}.${c}`, 'trebuie să fie 1, 2 sau 3 (a câta ofertă)');
  }
  if (r.stilViata !== undefined) {
    const ids = (cv.balans?.stilViata?.niveluri ?? []).map((n) => n.id);
    if (!([-2, -1, 1, 2].includes(r.stilViata) || ids.includes(r.stilViata))) err(`${cale}.stilViata`, `+1 / -1 sau un nivel: ${ids.join(', ')}`);
  }
  if (r.etichete !== undefined && (!Array.isArray(r.etichete) || r.etichete.some((e) => typeof e !== 'string'))) err(`${cale}.etichete`, 'listă de etichete text (ex. ["inselatorie"])');
  for (const c of ['cereMarire', 'promovare', 'retragere']) {
    if (r[c] !== undefined && r[c] !== true) err(`${cale}.${c}`, 'trebuie să fie true');
  }
  if (r.sursaPlata !== undefined && !SURSE_PLATA.includes(r.sursaPlata)) err(`${cale}.sursaPlata`, `valori permise: ${SURSE_PLATA.join(', ')}`);
  for (const [c, re, ex] of [['flaguri', RE_FLAG, '„nume” sau „nume:12”'], ['stergeFlaguri', RE_FLAG_NUME, '„nume”']]) {
    if (r[c] === undefined) continue;
    if (!Array.isArray(r[c])) err(`${cale}.${c}`, 'trebuie să fie o listă');
    else r[c].forEach((f) => { if (typeof f !== 'string' || !re.test(f)) err(`${cale}.${c}`, `„${f}” nu e valid; folosește ${ex} (litere mici, cifre, _)`); });
  }
  if (r.produsNou !== undefined) [r.produsNou].flat().forEach((p, i) => valideazaProdusNou(p, `${cale}.produsNou${Array.isArray(r.produsNou) ? `[${i}]` : ''}`, err, cv, vars, fisier, idEv));
  if (r.lichideaza !== undefined) [r.lichideaza].flat().forEach((s) => sel(s, 'lichideaza'));
  if (r.ramburseaza !== undefined) sel(r.ramburseaza, 'ramburseaza');
  if (r.seteazaProdus !== undefined) {
    for (const [s, campuri] of Object.entries(r.seteazaProdus)) {
      sel(s, `seteazaProdus`);
      for (const [k, v] of Object.entries(campuri ?? {})) {
        const tip = CAMPURI_SETABILE[k];
        if (!tip) err(`${cale}.seteazaProdus.${s}`, `câmpul „${k}” nu se poate seta; permise: ${Object.keys(CAMPURI_SETABILE).join(', ')}`);
        else if (tip === 'bool' ? typeof v !== 'boolean' : !tip.includes(v)) err(`${cale}.seteazaProdus.${s}.${k}`, `valoare invalidă „${v}”`);
      }
    }
  }
  if (r.transferaInCont !== undefined && r.transferaInCont !== 'tot') num(r.transferaInCont, 'transferaInCont');
  if (r.retrageEconomii !== undefined) num(r.retrageEconomii, 'retrageEconomii');
  if (r.infractiune !== undefined) {
    campuriNecunoscute(r.infractiune, ['tip', 'castig'], `${cale}.infractiune`, err);
    if (!['furt', 'mule', 'frauda', 'evaziune'].includes(r.infractiune.tip)) err(`${cale}.infractiune.tip`, 'furt, mule, frauda sau evaziune');
    if (r.infractiune.castig !== undefined) num(r.infractiune.castig, 'infractiune.castig');
  }
  if (r.pedeapsa !== undefined && !['recunoaste', 'avocat'].includes(r.pedeapsa)) err(`${cale}.pedeapsa`, 'recunoaste sau avocat');
  for (const a of [r.familie ?? []].flat()) if (!ACTIUNI_FAMILIE.includes(a)) err(`${cale}.familie`, `„${a}”: valori permise: ${ACTIUNI_FAMILIE.join(', ')}`);
  if (r.bunNou !== undefined) {
    if (typeof r.bunNou !== 'string') err(`${cale}.bunNou`, 'id-ul unui produs din data/cumparaturi.json');
    else cv.referinte.push({ tip: 'bun', valoare: r.bunNou, unde: { fisier, id: idEv, camp: `${cale}.bunNou` } });
  }
  if (r.afacere !== undefined) {
    campuriNecunoscute(r.afacere, ['cont', 'reputatie', 'pret'], `${cale}.afacere`, err);
    if (r.afacere.cont !== undefined) [r.afacere.cont].flat().forEach((v) => num(v, 'afacere.cont'));
    if (r.afacere.reputatie !== undefined) num(r.afacere.reputatie, 'afacere.reputatie');
    if (r.afacere.pret !== undefined && !['mic', 'mediu', 'mare'].includes(r.afacere.pret)) err(`${cale}.afacere.pret`, 'mic, mediu sau mare');
  }
  if (r.job !== undefined && r.job !== null) {
    const job = cv.joburi.get(r.job?.id);
    if (!job) err(`${cale}.job.id`, `jobul „${r.job?.id}” nu există în jobs.json`);
    else if (!job.contracte.includes(r.job.contract)) err(`${cale}.job.contract`, `pentru „${job.id}” contractul poate fi: ${job.contracte.join(', ')}`);
  }
  if (r.situatie !== undefined) {
    campuriNecunoscute(r.situatie, ['studii', 'locuinta'], `${cale}.situatie`, err);
    if (r.situatie.studii != null && dupaCale(cv.config, `studii.${r.situatie.studii}`) === undefined) err(`${cale}.situatie.studii`, `„${r.situatie.studii}” nu există în config.studii`);
    if (r.situatie.studii != null && !cv.balans?.studii?.[r.situatie.studii]) err(`${cale}.situatie.studii`, `„${r.situatie.studii}” lipsește din balans.studii`);
    if (r.situatie.locuinta !== undefined && dupaCale(cv.config, `locuinte.${r.situatie.locuinta}`) === undefined) err(`${cale}.situatie.locuinta`, `„${r.situatie.locuinta}” nu există în config.locuinte`);
  }
  if (r.recurente !== undefined) {
    if (!Array.isArray(r.recurente)) err(`${cale}.recurente`, 'trebuie să fie o listă');
    else r.recurente.forEach((x, i) => {
      const c = `${cale}.recurente[${i}]`;
      campuriNecunoscute(x, ['tip', 'suma', 'luni', 'eticheta', 'locuinta', 'destinatie'], c, err);
      if (x.destinatie !== undefined && !(x.destinatie === 'pilon3' && x.tip === 'cheltuiala')) err(`${c}.destinatie`, 'singura destinație posibilă: „pilon3”, la o cheltuială');
      if (x.locuinta !== undefined && dupaCale(cv.config, `locuinte.${x.locuinta}`) === undefined) err(`${c}.locuinta`, `„${x.locuinta}” nu există în config.locuinte`);
      if (!['venit', 'cheltuiala'].includes(x.tip)) err(`${c}.tip`, 'trebuie să fie „venit” sau „cheltuiala”');
      verificaNumar(x.suma, `${c}.suma`, err, cv, vars);
      if (x.luni !== undefined && !(Number.isInteger(x.luni) && x.luni > 0)) err(`${c}.luni`, 'trebuie să fie un număr întreg > 0');
      if (typeof x.eticheta !== 'string') err(`${c}.eticheta`, 'lipsește eticheta');
    });
  }
  if (r.urmari !== undefined) {
    if (!Array.isArray(r.urmari)) err(`${cale}.urmari`, 'trebuie să fie o listă');
    else r.urmari.forEach((u, i) => {
      const c = `${cale}.urmari[${i}]`;
      campuriNecunoscute(u, ['eveniment', 'dupaLuni', 'probabilitate', 'variabile'], c, err);
      cv.referinte.push({ tip: 'eveniment', valoare: u.eveniment, unde: { fisier, id: idEv, camp: `${c}.eveniment` } });
      const d = u.dupaLuni;
      const okD = d === undefined || (Number.isInteger(d) && d >= 0) || (Array.isArray(d) && d.length === 2 && d.every(Number.isInteger) && d[0] <= d[1]);
      if (!okD) err(`${c}.dupaLuni`, 'trebuie să fie un număr de luni sau un interval [min, max]');
      if (u.probabilitate !== undefined && !(u.probabilitate >= 0 && u.probabilitate <= 1)) err(`${c}.probabilitate`, 'trebuie să fie între 0 și 1');
      for (const [k, v] of Object.entries(u.variabile ?? {})) verificaNumar(v, `${c}.variabile.${k}`, err, cv, vars);
    });
  }
  if (r.concepte !== undefined) {
    if (!Array.isArray(r.concepte)) err(`${cale}.concepte`, 'trebuie să fie o listă');
    else r.concepte.forEach((c) => { if (!cv.concepte.has(c)) err(`${cale}.concepte`, `conceptul „${c}” nu există în concepts.json`); });
  }
  for (const c of ['lectie', 'jurnal']) verificaText(r[c], `${cale}.${c}`, err, vars);
  if (typeof r.lectie === 'string') {
    const propozitii = r.lectie.split(/[.!?…]+(\s|$)/).filter((s) => s.trim()).length;
    if (propozitii > 2) warn(`${cale}.lectie`, `lecția are ${propozitii} propoziții; recomandat max. 2`);
  }
}

function valideazaProdusNou(p, cale, err, cv, vars, fisier, idEv) {
  if (!p || typeof p !== 'object') return err(cale, 'trebuie să fie un obiect');
  const campuri = CAMPURI_PRODUS[p.tip];
  if (!campuri) return err(`${cale}.tip`, `tip necunoscut „${p.tip}”; permise: ${Object.keys(CAMPURI_PRODUS).join(', ')}`);
  campuriNecunoscute(p, ['tip', ...Object.keys(campuri)], cale, err);
  for (const c of PRODUSE_OBLIGATORII[p.tip] ?? []) if (p[c] === undefined) err(`${cale}.${c}`, `lipsește (obligatoriu pentru ${p.tip})`);
  if (p.tip === 'credit' && p.dae === undefined && !p.variabila) err(`${cale}.dae`, 'lipsește (obligatoriu, sau „variabila”: true)');
  for (const [k, v] of Object.entries(p)) {
    const tip = campuri[k];
    if (k === 'tip' || !tip) continue;
    if (tip === 'num') verificaNumar(v, `${cale}.${k}`, err, cv, vars);
    else if (tip === 'bool' && typeof v !== 'boolean') err(`${cale}.${k}`, 'trebuie să fie true sau false');
    else if (tip === 'str' && typeof v !== 'string') err(`${cale}.${k}`, 'trebuie să fie text');
    else if (tip === 'eveniment') cv.referinte.push({ tip: 'eveniment', valoare: v, unde: { fisier, id: idEv, camp: `${cale}.${k}` } });
    else if (Array.isArray(tip) && !tip.includes(v)) err(`${cale}.${k}`, `valori permise: ${tip.join(', ')}`);
  }
}

function valideazaConditii(cond, cale, err, cv, vars) {
  if (cond === undefined) return;
  if (!cond || typeof cond !== 'object' || Array.isArray(cond)) return err(cale, 'trebuie să fie un obiect');
  const liste = ['faza', 'flag', 'lipsaFlag', 'areProdus', 'lipsaProdus', 'job', 'studii', 'locuinta'];
  const numerice = ['numerarMin', 'baniMin', 'avereLichidaMin', 'economiiMin', 'fondUrgentaMin', 'depoziteMin', 'cardDisponibilMin'];
  campuriNecunoscute(cond, [...liste, ...numerice, 'varstaMin', 'varstaMax', 'stat', 'ascunse', 'poateRambursa', 'sau', 'motiv',
    'areOferta', 'jobProgram', 'inStudii', 'promovareDisponibila', 'stilViata', 'asigurat', 'indatorare'], cale, err);
  if (cond.indatorare !== undefined) {
    const d = cond.indatorare;
    campuriNecunoscute(d, ['suma', 'luni', 'dae', 'variabila', 'primaLocuinta', 'coDebitor'], `${cale}.indatorare`, err);
    verificaNumar(d.suma, `${cale}.indatorare.suma`, err, cv, vars);
    if (!Number.isInteger(d.luni) || d.luni <= 0) err(`${cale}.indatorare.luni`, 'număr întreg de luni');
    if (d.variabila !== true) verificaNumar(d.dae, `${cale}.indatorare.dae`, err, cv, vars);
  }
  if (cond.stilViata !== undefined && !Array.isArray(cond.stilViata)) err(`${cale}.stilViata`, 'listă de niveluri (ex. ["modest"])');
  if (cond.areOferta !== undefined && ![1, 2, 3].includes(cond.areOferta)) err(`${cale}.areOferta`, 'trebuie să fie 1, 2 sau 3');
  if (cond.jobProgram !== undefined && (!Array.isArray(cond.jobProgram) || cond.jobProgram.some((p) => !['part-time', 'full-time', 'niciunul'].includes(p)))) {
    err(`${cale}.jobProgram`, 'listă cu „part-time”, „full-time” sau „niciunul”');
  }
  for (const c of ['inStudii', 'promovareDisponibila', 'asigurat']) if (cond[c] !== undefined && typeof cond[c] !== 'boolean') err(`${cale}.${c}`, 'trebuie să fie true sau false');
  for (const c of liste) {
    if (cond[c] !== undefined && !Array.isArray(cond[c])) err(`${cale}.${c}`, 'trebuie să fie o listă (ex. ["datorie_ifn"])');
  }
  for (const c of ['flag', 'lipsaFlag']) (Array.isArray(cond[c]) ? cond[c] : []).forEach((f) => { if (!RE_FLAG_NUME.test(f)) err(`${cale}.${c}`, `„${f}” nu e un nume de flag valid`); });
  for (const c of ['areProdus', 'lipsaProdus']) (Array.isArray(cond[c]) ? cond[c] : []).forEach((s) => verificaSelector(s, `${cale}.${c}`, err));
  if (Array.isArray(cond.job)) cond.job.forEach((j) => { if (!cv.joburi.has(j) && j !== 'orice' && j !== 'niciunul') err(`${cale}.job`, `jobul „${j}” nu există`); });
  for (const c of ['varstaMin', 'varstaMax']) if (cond[c] !== undefined && !Number.isInteger(cond[c])) err(`${cale}.${c}`, 'trebuie să fie un număr întreg');
  for (const c of numerice) if (cond[c] !== undefined) verificaNumar(cond[c], `${cale}.${c}`, err, cv, vars);
  for (const [c, permise] of [['stat', STATISTICI], ['ascunse', ASCUNSE]]) {
    if (cond[c] === undefined) continue;
    campuriNecunoscute(cond[c], permise, `${cale}.${c}`, err);
    for (const [k, prag] of Object.entries(cond[c])) {
      campuriNecunoscute(prag, ['min', 'max'], `${cale}.${c}.${k}`, err);
      if (prag?.min === undefined && prag?.max === undefined) err(`${cale}.${c}.${k}`, 'folosește { "min": x } și/sau { "max": y }');
    }
  }
  if (cond.poateRambursa !== undefined) verificaSelector(cond.poateRambursa, `${cale}.poateRambursa`, err);
  if (cond.sau !== undefined) {
    if (!Array.isArray(cond.sau) || cond.sau.length < 2) err(`${cale}.sau`, 'trebuie să fie o listă cu cel puțin 2 variante');
    else cond.sau.forEach((c, i) => valideazaConditii(c, `${cale}.sau[${i}]`, err, cv, vars));
  }
  verificaText(cond.motiv, `${cale}.motiv`, err, vars);
}

// ---------- Verificări mici ----------

function verificaNumar(v, cale, err, cv, vars) {
  if (typeof v === 'number' && Number.isFinite(v)) return;
  if (typeof v !== 'string') return err(cale, 'trebuie să fie un număr, „{variabila}” sau „config:cale”');
  const m = v.match(/^-?\{(\w+)\}$/);
  if (m) {
    if (!vars.has(m[1])) err(cale, `variabila „${m[1]}” nu e definită în „variabile”`);
    return;
  }
  verificaReferinta(v, cale, err, cv, vars);
}

function verificaReferinta(v, cale, err, cv) {
  const [sursa, ...rest] = v.split(':');
  const radacina = sursa === 'config' ? cv.config : sursa === 'balans' ? cv.balans : null;
  if (!radacina) return err(cale, `„${v}” nu e valid; folosește un număr, „{variabila}”, „config:…” sau „balans:…”`);
  if (typeof dupaCale(radacina, rest.join(':')) !== 'number') err(cale, `„${v}” nu există sau nu e număr în ${sursa}.json`);
}

function verificaSelector(s, cale, err) {
  const [tip] = String(s).split(':');
  if (!TIPURI_PRODUSE.includes(tip)) err(cale, `produs necunoscut „${s}”; tipuri: ${TIPURI_PRODUSE.join(', ')} (opțional „tip:detaliu”, ex. „credit:ifn”)`);
}

function verificaText(text, cale, err, vars) {
  if (text === undefined) return;
  if (typeof text !== 'string') return err(cale, 'trebuie să fie text');
  for (const [, nume] of text.matchAll(/\{(\w+)\}/g)) {
    if (!vars.has(nume)) err(cale, `textul folosește „{${nume}}”, dar variabila nu e definită în „variabile”`);
  }
}

function campuriNecunoscute(obj, permise, cale, err) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (permise.includes(k)) continue;
    const sugestie = celMaiApropiat(k, permise);
    err(cale ? `${cale}.${k}` : k, `câmp necunoscut „${k}”${sugestie ? ` (ai vrut „${sugestie}”?)` : ''}`);
  }
}

function celMaiApropiat(cuvant, optiuni) {
  let best = null;
  let dist = Infinity;
  for (const o of optiuni) {
    const d = distanta(cuvant.toLowerCase(), o.toLowerCase());
    if (d < dist) [best, dist] = [o, d];
  }
  return dist <= Math.max(2, Math.floor(cuvant.length / 4)) ? best : null;
}

function distanta(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// Cititor pentru browser: fetch relativ la o bază (ex. „./” din index.html, „../” din tests/).
export function cititorFetch(baza = './') {
  return async (cale) => {
    // „no-cache” = folosește cache-ul doar după ce serverul confirmă că fișierul nu s-a schimbat:
    // după o actualizare de conținut, toată lumea primește JSON-urile noi.
    const r = await fetch(baza + cale, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  };
}
