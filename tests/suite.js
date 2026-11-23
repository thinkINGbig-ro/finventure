// Suita de teste a motorului. Rulează la fel în Node (tests/run.js) și în browser (tests/run.html).

import { construiesteContinut, formateazaEroare, incarcaContinut } from '../js/content.js';
import { actiune, alege, avanseaza, continua, forteazaEveniment, jocNou } from '../js/engine.js';
import { lantDecizii, gasesteProdus } from '../js/events.js';
import { fluturas, baniDisponibili, contCurent, fondUrgenta, pret } from '../js/finance.js';
import {
  adaugaCheckpoint, areFlag, cheltuieliLunare, incarcaCheckpoint, incarcaJoc, listaCheckpointuri, salveazaJoc, seteazaFlag,
} from '../js/state.js';
import { PROFILURI, simuleazaViata, simuleazaVieti, strategieAleatoare } from '../js/simulare.js';
import { calculeazaTipare } from '../js/tipare.js';
import { estimeazaPensie, rezumatViata, venitPasivLunar } from '../js/bilant.js';
import { alegeFinal } from '../js/finaluri.js';
import { genereazaOferte, promovareDisponibila, schimbaJob } from '../js/cariera.js';
import { creeazaStorageMemorie } from '../js/storage.js';
import { inBani, varstaLa } from '../js/util.js';

class EsecTest extends Error {}
const ok = (cond, mesaj) => { if (!cond) throw new EsecTest(mesaj); };
const egal = (a, b, mesaj) => ok(Object.is(a, b), `${mesaj}: așteptat ${JSON.stringify(b)}, primit ${JSON.stringify(a)}`);

// ---------- Ajutoare ----------

// Găsește o alegere după cale („id” sau „grup/sub”) în oprirea descrisă.
function alegerePeCale(o, cale) {
  const [a, s] = cale.split('/');
  const prim = o.alegeri.find((x) => x.id === a);
  return s ? prim?.subalegeri?.find((x) => x.id === s) : prim;
}

// Strategie implicită: prima alegere disponibilă (intră și în grupuri).
function primaDisponibila(o) {
  const a = o.alegeri.find((x) => x.disponibil);
  return a.grup ? a.subalegeri.find((s) => s.disponibil).cale : a.cale;
}

function strategieDin(harta, rezerva = primaDisponibila) {
  return (o) => {
    const dorita = harta[o.eveniment];
    return dorita && alegerePeCale(o, dorita)?.disponibil ? dorita : rezerva(o);
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
  for (let i = 0; i < ani && !state.final; i++) consuma(state, ctx, avanseaza(state, ctx), strategie, opriri);
  return opriri;
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
  // Joc cu job de curier (CIM), cont curent deschis și primul an trecut.
  const jocCuJob = (seed = 'job') => {
    const { ctx, state } = joc(seed);
    alege(state, ctx, 'munca');
    ruleazaAni(state, ctx, 1, strategieDin({ 'primul-cont': 'standard' }));
    return { ctx, state };
  };
  // Joc fără niciun venit: doar banii de start.
  const jocFaraVenit = (seed, locuinta) => {
    const { ctx, state } = joc(seed);
    alege(state, ctx, 'sabatic');
    state.recurente = [];
    if (locuinta) state.situatie.locuinta = locuinta;
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
          { id: 'c', eticheta: 'C', subalegeri: [{ id: 'x', eticheta: 'X', subalegeri: [] }, { id: 'y', eticheta: 'Y' }] },
          { id: 'd', eticheta: 'D' },
          { id: 'e', eticheta: 'E' },
        ],
      };
      const r = construiesteContinut({
        config: ctxBaza.config, balans: ctxBaza.balans,
        joburiJson: { joburi: [...ctxBaza.joburi.values()] }, concepteJson: { concepte: [...ctxBaza.concepte.values()] },
        brute: [{ ev, fisier: 'data/events/test.json', pozitie: 0 }],
      }, erori);
      const text = erori.map(formateazaEroare).join('\n');
      ok(text.includes('data/events/test.json › test-gresit'), 'eroarea trebuie să conțină fișierul și id-ul');
      ok(text.includes('între 2 și 4 alegeri'), 'peste 4 alegeri pe ecran trebuie raportat');
      ok(!r.ctx.evenimente.has('test-gresit'), 'evenimentul invalid nu intră în joc');

      const erori2 = [];
      construiesteContinut({
        config: ctxBaza.config, balans: ctxBaza.balans,
        joburiJson: { joburi: [...ctxBaza.joburi.values()] }, concepteJson: { concepte: [...ctxBaza.concepte.values()] },
        brute: [{ ev: { ...ev, alegeri: ev.alegeri.slice(0, 3) }, fisier: 'data/events/test.json', pozitie: 0 }],
      }, erori2);
      const text2 = erori2.map(formateazaEroare).join('\n');
      ok(text2.includes('ai vrut „eticheta”'), 'trebuie sugerat câmpul corect pentru „eticheat”');
      ok(text2.includes('{sumaa}'), 'variabila nedefinită din text trebuie raportată');
      ok(text2.includes('„inexistent”'), 'conceptul inexistent trebuie raportat');
      ok(text2.includes('Datorie IFN'), 'flag-ul invalid trebuie raportat');
      ok(text2.includes('nu pot avea la rândul lor sub-alegeri'), 'sub-alegeri pe două niveluri trebuie raportate');
      ok(text2.includes('„nu-exista” nu există'), 'urmarea către un eveniment inexistent trebuie raportată');
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
      const salariu = opriri.find((o) => o.tip === 'moment' && o.id === 'primulSalariu');
      ok(salariu?.date.fluturas.net > 0, 'momentul „primul salariu”, cu fluturașul atașat');
    },

    'în 30 de ani, niciun an nu are peste 4 opriri (lanțurile imediate, ca CV-ul, nu se numără)'() {
      const { state, ctx } = joc('plafon');
      alege(state, ctx, 'munca');
      const opriri = ruleazaAni(state, ctx, 30, strategieAleatoare(7));
      const peAn = {};
      for (const o of opriri.filter((x) => x.tip === 'eveniment' && !x.inLant)) peAn[varstaLa(o.luna)] = (peAn[varstaLa(o.luna)] ?? 0) + 1;
      ok(Object.values(peAn).every((n) => n <= 4), `an cu prea multe opriri: ${JSON.stringify(peAn)}`);
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
      const [a, b, c] = [joc('seed-x'), joc('seed-x'), joc('seed-y')];
      for (const j of [a, b, c]) {
        alege(j.state, j.ctx, 'munca');
        ruleazaAni(j.state, j.ctx, 6, strategieAleatoare(42));
      }
      egal(JSON.stringify(a.state), JSON.stringify(b.state), 'stări identice');
      ok(JSON.stringify(a.state) !== JSON.stringify(c.state), 'seed diferit, viață diferită');
    },

    'salvare + încărcare la fiecare oprire dă același rezultat ca rularea continuă'() {
      const a = joc('salvare');
      alege(a.state, a.ctx, 'munca');
      ruleazaAni(a.state, a.ctx, 4, strategieAleatoare(3));

      const storage = creeazaStorageMemorie();
      const ctx = ctxNou({ persistenta: { salveaza: (s) => salveazaJoc(storage, s) } });
      let state = jocNou(ctx, { seed: 'salvare', nume: 'Test' });
      alege(state, ctx, 'munca');
      const strategie = strategieAleatoare(3);
      for (let an = 0; an < 4 && !state.final; an++) {
        let o = avanseaza(state, ctx);
        while (o && o.tip !== 'final') {
          state = incarcaJoc(storage); // reîncărcăm din storage înainte de fiecare pas
          ok(state, 'salvarea există');
          o = o.tip === 'eveniment' ? alege(state, ctx, strategie(o)).oprire : continua(state, ctx);
        }
      }
      egal(JSON.stringify(state), JSON.stringify(a.state), 'stări identice după reîncărcări');
    },

    'checkpoint înainte de o decizie-cheie'() {
      const storage = creeazaStorageMemorie();
      const ctx = ctxNou({ persistenta: { checkpoint: (s, et, info) => adaugaCheckpoint(storage, s, et, info) } });
      const state = jocNou(ctx, { seed: 'cp' });
      alege(state, ctx, 'sabatic');
      const lista = listaCheckpointuri(storage);
      egal(lista.length, 1, 'un checkpoint');
      const reluat = incarcaCheckpoint(storage, lista[0].id);
      egal(reluat.pendinte.eveniment, 'dupa-liceu', 'checkpoint-ul redeschide decizia');
      egal(reluat.decizii.length, 0, 'fără decizia luată după');
    },

    'alegeri în doi pași: grupul arată sub-alegerile, cu motive, și cere calea completă'() {
      const { state, ctx } = jocCuJob('grup');
      state.numerar = 0;
      contCurent(state).sold = 0; // fără bani: nici „din contul curent” nu merge
      const o = forteazaEveniment(state, ctx, 'urgenta-2000');
      ok(o.alegeri.length <= 4, 'max. 4 pe primul ecran');
      const banii = alegerePeCale(o, 'din-banii-mei');
      ok(banii.grup, '„Din banii mei” e un grup');
      ok(!banii.disponibil, 'fără bani, fond, depozit sau card: grupul e indisponibil');
      egal(banii.motiv, 'Nicio variantă nu e posibilă acum.', 'motivul grupului');
      egal(alegerePeCale(o, 'din-banii-mei/card').motiv, 'Nu ai card de credit.', 'motivul sub-alegerii rămâne vizibil');
      egal(alegerePeCale(o, 'ma-imprumut/ifn').cale, 'ma-imprumut/ifn', 'calea sub-alegerii');
      let eroare = null;
      try { alege(state, ctx, 'ma-imprumut'); } catch (e) { eroare = e; }
      ok(eroare, 'un grup nu se poate alege fără sub-alegere');
      const { decizie } = alege(state, ctx, 'ma-imprumut/ifn').rezultat;
      egal(decizie.alegere, 'ma-imprumut/ifn', 'decizia păstrează calea completă');
    },

    'fondul de urgență: doar contul marcat, alegerea apare dezactivată cu motiv'() {
      const { state, ctx } = jocCuJob('fond');
      const cont = actiune(state, ctx, 'deschide', { tip: 'contEconomii' }).produs;
      ok(actiune(state, ctx, 'depune', { id: cont.id, suma: 3000 }).ok, 'depunere');

      let o = forteazaEveniment(state, ctx, 'urgenta-2000');
      const fond = alegerePeCale(o, 'din-banii-mei/fond');
      ok(!fond.disponibil, 'nemarcat: indisponibil');
      egal(fond.motiv, 'Nu ai un fond de urgență.', 'motivul afișat');

      state.pendinte = null;
      actiune(state, ctx, 'seteaza', { id: cont.id, campuri: { fondUrgenta: true } });
      o = forteazaEveniment(state, ctx, 'urgenta-2000');
      ok(alegerePeCale(o, 'din-banii-mei/fond').disponibil, 'marcat: disponibil');
      const inainte = { fond: fondUrgenta(state), portofel: baniDisponibili(state) };
      alege(state, ctx, 'din-banii-mei/fond');
      egal(fondUrgenta(state), inainte.fond - inBani(o.variabile.suma), 'plătit din fond');
      egal(baniDisponibili(state), inainte.portofel, 'portofelul neatins');
    },

    'spargerea depozitului pierde dobânda'() {
      const { state, ctx } = jocCuJob('depozit');
      const dep = actiune(state, ctx, 'deschide', { tip: 'depozit', suma: 2500, luni: 24 }).produs;
      ok(dep, 'depozit deschis');
      ruleazaAni(state, ctx, 1, strategieDin({ 'urgenta-2000': 'muncesc' }));
      ok(dep.dobandaAcumulata > 0, 'depozitul a acumulat dobândă');
      const o = forteazaEveniment(state, ctx, 'urgenta-2000');
      ok(alegerePeCale(o, 'din-banii-mei/depozit').disponibil, '„Sparg depozitul” e disponibilă');
      const inainte = baniDisponibili(state);
      alege(state, ctx, 'din-banii-mei/depozit');
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
      alege(state, ctx, 'ma-imprumut/ifn');
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

    'IFN ignorat: restanță → Biroul de Credit → cesiune → executare → poprire'() {
      const { state, ctx } = joc('ifn-rau');
      alege(state, ctx, 'sabatic');
      // Venit exact cât costul de trai, ca rata IFN să rămână neplătită.
      const trai = pret(state, ctx, 'costTrai.mancareTransport') + pret(state, ctx, 'locuinte.acasa.utilitati') + pret(state, ctx, 'costTrai.telefon');
      state.recurente = [{ tip: 'venit', suma: trai, luniRamase: null }];
      state.numerar = 0;
      forteazaEveniment(state, ctx, 'urgenta-2000');
      const { rezultat } = alege(state, ctx, 'ma-imprumut/ifn');
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

      const dIgnor = state.decizii.find((d) => d.eveniment === 'ifn-restanta');
      egal(lantDecizii(state, dIgnor.id)[0].id, rezultat.decizie.id, 'lanțul pornește de la decizia IFN');
      egal(poprire.cauza, rezultat.decizie.id, 'poprirea știe de unde a pornit');
      verificaInvarianti(state);
    },

    'facturi neplătite: somație → deconectare → evacuare → recuperare → faliment, nu renunțare'() {
      const { state, ctx } = jocFaraVenit('facturi', 'chirieSingur');
      const opriri = [];
      for (let an = 0; an < 6 && !state.final; an++) consuma(state, ctx, avanseaza(state, ctx), strategieDin({ 'facturi-somatie': 'ignor', 'evacuare': 'raman' }), opriri);
      ok(opriri.some((o) => o.eveniment === 'facturi-somatie'), 'somația a apărut');
      ok(state.jurnal.some((j) => j.text.includes('tăiat curentul')), 'deconectare');
      ok(state.jurnal.some((j) => j.text.includes('evacuat')), 'evacuare');
      ok(opriri.some((o) => o.eveniment === 'evacuare'), 'evenimentul de după evacuare');
      egal(state.situatie.locuinta, 'acasa', 'după evacuare, înapoi acasă');
      ok(state.jurnal.some((j) => j.text.includes('firme de recuperare')), 'restanța a ajuns la recuperare');
      egal(state.final?.motiv, 'faliment', 'lipsa banilor duce la faliment');
      ok(state.stat.fericire > 0, 'Fericirea nu ajunge la 0 doar din lipsă de bani');
    },

    'poprirea pe cont lasă neatinsă suma protejată'() {
      const { state, ctx } = jocFaraVenit('poprire-cont');
      const cont = actiune(state, ctx, 'deschide', { tip: 'contCurent' }).produs;
      state.numerar = 0;
      cont.sold = inBani(5000);
      state.produse.push({ id: 'px', tip: 'poprire', creditor: 'recuperator', datorie: inBani(50000), retinutTotal: 0, deschisLa: 0, cauza: null });
      let o = avanseaza(state, ctx);
      while (o && !(o.tip === 'moment' && o.id === 'primaPoprireCont')) o = o.tip === 'eveniment' ? alege(state, ctx, primaDisponibila(o)).oprire : continua(state, ctx);
      ok(o, 'momentul „prima poprire pe cont”');
      egal(contCurent(state).sold, pret(state, ctx, 'poprire.sumaProtejataCont'), 'în cont rămâne exact suma protejată');
      ok(state.concepte.includes('poprire-cont'), 'conceptul s-a deblocat');
    },

    'executarea ia și din economii și depozite; cine are active nu e în faliment'() {
      const { state, ctx } = jocFaraVenit('executare');
      const cont = actiune(state, ctx, 'deschide', { tip: 'contCurent' }).produs;
      cont.sold = inBani(1500); // sub suma protejată
      state.numerar = 0;
      state.produse.push({ id: 'e1', tip: 'contEconomii', sold: inBani(3000), fondUrgenta: true, dobandaAnuala: 0, deschisLa: 0 });
      state.produse.push({ id: 'd1', tip: 'depozit', sold: inBani(4000), luni: 12, luniRamase: 6, dobandaAcumulata: 0, reinnoire: true, dobandaAnuala: 0, deschisLa: 0 });
      state.produse.push({ id: 'px', tip: 'poprire', creditor: 'recuperator', datorie: inBani(5000), retinutTotal: 0, deschisLa: 0, cauza: null });
      let o = avanseaza(state, ctx);
      while (o && state.luna < 1) o = o.tip === 'eveniment' ? alege(state, ctx, primaDisponibila(o)).oprire : continua(state, ctx);
      ok(!gasesteProdus(state, 'poprire'), 'datoria de 5.000 lei a fost acoperită din economii și depozit');
      egal(gasesteProdus(state, 'contEconomii').sold, 0, 'economiile au fost poprite');
      ok(!gasesteProdus(state, 'depozit'), 'depozitul a fost lichidat');
      ok(state.jurnal.some((j) => j.text.includes('din economii și investiții')), 'apare în jurnal');
    },

    'poprirea pe salariu reține max. o treime din net'() {
      const ctx = ctxNou();
      const state = jocNou(ctx, { seed: 'poprire' });
      alege(state, ctx, 'munca');
      state.produse.push({ id: 'px', tip: 'poprire', creditor: 'recuperator', datorie: inBani(50000), retinutTotal: 0, deschisLa: 0, cauza: null });
      const opriri = consuma(state, ctx, avanseaza(state, ctx), strategieDin({ 'primul-cont': 'standard' }));
      const moment = opriri.find((o) => o.id === 'primaPoprire');
      ok(moment?.date.retinut > 0, 'momentul „prima poprire”, cu suma reținută');
      const f = fluturas(gasesteProdus(state, 'contractMunca').brut, 'cim', ctx);
      ok(moment.date.retinut <= Math.round(f.net * 0.3334), 'reținerea respectă limita');
      verificaInvarianti(state);
    },

    'CV: cv-start → limbi → oferte, în lanț imediat, iar oferta acceptată devine contractul'() {
      const { state, ctx } = jocFaraVenit('cv');
      const r = actiune(state, ctx, 'cautaJob');
      ok(r.ok, r.mesaj);
      egal(r.oprire.eveniment, 'cv-start', 'primul pas');
      const pas2 = alege(state, ctx, 'voluntariat').oprire;
      egal(pas2?.eveniment, 'cv-limbi', 'al doilea pas vine imediat');
      ok(pas2.inLant, 'marcat ca lanț (nu consumă din plafonul anului)');
      const pas3 = alege(state, ctx, 'scoala').oprire;
      egal(pas3?.eveniment, 'oferte-job', 'ofertele vin imediat');
      ok(state.pendinte.oferte.length >= 1, 'cel puțin o ofertă');
      ok(alegerePeCale(pas3, 'oferta-3').disponibil === (state.pendinte.oferte.length >= 3), 'a treia ofertă e disponibilă doar dacă există');
      const oferta = state.pendinte.oferte[0];
      alege(state, ctx, 'oferta-1/accept');
      const c = gasesteProdus(state, 'contractMunca');
      egal(c.jobId, oferta.jobId, 'jobul din ofertă');
      egal(c.brut, oferta.brut, 'salariul din ofertă');
      ok(!actiune(state, ctx, 'cautaJob').ok, 'nu poți căuta din nou imediat');
    },

    'un CV mai bun aduce mai multe oferte'() {
      const { state, ctx } = jocFaraVenit('cv-bun');
      const slab = genereazaOferte(state, ctx).length;
      state.situatie.nivelStudii = 'licenta';
      state.ascunse.skill = 70;
      state.ascunse.reputatie = 30;
      seteazaFlag(state, 'cv_proiecte:12');
      const bune = genereazaOferte(state, ctx);
      ok(bune.length === 3 && bune.length > slab, `oferte: slab ${slab}, bun ${bune.length}`);
    },

    'negocierea: succes, refuz sau ofertă retrasă, cu jurnal'() {
      const rezultate = new Set();
      for (let i = 0; i < 30; i++) {
        const { state, ctx } = jocFaraVenit(`neg-${i}`);
        state.ascunse.skill = 50;
        actiune(state, ctx, 'cautaJob');
        alege(state, ctx, 'voluntariat');
        alege(state, ctx, 'scoala');
        const brutOferta = state.pendinte.oferte[0].brut;
        alege(state, ctx, 'oferta-1/negociez');
        const c = gasesteProdus(state, 'contractMunca');
        rezultate.add(!c ? 'retras' : c.brut > brutOferta ? 'succes' : 'refuzat');
        ok(state.jurnal.at(-1).text.includes('negociat'), 'rezultatul apare în jurnal');
      }
      ok(rezultate.has('succes') && rezultate.size >= 2, `rezultate: ${[...rezultate]}`);
    },

    'mărirea: nu mai des de o dată pe an; promovarea urcă pe scara jobului'() {
      const { state, ctx } = jocFaraVenit('marire');
      schimbaJob(state, ctx, { id: 'vanzator', contract: 'cim' });
      const c = gasesteProdus(state, 'contractMunca');
      ok(!actiune(state, ctx, 'cereMarire').ok, 'prea devreme');
      c.luniDeLaMarire = 24;
      const r = actiune(state, ctx, 'cereMarire');
      ok(r.ok && typeof r.succes === 'boolean', 'cererea s-a făcut');
      ok(!promovareDisponibila(state, ctx), 'fără vechime: fără promovare');
      c.luniVechime = 24;
      state.ascunse.skill = 45;
      ok(promovareDisponibila(state, ctx), 'cu vechime și skill: promovare disponibilă');
      const brutVechi = gasesteProdus(state, 'contractMunca').brut;
      forteazaEveniment(state, ctx, 'promovare');
      alege(state, ctx, 'accept');
      const nou = gasesteProdus(state, 'contractMunca');
      egal(nou.jobId, 'sef-tura', 'noul post');
      ok(nou.brut >= Math.round(brutVechi * 1.1) - 5000, 'salariu cu cel puțin ~10% mai mare');
    },

    'stilul de viață: costă lunar, iar bucuria se estompează (adaptarea hedonică)'() {
      const { state, ctx } = jocCuJob('stil');
      const costModest = cheltuieliLunare(state, ctx);
      const f0 = state.stat.fericire;
      ok(actiune(state, ctx, 'stilViata', { nivel: 'lux' }).ok, 'trecerea la lux');
      ok(cheltuieliLunare(state, ctx) > costModest, 'luxul costă mai mult pe lună');
      const dupaSalt = state.stat.fericire;
      ok(dupaSalt > f0, 'bucurie imediată');
      ruleazaAni(state, ctx, 1, strategieDin({}, primaDisponibila));
      const ramas = state.stat.fericire - f0;
      ok(ramas < (dupaSalt - f0) / 2, `efectul s-a estompat (rămas ${ramas.toFixed(1)} din ${(dupaSalt - f0).toFixed(1)})`);
      ok(actiune(state, ctx, 'stilViata', { nivel: 'modest' }).ok, 'revenirea la modest');
      ok(state.stat.fericire < 100 && state.stilAnterior === 'lux', 'stilul anterior e reținut pentru rezumat');
    },

    'contribuția la părinți se oprește când te muți'() {
      const { state, ctx } = jocCuJob('contributie');
      forteazaEveniment(state, ctx, 'parinti-contributie');
      alege(state, ctx, 'contribui');
      ok(state.recurente.some((r) => r.locuinta === 'acasa'), 'contribuția există');
      state.situatie.locuinta = 'chirieColegi';
      ruleazaAni(state, ctx, 1);
      ok(!state.recurente.some((r) => r.locuinta === 'acasa'), 'contribuția a dispărut după mutare');
    },

    'tiparele: riscantul primește tipare negative, prudentul pozitive, cu cifre'() {
      let riscant = null;
      for (let i = 0; i < 10 && !riscant; i++) {
        const { state } = simuleazaViata(ctxNou(), `tip-r-${i}`, PROFILURI.riscant);
        if (state.final?.motiv === 'faliment') riscant = state;
      }
      ok(riscant, 'o viață riscantă cu faliment');
      const neg = calculeazaTipare(riscant, ctxBaza).negative;
      ok(neg.length >= 1 && neg.length <= 3, `1–3 tipare negative (${neg.map((t) => t.id)})`);
      ok(neg.every((t) => t.fapt && t.ceTrebuia && ctxBaza.concepte.has(t.concept)), 'fiecare are fapt, „ce trebuia” și un concept existent');

      const { state: prudent } = simuleazaViata(ctxNou(), 'tip-p', PROFILURI.prudent);
      const poz = calculeazaTipare(prudent, ctxBaza).pozitive;
      const ids = poz.map((t) => t.id);
      ok(ids.includes('investitii-regulate') || ids.includes('fond-constant'), `tipare pozitive: ${ids}`);
      ok(poz.every((t) => /\d/.test(t.fapt) && ctxBaza.concepte.has(t.concept)), 'cu cifre și concept');
      const pensie = estimeazaPensie(prudent, ctxBaza);
      ok(pensie.pilon1 > 0 && pensie.aniContributie >= 10, `pensie estimată: ${pensie.pilon1} bani, ${pensie.aniContributie} ani`);
      return `riscant: ${neg.map((t) => t.id).join(', ')} | prudent: ${ids.join(', ')}`;
    },

    'finalul colecționabil: cel mai specific se potrivește'() {
      const baza = { motiv: 'faliment', varsta: 34, avereAzi: -5000, ifnLuate: 0, rateCumparaturi: 0, aniLux: 0, aniConfortabil: 0, socuriAbsorbite: 0, venitPasivAcopera: false, varstaIndependenta: null };
      egal(alegeFinal(ctxBaza.finaluri, baza).id, 'faliment', 'faliment simplu');
      egal(alegeFinal(ctxBaza.finaluri, { ...baza, ifnLuate: 3 }).id, 'regele-ifn', 'trei IFN-uri');
      egal(alegeFinal(ctxBaza.finaluri, { ...baza, motiv: 'pensie', varsta: 65, avereAzi: 150000 }).id, 'pensionar-linistit', 'pensie obișnuită');
      egal(alegeFinal(ctxBaza.finaluri, { ...baza, motiv: 'pensie', varsta: 65, avereAzi: 900000, varstaIndependenta: 39 }).id, 'libertate-40', 'independent la 39');
    },

    'checkpoint-uri: ultimele 5 + cele care au deschis o datorie, max. 10'() {
      const storage = creeazaStorageMemorie();
      const { state } = joc('cp-retinere');
      for (let i = 0; i < 14; i++) {
        state.contoare.decizii = i;
        adaugaCheckpoint(storage, state, `cp ${i}`, { decizie: `d${i + 1}`, datorie: i % 3 === 0 });
      }
      const lista = listaCheckpointuri(storage);
      ok(lista.length <= 10, `cel mult 10 (${lista.length})`);
      ok(['d10', 'd11', 'd12', 'd13', 'd14'].every((d) => lista.some((c) => c.decizie === d)), 'ultimele 5 păstrate');
      ok(lista.some((c) => c.decizie === 'd4' && c.datorie), 'un checkpoint mai vechi, de datorie, păstrat');
    },

    'o decizie care deschide o datorie primește checkpoint, iar reluarea redeschide cardul'() {
      const storage = creeazaStorageMemorie();
      const ctx = ctxNou({ persistenta: { checkpoint: (st, et, info) => adaugaCheckpoint(storage, st, et, info) } });
      const state = jocNou(ctx, { seed: 'cp-datorie' });
      alege(state, ctx, 'munca');
      forteazaEveniment(state, ctx, 'telefon-rate'); // eveniment fără „checkpoint”, dar alegerea deschide un credit
      const { rezultat } = alege(state, ctx, 'rate');
      const cp = listaCheckpointuri(storage).find((c) => c.decizie === rezultat.decizie.id);
      ok(cp?.datorie, 'checkpoint marcat ca datorie');
      egal(incarcaCheckpoint(storage, cp.id).pendinte.eveniment, 'telefon-rate', 'reluarea redeschide decizia');
    },

    'independența financiară: când investițiile acoperă cheltuielile, poți să te retragi'() {
      const { state, ctx } = jocCuJob('independenta');
      state.produse.push({ id: 'inv', tip: 'investitie', clasa: 'etf', unitati: 100000000 / state.piete.etf, cost: 100000000, deschisLa: 0 });
      ok(venitPasivLunar(state, ctx) >= cheltuieliLunare(state, ctx), 'venitul pasiv acoperă cheltuielile');
      const opriri = consuma(state, ctx, avanseaza(state, ctx), strategieDin({ 'independenta-financiara': 'retrag' }));
      ok(opriri.some((o) => o.eveniment === 'independenta-financiara'), 'evenimentul a apărut');
      egal(state.final?.motiv, 'independenta', 'final: independență');
      egal(alegeFinal(ctx.finaluri, rezumatViata(state, ctx)).id, 'libertate-40', 'la 19 ani: Libertate la 40');
    },

    'simulare pe profiluri: prudentul o duce mai bine decât riscantul'() {
      const prudent = simuleazaVieti(ctxNou(), { n: 15, seed: 'prof', profil: 'prudent', laSfarsitDeAn: verificaInvarianti });
      const riscant = simuleazaVieti(ctxNou(), { n: 15, seed: 'prof', profil: 'riscant', laSfarsitDeAn: verificaInvarianti });
      ok((prudent.procente.pensie ?? 0) >= (riscant.procente.pensie ?? 0), 'prudent ≥ riscant la pensie');
      ok(prudent.avereMediana > riscant.avereMediana, 'prudentul are avere mai mare');
      return `pensie: prudent ${prudent.procente.pensie ?? 0}%, riscant ${riscant.procente.pensie ?? 0}%`;
    },

    'simulare: 40 de vieți cu alegeri aleatoare, până la final, fără erori'() {
      const r = simuleazaVieti(ctxNou(), { n: 40, seed: 'test', laSfarsitDeAn: verificaInvarianti });
      ok(!r.finaluri.neterminat, 'toate viețile s-au terminat');
      return `finaluri: ${JSON.stringify(r.finaluri)}`;
    },
  };
}

export async function ruleazaTeste(citeste, log = console.log) {
  const incarcare = await incarcaContinut(citeste);
  for (const a of incarcare.avertismente) log(`  ⚠ ${formateazaEroare(a)}`);
  const toate = teste(incarcare.ctx, incarcare);
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
