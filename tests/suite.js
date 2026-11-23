// Suita de teste a motorului. Rulează la fel în Node (tests/run.js) și în browser (tests/run.html).

import { construiesteContinut, formateazaEroare, incarcaContinut } from '../js/content.js';
import { actiune, alege, avanseaza, continua, forteazaEveniment, jocNou } from '../js/engine.js';
import { lantDecizii, gasesteProdus, gasesteProduse } from '../js/events.js';
import { fluturas, baniDisponibili, fondUrgenta, pret } from '../js/finance.js';
import {
  adaugaCheckpoint, areFlag, incarcaCheckpoint, incarcaJoc, listaCheckpointuri, salveazaJoc, seteazaFlag,
} from '../js/state.js';
import { creeazaStorageMemorie } from '../js/storage.js';
import { inBani, varstaLa } from '../js/util.js';

class EsecTest extends Error {}
const ok = (cond, mesaj) => { if (!cond) throw new EsecTest(mesaj); };
const egal = (a, b, mesaj) => ok(Object.is(a, b), `${mesaj}: așteptat ${JSON.stringify(b)}, primit ${JSON.stringify(a)}`);

// ---------- Ajutoare ----------

// Strategie: funcție (oprire) -> id alegere. Implicit: prima alegere disponibilă.
const primaDisponibila = (o) => o.alegeri.find((a) => a.disponibil).id;

function strategieDin(harta, rezerva = primaDisponibila) {
  return (o) => {
    const dorita = harta[o.eveniment];
    return dorita && o.alegeri.find((a) => a.id === dorita && a.disponibil) ? dorita : rezerva(o);
  };
}

// Rulează opriri până când motorul așteaptă „Avansează” sau jocul se termină.
function consuma(state, ctx, oprire, strategie, jurnal = []) {
  while (oprire) {
    jurnal.push(oprire);
    if (oprire.tip === 'eveniment') oprire = alege(state, ctx, strategie(oprire)).oprire;
    else if (oprire.tip === 'final') break;
    else oprire = continua(state, ctx);
  }
  return jurnal;
}

function ruleazaAni(state, ctx, ani, strategie = primaDisponibila) {
  const opriri = [];
  if (state.pendinte) consuma(state, ctx, avanseaza(state, ctx), strategie, opriri);
  for (let i = 0; i < ani && !state.final; i++) consuma(state, ctx, avanseaza(state, ctx), strategie, opriri);
  return opriri;
}

// Alegere „aleatoare” deterministă pentru simulări (LCG separat de RNG-ul jocului).
function strategieAleatoare(seed) {
  let x = seed >>> 0;
  return (o) => {
    const disp = o.alegeri.filter((a) => a.disponibil);
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return disp[x % disp.length].id;
  };
}

function verificaInvarianti(state) {
  for (const [k, v] of Object.entries({ ...state.stat, ...state.ascunse })) {
    ok(Number.isFinite(v) && v >= 0 && v <= 100, `statistica ${k} în afara intervalului: ${v}`);
  }
  ok(Number.isInteger(state.numerar) && state.numerar >= 0, `numerar invalid: ${state.numerar}`);
  for (const p of state.produse) {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number') ok(Number.isFinite(v), `produs ${p.tip}.${k} nu e număr finit`);
    }
  }
}

// ---------- Teste ----------

function teste(ctxBaza, incarcare) {
  const ctxNou = (extra = {}) => ({ ...ctxBaza, ...extra });
  const joc = (seed = 'test', extra) => {
    const ctx = ctxNou(extra);
    return { ctx, state: jocNou(ctx, { seed, nume: 'Test' }) };
  };
  // Pornește un joc cu job de curier (CIM), cont curent deschis și primul an trecut.
  const jocCuJob = (seed = 'job') => {
    const { ctx, state } = joc(seed);
    alege(state, ctx, 'munca');
    ruleazaAni(state, ctx, 1, strategieDin({ 'primul-cont': 'standard' }));
    return { ctx, state };
  };

  return {
    'conținutul se încarcă fără erori'() {
      ok(incarcare.erori.length === 0, `erori:\n${incarcare.erori.map(formateazaEroare).join('\n')}`);
      ok(ctxBaza.evenimente.size >= 5, `prea puține evenimente: ${ctxBaza.evenimente.size}`);
    },

    'validatorul prinde greșelile de scriere, cu fișier, id și câmp'() {
      const erori = [];
      const ev = {
        id: 'test-gresit', faza: [2], text: 'Ai {sumaa} lei.', variabile: { suma: 100 },
        alegeri: [
          { id: 'a', eticheat: 'Typo', efecte: { numerar: '-{suma}' }, concepte: ['inexistent'] },
          { id: 'b', eticheta: 'B', flaguri: ['Datorie IFN'], urmari: [{ eveniment: 'nu-exista', dupaLuni: 2 }] },
        ],
      };
      const r = construiesteContinut({
        config: ctxBaza.config, balans: ctxBaza.balans,
        joburiJson: { joburi: [...ctxBaza.joburi.values()] }, concepteJson: { concepte: [...ctxBaza.concepte.values()] },
        brute: [{ ev, fisier: 'data/events/test.json', pozitie: 0 }],
      }, erori);
      const text = erori.map(formateazaEroare).join('\n');
      ok(text.includes('data/events/test.json › test-gresit'), 'eroarea trebuie să conțină fișierul și id-ul');
      ok(text.includes('ai vrut „eticheta”'), 'trebuie sugerat câmpul corect pentru „eticheat”');
      ok(text.includes('{sumaa}'), 'variabila nedefinită din text trebuie raportată');
      ok(text.includes('„inexistent”'), 'conceptul inexistent trebuie raportat');
      ok(text.includes('Datorie IFN'), 'flag-ul invalid trebuie raportat');
      ok(text.includes('„nu-exista” nu există'), 'urmarea către un eveniment inexistent trebuie raportată');
      ok(!r.ctx.evenimente.has('test-gresit'), 'evenimentul invalid nu intră în joc');
    },

    'brut → net la CIM'() {
      const f = fluturas(inBani(4050), 'cim', ctxBaza);
      egal(f.cas, 101250, 'CAS');
      egal(f.cass, 40500, 'CASS');
      egal(f.impozit, 26325, 'impozit');
      egal(f.net, 236925, 'net');
    },

    'jocul pornește cu decizia de după bac, în vara dinainte de primul an'() {
      const { state, ctx } = joc();
      egal(state.pendinte.eveniment, 'dupa-liceu', 'prima oprire');
      egal(varstaLa(state.luna), 18, 'vârsta de start');
      const { oprire } = alege(state, ctx, 'munca');
      egal(oprire, null, 'după prima decizie se așteaptă „Avansează”');
      ok(gasesteProdus(state, 'contractMunca'), 'jobul a creat un contract de muncă');
    },

    'un an: 12 luni, max. 4 opriri, rezumat la final, vârsta crește în septembrie'() {
      const { state, ctx } = joc('an');
      alege(state, ctx, 'munca');
      const opriri = ruleazaAni(state, ctx, 1);
      const evenimente = opriri.filter((o) => o.tip === 'eveniment');
      ok(evenimente.length <= 4, `prea multe opriri: ${evenimente.length}`);
      egal(opriri.at(-1).tip, 'rezumat', 'ultima oprire');
      egal(state.luna, 12, 'luna după primul an');
      egal(varstaLa(state.luna), 19, 'vârsta în al doilea an');
      const luni = evenimente.map((o) => o.luna);
      ok(luni.every((l, i) => i === 0 || l > luni[i - 1]), 'max. o oprire pe lună, în ordine');
      ok(opriri.some((o) => o.tip === 'moment' && o.id === 'primulSalariu'), 'momentul „primul salariu”');
      ok(opriri.find((o) => o.id === 'primulSalariu').date.fluturas.net > 0, 'fluturașul e atașat momentului');
    },

    'în 30 de ani, niciun an nu are peste 4 opriri'() {
      const { state, ctx } = joc('plafon');
      alege(state, ctx, 'munca');
      const opriri = ruleazaAni(state, ctx, 30, strategieAleatoare(7));
      const pePeAn = {};
      for (const o of opriri.filter((x) => x.tip === 'eveniment')) pePeAn[varstaLa(o.luna)] = (pePeAn[varstaLa(o.luna)] ?? 0) + 1;
      ok(Object.values(pePeAn).every((n) => n <= 4), `an cu prea multe opriri: ${JSON.stringify(pePeAn)}`);
    },

    'flag-urile cu durată expiră'() {
      const { state } = joc();
      seteazaFlag(state, 'test_flag:3');
      state.luna = 2;
      ok(areFlag(state, 'test_flag'), 'activ în luna 2');
      state.luna = 3;
      ok(!areFlag(state, 'test_flag'), 'expirat în luna 3');
    },

    'același seed + aceleași alegeri = aceeași viață'() {
      const a = joc('seed-x');
      const b = joc('seed-x');
      const c = joc('seed-y');
      for (const j of [a, b, c]) {
        alege(j.state, j.ctx, 'munca');
        ruleazaAni(j.state, j.ctx, 6, strategieAleatoare(42));
      }
      egal(JSON.stringify(a.state), JSON.stringify(b.state), 'stări identice');
      ok(JSON.stringify(a.state) !== JSON.stringify(c.state), 'seed diferit, viață diferită');
    },

    'salvare + încărcare la fiecare oprire dă același rezultat ca rularea continuă'() {
      const strategie = strategieAleatoare(3);
      const a = joc('salvare');
      alege(a.state, a.ctx, 'munca');
      ruleazaAni(a.state, a.ctx, 4, strategie);

      const storage = creeazaStorageMemorie();
      const ctx = ctxNou({ persistenta: { salveaza: (s) => salveazaJoc(storage, s) } });
      let state = jocNou(ctx, { seed: 'salvare', nume: 'Test' });
      alege(state, ctx, 'munca');
      const strategie2 = strategieAleatoare(3);
      for (let an = 0; an < 4; an++) {
        let o = avanseaza(state, ctx);
        while (o && o.tip !== 'final') {
          state = incarcaJoc(storage); // reîncărcăm din storage înainte de fiecare pas
          ok(state, 'salvarea există');
          if (o.tip === 'eveniment') o = alege(state, ctx, strategie2(o)).oprire;
          else o = continua(state, ctx);
        }
      }
      egal(JSON.stringify(state), JSON.stringify(a.state), 'stări identice după reîncărcări');
    },

    'checkpoint înainte de o decizie-cheie'() {
      const storage = creeazaStorageMemorie();
      const ctx = ctxNou({ persistenta: { checkpoint: (s, et) => adaugaCheckpoint(storage, s, et, 5) } });
      const state = jocNou(ctx, { seed: 'cp' });
      alege(state, ctx, 'sabatic');
      const lista = listaCheckpointuri(storage);
      egal(lista.length, 1, 'un checkpoint');
      const reluat = incarcaCheckpoint(storage, lista[0].id);
      egal(reluat.pendinte.eveniment, 'dupa-liceu', 'checkpoint-ul redeschide decizia');
      egal(reluat.decizii.length, 0, 'fără decizia luată după');
    },

    'fondul de urgență: doar contul marcat, alegerea apare dezactivată cu motiv'() {
      const { state, ctx } = jocCuJob('fond');
      const cont = actiune(state, ctx, 'deschide', { tip: 'contEconomii' }).produs;
      ok(actiune(state, ctx, 'depune', { id: cont.id, suma: 3000 }).ok, 'depunere');

      let o = forteazaEveniment(state, ctx, 'urgenta-2000');
      const fond = o.alegeri.find((a) => a.id === 'fond');
      ok(!fond.disponibil, 'nemarcat: indisponibil');
      egal(fond.motiv, 'Nu ai un fond de urgență.', 'motivul afișat');
      ok(!o.alegeri.find((a) => a.id === 'card').disponibil, 'fără card de credit: indisponibil');

      state.pendinte = null;
      actiune(state, ctx, 'seteaza', { id: cont.id, campuri: { fondUrgenta: true } });
      o = forteazaEveniment(state, ctx, 'urgenta-2000');
      ok(o.alegeri.find((a) => a.id === 'fond').disponibil, 'marcat: disponibil');
      const inainte = { fond: fondUrgenta(state), portofel: baniDisponibili(state) };
      alege(state, ctx, 'fond');
      egal(fondUrgenta(state), inainte.fond - inBani(o.variabile.suma), 'plătit din fond');
      egal(baniDisponibili(state), inainte.portofel, 'portofelul neatins');
    },

    'spargerea depozitului pierde dobânda'() {
      const { state, ctx } = jocCuJob('depozit');
      const dep = actiune(state, ctx, 'deschide', { tip: 'depozit', suma: 2500, luni: 24 }).produs;
      ok(dep, 'depozit deschis');
      ruleazaAni(state, ctx, 1, strategieDin({ 'urgenta-2000': 'extra' }));
      ok(dep.dobandaAcumulata > 0, 'depozitul a acumulat dobândă');
      const o = forteazaEveniment(state, ctx, 'urgenta-2000');
      ok(o.alegeri.find((a) => a.id === 'depozit').disponibil, 'alegerea „Sparg depozitul” e disponibilă');
      const inainte = baniDisponibili(state);
      alege(state, ctx, 'depozit');
      egal(baniDisponibili(state), inainte + inBani(2500) - inBani(o.variabile.suma), 'primești doar suma depusă');
      ok(!gasesteProdus(state, 'depozit'), 'depozitul a fost închis');
    },

    'card de credit: cumpărăturile pe card, plata integrală = 0 dobândă, plata minimă = dobândă'() {
      const { state, ctx } = jocCuJob('card');
      const r = actiune(state, ctx, 'deschide', { tip: 'cardCredit' });
      ok(r.ok, r.mesaj);
      actiune(state, ctx, 'seteaza', { id: r.produs.id, campuri: { cumparaturiPeCard: true } });
      ruleazaAni(state, ctx, 1, strategieDin({ 'card-scadenta': 'integral' }));
      const card = gasesteProdus(state, 'cardCredit');
      ok(card.soldScadent > 0, 'cumpărăturile au ajuns pe card');
      egal(card.dobandaTotala, 0, 'integral: fără dobândă');
      actiune(state, ctx, 'seteaza', { id: card.id, campuri: { plata: 'minim' } });
      ruleazaAni(state, ctx, 1, strategieDin({ 'card-scadenta': 'minim' }));
      ok(card.dobandaTotala > 0, 'minim: apare dobânda');
    },

    'IFN returnat în luna fără dobândă costă doar suma împrumutată'() {
      const { state, ctx } = jocCuJob('ifn-ok');
      const o = forteazaEveniment(state, ctx, 'urgenta-2000');
      alege(state, ctx, 'ifn');
      const credit = gasesteProdus(state, 'credit:ifn');
      ok(credit, 'credit IFN creat');
      ok(areFlag(state, 'datorie_ifn'), 'flag datorie_ifn');
      const opriri = consuma(state, ctx, avanseaza(state, ctx), strategieDin({ 'ifn-alegere': 'returnez' }));
      const ev = opriri.find((x) => x.eveniment === 'ifn-alegere');
      ok(ev, 'urmarea „ifn-alegere” a apărut');
      egal(ev.luna, o.luna + 1, 'la o lună după credit');
      ok(!gasesteProdus(state, 'credit:ifn'), 'creditul a fost închis');
      egal(credit.totalPlatit, credit.sumaInitiala, 'cost total = suma împrumutată');
      ok(!areFlag(state, 'datorie_ifn'), 'flag-ul a dispărut la închidere');
    },

    'IFN ignorat: restanță → Biroul de Credit → cesiune → executare → poprire limitată'() {
      const { state, ctx } = joc('ifn-rau');
      alege(state, ctx, 'sabatic');
      // Venit exact cât costul de trai, ca rata IFN să rămână neplătită.
      state.recurente = [{ tip: 'venit', suma: pret(state, ctx, 'costTrai.bazaLunara') + pret(state, ctx, 'locuinte.acasa'), luniRamase: null }];
      state.numerar = 0;
      forteazaEveniment(state, ctx, 'urgenta-2000');
      const { rezultat } = alege(state, ctx, 'ifn');
      const scor = state.ascunse.scorCredit;

      const strategie = strategieDin({ 'primul-cont': 'cash', 'ifn-alegere': 'rate', 'ifn-restanta': 'ignor' });
      const opriri = consuma(state, ctx, avanseaza(state, ctx), strategie);
      ok(opriri.some((x) => x.eveniment === 'ifn-restanta'), 'evenimentul de restanță a apărut');
      ok(state.ascunse.scorCredit < scor, 'scorul de credit a scăzut');
      ok(areFlag(state, 'istoric_restante'), 'raportat la Biroul de Credit');
      ok(state.jurnal.some((j) => j.text.includes('firme de recuperare')), 'cesiune în jurnal');
      const poprire = gasesteProdus(state, 'poprire');
      ok(poprire, 'poprirea a fost creată');
      ok(areFlag(state, 'executare_silita'), 'flag executare silită');

      // Lanțul pentru „Ce s-a întâmplat?”
      const dIgnor = state.decizii.find((d) => d.eveniment === 'ifn-restanta');
      const lant = lantDecizii(state, dIgnor.id);
      egal(lant[0].id, rezultat.decizie.id, 'lanțul pornește de la decizia IFN');
      egal(poprire.cauza, rezultat.decizie.id, 'poprirea știe de unde a pornit');
      verificaInvarianti(state);
    },
  };
}

function testPoprire(ctxBaza) {
  return {
    'poprirea reține max. o treime din net și declanșează momentul-cheie'() {
      const ctx = { ...ctxBaza };
      const state = jocNou(ctx, { seed: 'poprire' });
      alege(state, ctx, 'munca');
      state.produse.push({ id: 'px', tip: 'poprire', creditor: 'recuperator', datorie: inBani(50000), retinutTotal: 0, deschisLa: 0, cauza: null });
      const opriri = consuma(state, ctx, avanseaza(state, ctx), strategieDin({ 'primul-cont': 'standard' }));
      const moment = opriri.find((o) => o.id === 'primaPoprire');
      ok(moment, 'momentul „prima poprire”');
      const f = fluturas(gasesteProdus(state, 'contractMunca').brut, 'cim', ctx);
      ok(moment.date.retinut <= Math.round(f.net * 0.3334), 'reținerea respectă limita');
      ok(moment.date.retinut > 0, 's-a reținut ceva');
      verificaInvarianti(state);
    },
  };
}

function testSimulare(ctxBaza) {
  return {
    'simulare: 30 de vieți cu alegeri aleatoare, până la final, fără erori'() {
      const finaluri = {};
      for (let i = 0; i < 30; i++) {
        const ctx = { ...ctxBaza };
        const state = jocNou(ctx, { seed: `viata-${i}` });
        const strategie = strategieAleatoare(i + 1);
        consuma(state, ctx, oprireCurentaSauStart(state, ctx), strategie);
        for (let an = 0; an < 60 && !state.final; an++) {
          consuma(state, ctx, avanseaza(state, ctx), strategie);
          verificaInvarianti(state);
        }
        ok(state.final, `viața ${i} nu s-a terminat`);
        finaluri[state.final.motiv] = (finaluri[state.final.motiv] ?? 0) + 1;
      }
      return `finaluri: ${JSON.stringify(finaluri)}`;
    },
  };
}

function oprireCurentaSauStart(state, ctx) {
  return state.pendinte ? avanseaza(state, ctx) : null;
}

export async function ruleazaTeste(citeste, log = console.log) {
  const incarcare = await incarcaContinut(citeste);
  for (const a of incarcare.avertismente) log(`  ⚠ ${formateazaEroare(a)}`);
  const toate = { ...teste(incarcare.ctx, incarcare), ...testPoprire(incarcare.ctx), ...testSimulare(incarcare.ctx) };
  let trecute = 0;
  const picate = [];
  for (const [nume, fn] of Object.entries(toate)) {
    try {
      const info = await fn();
      trecute += 1;
      log(`  ✓ ${nume}${info ? `  (${info})` : ''}`);
    } catch (e) {
      picate.push(nume);
      log(`  ✗ ${nume}\n      ${e instanceof EsecTest ? e.message : e.stack}`);
    }
  }
  log(`\n${trecute} trecute, ${picate.length} picate`);
  return { trecute, picate };
}
