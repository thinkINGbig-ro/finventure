// Încărcarea conținutului JSON + validarea schemei. Fiecare greșeală devine o eroare clară
// { fisier, id, camp, mesaj }. Evenimentele invalide NU intră în joc, iar erorile se afișează
// (consolă acum, banner în UI din Faza B), ca o greșeală de scriere să nu treacă neobservată.

import { dupaCale } from './util.js';
import { CLASE_INVESTITII, TIPURI_PRODUSE } from './finance.js';
import { SURSE_STARE } from './events.js';
import { CONDITII_FINAL } from './finaluri.js';

const FISIERE = {
  config: 'data/config.json',
  balans: 'data/balans.json',
  joburi: 'data/jobs.json',
  concepte: 'data/concepts.json',
  indexEvenimente: 'data/events/index.json',
  finaluri: 'data/endings.json',
};

// citeste(cale) -> Promise<string>; cale relativă la rădăcina proiectului
export async function incarcaContinut(citeste) {
  const erori = [];
  const avertismente = [];
  const citesteJson = async (fisier) => {
    let text;
    try {
      text = await citeste(fisier);
    } catch (e) {
      erori.push({ fisier, mesaj: `nu pot citi fișierul (${e.message})` });
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      erori.push({ fisier, mesaj: `JSON invalid: ${e.message}` });
      return null;
    }
  };

  const config = (await citesteJson(FISIERE.config)) ?? {};
  const balans = (await citesteJson(FISIERE.balans)) ?? {};
  const joburiJson = (await citesteJson(FISIERE.joburi)) ?? { joburi: [] };
  const concepteJson = (await citesteJson(FISIERE.concepte)) ?? { concepte: [] };
  const index = (await citesteJson(FISIERE.indexEvenimente)) ?? { fisiere: [] };
  const finaluriJson = (await citesteJson(FISIERE.finaluri)) ?? { finaluri: [] };

  const brute = [];
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

  const rezultat = construiesteContinut({ config, balans, joburiJson, concepteJson, brute, finaluriJson }, erori, avertismente);
  return { ...rezultat, erori, avertismente };
}

export function construiesteContinut({ config, balans, joburiJson, concepteJson, brute, finaluriJson = { finaluri: [] } }, erori = [], avertismente = []) {
  valideazaConfig(config, FISIERE.config, erori);

  const joburi = new Map();
  for (const j of joburiJson.joburi ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.joburi, id: j.id, camp, mesaj });
    if (typeof j.id !== 'string') { err('id', 'lipsește id-ul'); continue; }
    if (joburi.has(j.id)) err('id', 'id duplicat');
    if (typeof dupaCale(config, j.salariu ?? '') !== 'number') err('salariu', `„${j.salariu}” nu există în config.json`);
    if (!['part-time', 'full-time'].includes(j.program)) err('program', 'trebuie să fie „part-time” sau „full-time”');
    joburi.set(j.id, j);
  }

  const concepte = new Map();
  for (const c of concepteJson.concepte ?? []) {
    const err = (camp, mesaj) => erori.push({ fisier: FISIERE.concepte, id: c.id, camp, mesaj });
    if (typeof c.id !== 'string') { err('id', 'lipsește id-ul'); continue; }
    if (concepte.has(c.id)) err('id', 'id duplicat');
    if (typeof c.titlu !== 'string' || typeof c.text !== 'string') err('titlu/text', 'conceptul are nevoie de „titlu” și „text”');
    concepte.set(c.id, c);
  }

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

  return { ctx: { config, balans, joburi, concepte, evenimente, finaluri } };
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
  'acceptaOferta', 'negociazaOferta', 'cereMarire', 'promovare', 'stilViata', 'etichete', 'retrageEconomii', 'retragere'];
const CAMPURI_ALEGERE = ['id', 'eticheta', 'cere', 'rezultate', ...CAMPURI_EFECT_REZULTAT];
const CAMPURI_REZULTAT = ['pondere', ...CAMPURI_EFECT_REZULTAT];
const CAMPURI_EFECTE = ['numerar', 'fericire', 'energie', 'viitor', 'skill', 'scorCredit', 'retea', 'reputatie'];
const STATISTICI = ['bani', 'fericire', 'energie', 'viitor'];
const ASCUNSE = ['skill', 'scorCredit', 'retea', 'reputatie'];
const SURSE_PLATA = ['portofel', 'cash', 'cont', 'fondUrgenta', 'cardCredit'];
const CAMPURI_SETABILE = { plata: ['integral', 'minim'], cumparaturiPeCard: 'bool', fondUrgenta: 'bool', reinnoire: 'bool' };
const CAMPURI_PRODUS = {
  contCurent: { pachet: ['standard', 'tineri'] },
  contEconomii: { suma: 'num', fondUrgenta: 'bool', dobandaAnuala: 'num' },
  depozit: { suma: 'num', luni: 'num', dobandaAnuala: 'num', reinnoire: 'bool' },
  cardCredit: { limita: 'num', plata: ['integral', 'minim'], cumparaturiPeCard: 'bool', dobandaAnuala: 'num' },
  credit: { furnizor: 'str', suma: 'num', dae: 'num', luni: 'num', luniFaraDobanda: 'num', laRestanta: 'eveniment', flag: 'str', variabila: 'bool' },
  proprietate: { valoare: 'num' },
  investitie: { clasa: CLASE_INVESTITII, suma: 'num', luni: 'num' },
};
const PRODUSE_OBLIGATORII = { credit: ['suma', 'luni'], depozit: ['suma'], investitie: ['clasa', 'suma'], proprietate: ['valoare'] };
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

  const vars = new Set(Object.keys(ev.variabile ?? {}));
  if (ev.oferte !== undefined && typeof ev.oferte !== 'boolean') err('oferte', 'trebuie să fie true sau false');
  // Cu "oferte": true, motorul generează variabilele {oferta1..3} (text) și {brut1..3} (lei).
  if (ev.oferte) for (let i = 1; i <= 3; i++) vars.add(`oferta${i}`).add(`brut${i}`);
  for (const [nume, def] of Object.entries(ev.variabile ?? {})) {
    const camp = `variabile.${nume}`;
    if (typeof def === 'number') continue;
    if (typeof def !== 'string') { err(camp, 'trebuie să fie număr sau text („config:…”, „stare:…”)'); continue; }
    if (def.startsWith('pret:')) {
      const [c, f] = def.slice(5).split('*');
      if (typeof dupaCale(cv.config, c) !== 'number' || (f !== undefined && !(Number(f) > 0))) err(camp, `„${def}” nu e valid: „pret:cale_din_config” sau „pret:cale*factor”`);
    } else if (def.startsWith('stare:')) {
      const m = def.match(RE_STARE);
      if (!m || !SURSE_STARE.includes(m[1])) err(camp, `„${def}” nu e validă; surse: ${SURSE_STARE.join(', ')}`);
    } else verificaReferinta(def, camp, err, cv, vars);
  }

  verificaText(ev.text, 'text', err, vars);
  verificaText(ev.titlu, 'titlu', err, vars);
  valideazaConditii(ev.conditii, 'conditii', err, cv, vars);

  valideazaListaAlegeri(ev.alegeri, 'alegeri', { err, warn, cv, vars, fisier, idEv: ev.id, permiteGrup: true });
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
  const numerice = ['numerarMin', 'baniMin', 'economiiMin', 'fondUrgentaMin', 'depoziteMin', 'cardDisponibilMin'];
  campuriNecunoscute(cond, [...liste, ...numerice, 'varstaMin', 'varstaMax', 'stat', 'ascunse', 'poateRambursa', 'sau', 'motiv',
    'areOferta', 'jobProgram', 'inStudii', 'promovareDisponibila', 'stilViata', 'asigurat'], cale, err);
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
    const r = await fetch(baza + cale);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  };
}
