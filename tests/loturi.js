// Testele extinderii, grupate pe loturi. Primesc ajutoarele din tests/suite.js.

import { ACTIUNI, actiune, alege, avanseaza, forteazaEveniment, oprireCurenta } from '../js/engine.js';
import { textRezultat } from '../js/events.js';
import { baniDisponibili, creeazaProdus, datorieProdus, pret } from '../js/finance.js';
import { bilantEducatie, descrieCurs, descrieProgram, proceseazaCursuriLuna, proceseazaStudiiLuna } from '../js/educatie.js';
import { indeplinesteCerinte } from '../js/cariera.js';
import { costRamasCredit, listaDatorii, simuleazaConsolidare, simuleazaRambursare } from '../js/datorii.js';
import { descrieActivitati, timpPeAn, timpRamas } from '../js/activitati.js';
import { creeazaStorageMemorie } from '../js/storage.js';
import { VERSIUNE_SALVARE, adaugaCheckpoint, areFlag, incarcaCheckpoint, incarcaJoc, listaCheckpointuri, salveazaJoc } from '../js/state.js';
import { cloneaza, inBani } from '../js/util.js';

export function testeLoturi(ctxBaza, a) {
  return {
    ...lot0(ctxBaza, a),
    ...lot1(ctxBaza, a),
    ...lot2(ctxBaza, a),
    ...lot3(ctxBaza, a),
  };
}

// ---------- Lotul 3: Educație ----------

function lot3(ctxBaza, a) {
  const { ok, egal } = a;
  // Joc între ani, fără studii în curs, la vârsta cerută.
  const jocLaVarsta = (seed, varsta, { faraJob = true } = {}) => {
    const { ctx, state } = faraJob ? a.jocFaraVenit(seed) : a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.situatie.studii = null;
    state.luna = (varsta - 18) * 12;
    state.numerar = inBani(100_000);
    return { ctx, state };
  };
  const treciLuni = (state, ctx, n) => {
    for (let i = 0; i < n && !state.final; i += 12) a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
  };
  return {
    'lotul 3: facultate cu taxă la 30 de ani: taxa anuală, apoi licența'() {
      const { ctx, state } = jocLaVarsta('fac30', 30);
      const inainte = baniDisponibili(state);
      const r = actiune(state, ctx, 'inscrieProgram', { program: 'facultateTaxa' });
      ok(r.ok, r.mesaj);
      ok(state.situatie.studii?.id === 'facultateTaxa', 'e la facultate');
      treciLuni(state, ctx, 36);
      egal(state.situatie.nivelStudii, 'licenta', 'are licența după 3 ani');
      ok(inainte - baniDisponibili(state) > 0, 'a plătit taxe');
      ok(state.bilant.costEducatieAzi > 0, 'costul educației e ținut minte pentru final');
    },

    'lotul 3: buget doar cu pregătire; bursa de merit vine lunar'() {
      const { ctx, state } = jocLaVarsta('buget', 20);
      state.ascunse.skill = 30;
      const r = actiune(state, ctx, 'inscrieProgram', { program: 'facultateBuget' });
      ok(!r.ok && /pregătire/.test(r.mesaj), `refuz cu motiv: ${r.mesaj}`);
      state.ascunse.skill = 70;
      ok(actiune(state, ctx, 'inscrieProgram', { program: 'facultateBuget' }).ok, 'cu pregătire intră');
      ok(state.situatie.studii.bursa, 'are bursă de merit');
      const numerar = baniDisponibili(state);
      state.recurente = [];
      const s = proceseazaStudiiLuna(state, ctx);
      ok(s.venit > 0 && baniDisponibili(state) === numerar + s.venit, 'bursa intră în cont');
    },

    'lotul 3: taxa plătită cu credit de studii: credit nou, fără taxă anuală; masterul cere licență'() {
      const { ctx, state } = jocLaVarsta('credit-studii', 19);
      ok(!actiune(state, ctx, 'inscrieProgram', { program: 'master' }).ok, 'fără licență, fără master');
      const r = actiune(state, ctx, 'inscrieProgram', { program: 'facultateTaxa', credit: true });
      ok(r.ok, r.mesaj);
      const c = state.produse.find((p) => p.tip === 'credit' && p.furnizor === 'studii');
      ok(c && c.sumaInitiala === 3 * pret(state, ctx, 'studii.facultateTaxa.taxaAnuala'), 'creditul acoperă 3 ani de taxă');
      state.situatie.studii.inceputLa = state.luna; // luna asta ar fi scadentă taxa
      egal(proceseazaStudiiLuna(state, ctx).cheltuiala, 0, 'nu se mai plătește taxa anuală');
      ok(actiune(state, ctx, 'renuntaStudii').ok && !state.situatie.studii, 'poți renunța');
    },

    'lotul 3: bootcamp-ul ține loc de diplomă la programator junior'() {
      const { ctx, state } = jocLaVarsta('bootcamp', 22);
      state.ascunse.skill = 50;
      const job = ctx.joburi.get('programator-junior');
      ok(!indeplinesteCerinte(job, state, ctx), 'fără licență și fără certificat: nu');
      const timp = timpRamas(state, ctx);
      const bani = baniDisponibili(state);
      ok(actiune(state, ctx, 'inscrieCurs', { curs: 'bootcamp-it' }).ok, 'înscris la bootcamp');
      egal(timpRamas(state, ctx), timp - 2, 'bootcamp-ul ia 2 acțiuni de timp');
      egal(bani - baniDisponibili(state), pret(state, ctx, 'cursuri.bootcampIT'), 'a plătit cursul');
      ok(!actiune(state, ctx, 'inscrieCurs', { curs: 'bootcamp-it' }).ok, 'nu te înscrii de două ori');
      for (let i = 0; i < 6; i++) proceseazaCursuriLuna(state, ctx);
      ok(areFlag(state, 'certificat_it'), 'are certificatul');
      ok(state.ascunse.skill >= 60, 'pregătirea a crescut');
      ok(indeplinesteCerinte(job, state, ctx), 'acum poate primi oferte de programator junior');
    },

    'lotul 3: cursul gratuit chiar e gratuit; bilanțul educației la final'() {
      const { ctx, state } = jocLaVarsta('gratis', 25);
      const bani = baniDisponibili(state);
      ok(actiune(state, ctx, 'inscrieCurs', { curs: 'educatie-financiara' }).ok, 'înscris');
      egal(baniDisponibili(state), bani, 'n-a plătit nimic');
      egal(bilantEducatie(state, ctx), null, 'fără studii peste liceu și fără cheltuieli: nimic de arătat încă');
      ok(actiune(state, ctx, 'inscrieCurs', { curs: 'engleza' }).ok, 'curs plătit');
      const b = bilantEducatie(state, ctx);
      ok(b && b.cost > 0, 'costul apare în bilanț');
    },

    'lotul 3: fiecare program și curs din conținut are o descriere completă'() {
      const { ctx, state } = jocLaVarsta('descrieri', 25);
      for (const p of ctx.educatie.programe.values()) {
        const d = descrieProgram(state, ctx, p);
        ok(d.luni > 0 && (d.disponibil || d.motiv), `${p.id}: durată și disponibilitate`);
      }
      for (const c of ctx.educatie.cursuri.values()) {
        const d = descrieCurs(state, ctx, c);
        ok(d.luni > 0 && (d.disponibil || d.motiv), `${c.id}: durată și disponibilitate`);
      }
      return `${ctx.educatie.programe.size} programe, ${ctx.educatie.cursuri.size} cursuri`;
    },
  };
}

// ---------- Lotul 2: Datoriile mele ----------

function lot2(ctxBaza, a) {
  const { ok, egal } = a;
  const jocCuDatorii = (seed) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.numerar = inBani(100_000);
    const credit = (spec) => {
      const p = creeazaProdus({ tip: 'credit', ...spec, suma: inBani(spec.suma) }, state, ctx);
      state.produse.push(p);
      return p;
    };
    return { ctx, state, credit };
  };
  return {
    'lotul 2: lista arată toate datoriile, cu sold, rată, DAE și costul total rămas'() {
      const { ctx, state, credit } = jocCuDatorii('lista');
      const c = credit({ furnizor: 'banca', suma: 10_000, dae: 0.12, luni: 24 });
      const f = creeazaProdus({ tip: 'factura', categorie: 'telefon' }, state, ctx);
      f.restanta = inBani(100); f.luniRestanta = 1;
      state.produse.push(f);
      const card = creeazaProdus({ tip: 'cardCredit' }, state, ctx);
      card.soldScadent = inBani(2000);
      state.produse.push(card);
      const lista = listaDatorii(state, ctx);
      const dc = lista.find((d) => d.id === c.id);
      ok(dc && dc.rata > 0 && dc.dae === 0.12 && dc.luniRamase === 24, 'creditul are rată, DAE și durată');
      ok(dc.costRamas > c.rest, 'costul total rămas include dobânda');
      ok(lista.find((d) => d.id === f.id)?.restanta === f.restanta, 'factura restantă apare');
      const dCard = lista.find((d) => d.id === card.id);
      ok(dCard.doarMinim.total > card.soldScadent && dCard.doarMinim.luni > 12, 'la card: costul plății minime');
    },

    'lotul 2: rambursarea parțială economisește dobândă; „termin mai repede” economisește mai mult'() {
      const { ctx, state, credit } = jocCuDatorii('partial');
      const c = credit({ furnizor: 'banca', suma: 20_000, dae: 0.12, luni: 60, variabila: false });
      const r = simuleazaRambursare(c, inBani(5000), 'rata', ctx);
      const t = simuleazaRambursare(c, inBani(5000), 'durata', ctx);
      ok(r.economie > 0 && t.economie > r.economie, `economii: rată ${r.economie}, durată ${t.economie}`);
      ok(r.rataNoua < c.rata && t.luniNoi < c.luniRamase, 'rata scade, respectiv durata scade');
      const cost = costRamasCredit(c);
      const rez = actiune(state, ctx, 'ramburseazaPartial', { id: c.id, suma: 5000, mod: 'durata' });
      ok(rez.ok, rez.mesaj);
      egal(cost - costRamasCredit(c) - inBani(5000) - t.comision, t.economie, 'economia anunțată e cea reală');
      ok(state.concepte.includes('rambursare-anticipata'), 'conceptul s-a deblocat');
      const tot = actiune(state, ctx, 'ramburseazaPartial', { id: c.id, suma: 1_000_000, mod: 'rata' });
      ok(tot.ok && !state.produse.includes(c), 'o sumă cât tot creditul îl închide');
    },

    'lotul 2: lecția spune metoda folosită (avalanșă / bulgăre de zăpadă)'() {
      const { ctx, state, credit } = jocCuDatorii('metoda');
      const scump = credit({ furnizor: 'ifn', suma: 5000, dae: 1.2, luni: 12 });
      const mic = credit({ furnizor: 'banca', suma: 1000, dae: 0.12, luni: 12 });
      credit({ furnizor: 'banca', suma: 8000, dae: 0.15, luni: 24 });
      const r1 = actiune(state, ctx, 'ramburseazaPartial', { id: scump.id, suma: 500, mod: 'durata' });
      ok(/avalanșă/.test(r1.lectie), `avalanșă: ${r1.lectie}`);
      const r2 = actiune(state, ctx, 'ramburseazaPartial', { id: mic.id, suma: 100, mod: 'durata' });
      ok(/bulgărelui/.test(r2.lectie), `bulgăre: ${r2.lectie}`);
      ok(state.concepte.includes('avalansa-bulgare'), 'conceptul s-a deblocat');
    },

    'lotul 2: plata restanței oprește întârzierea'() {
      const { ctx, state, credit } = jocCuDatorii('restanta');
      const c = credit({ furnizor: 'banca', suma: 5000, dae: 0.12, luni: 12 });
      c.restanta = inBani(500); c.luniRestanta = 2;
      const r = actiune(state, ctx, 'platesteRestanta', { id: c.id });
      ok(r.ok, r.mesaj);
      egal(c.restanta, 0, 'restanța e zero');
      egal(c.luniRestanta, 0, 'nu mai e în întârziere');
    },

    'lotul 2: eșalonarea la recuperator oprește executarea; întârzierile o anulează'() {
      const { ctx, state, credit } = jocCuDatorii('esalonare');
      const c = credit({ furnizor: 'banca', suma: 3000, dae: 0.12, luni: 12 });
      Object.assign(c, { stadiu: 'cesionat', furnizor: 'recuperator', rest: 0, restanta: inBani(3000), luniRestanta: 6 });
      const r = actiune(state, ctx, 'esaloneaza', { id: c.id, luni: 12 });
      ok(r.ok, r.mesaj);
      ok(c.stadiu === 'activ' && c.esalonat && c.luniRestanta === 0, 'datoria e acum în rate');
      ok(state.concepte.includes('esalonare'), 'conceptul s-a deblocat');
      // Fără bani, ratele nu se plătesc: după câteva luni, înțelegerea se anulează.
      state.recurente = [];
      for (const p of state.produse) if (p.tip === 'contractMunca') state.produse = state.produse.filter((x) => x !== p);
      state.numerar = 0;
      for (const p of state.produse) if (p.tip === 'contCurent' || p.tip === 'contEconomii') p.sold = 0;
      for (let i = 0; i < 4 && !state.final; i++) a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      ok(!state.produse.some((p) => p.esalonat), 'eșalonarea nu mai există');
      ok(state.jurnal.some((j) => /eșalonare: înțelegerea s-a anulat|ratele din eșalonare/.test(j.text)), 'jurnalul spune că s-a anulat');
    },

    'lotul 2: refinanțarea: refuzată cu istoric prost sau grad de îndatorare mare; altfel închide datoriile vechi'() {
      const { ctx, state, credit } = jocCuDatorii('consolidare');
      const ifn = credit({ furnizor: 'ifn', suma: 3000, dae: 1.2, luni: 12 });
      const card = creeazaProdus({ tip: 'cardCredit' }, state, ctx);
      card.soldScadent = inBani(2500);
      state.produse.push(card);
      state.flaguri.istoric_restante = { setatLa: 0, expiraLa: null };
      ok(/Biroul de Credit/.test(actiune(state, ctx, 'consolideaza', { ids: [ifn.id, card.id], luni: 36 }).mesaj), 'istoricul prost blochează');
      delete state.flaguri.istoric_restante;
      state.ascunse.scorCredit = 70;
      const sim = simuleazaConsolidare(state, ctx, [ifn.id, card.id], 36);
      ok(sim.ok && sim.rataNoua < sim.rateVechi, `rata nouă mai mică: ${sim.mesaj ?? ''}`);
      const mare = credit({ furnizor: 'banca', suma: 400_000, dae: 0.12, luni: 24 });
      ok(/îndatorare|venitul tău net/.test(simuleazaConsolidare(state, ctx, [ifn.id], 36).mesaj ?? ''), 'gradul de îndatorare mare blochează');
      state.produse = state.produse.filter((p) => p !== mare);
      const r = actiune(state, ctx, 'consolideaza', { ids: [ifn.id, card.id], luni: 36 });
      ok(r.ok, r.mesaj);
      ok(!state.produse.includes(ifn) && datorieProdus(card) === 0, 'datoriile vechi sunt închise');
      ok(state.produse.some((p) => p.tip === 'credit' && p.furnizor === 'refinantare' && p.rest === sim.suma), 'creditul nou are suma lor');
      ok(r.lectie && state.concepte.includes('refinantare'), 'lecție și concept');
    },
  };
}

// ---------- Lotul 1: activități și bugetul de timp; migrarea salvărilor ----------

function lot1(ctxBaza, a) {
  const { ok, egal } = a;
  // Joc între ani (nicio decizie deschisă), cu bani.
  const jocLiber = (seed, faraJob = false) => {
    const { ctx, state } = faraJob ? a.jocFaraVenit(seed) : a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.numerar = inBani(50_000);
    return { ctx, state };
  };
  return {
    'lotul 1: bugetul de timp depinde de job și se termină; anul următor se reface'() {
      const { ctx, state } = jocLiber('timp', true);
      egal(timpPeAn(state, ctx), ctx.balans.timp.baza, 'fără job și fără studii: bugetul de bază');
      const cuJob = jocLiber('timp-job');
      ok(timpPeAn(cuJob.state, cuJob.ctx) < ctx.balans.timp.baza, 'un job full-time lasă mai puțin timp');
      const total = timpRamas(state, ctx);
      for (let i = 0; i < total; i++) ok(actiune(state, ctx, 'activitate', { activitate: i % 2 ? 'alergare' : 'odihna' }).ok, `activitatea ${i + 1} trece`);
      egal(timpRamas(state, ctx), 0, 'timpul s-a terminat');
      const r = actiune(state, ctx, 'activitate', { activitate: 'alergare' });
      ok(!r.ok && /timpul/.test(r.mesaj), `fără timp: refuz cu motiv („${r.mesaj}”)`);
      a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      if (!state.final) egal(timpRamas(state, ctx), timpPeAn(state, ctx), 'după un an, bugetul e din nou întreg');
    },

    'lotul 1: activitatea plătită scade banii și aplică efectele; fără bani e refuzată cu motiv'() {
      const { ctx, state } = jocLiber('sala', true);
      const inainte = baniDisponibili(state);
      const energie = state.stat.energie;
      const r = actiune(state, ctx, 'activitate', { activitate: 'sala' });
      ok(r.ok, r.mesaj);
      ok(baniDisponibili(state) < inainte, 'abonamentul s-a plătit');
      ok(state.stat.energie > energie || state.stat.energie === 100, 'energia a crescut');
      ok(state.concepte.includes('abonamente'), 'conceptul s-a deblocat');
      state.numerar = 0;
      for (const p of state.produse) if (p.tip === 'contCurent') p.sold = 0;
      const fara = descrieActivitati(state, ctx).find((x) => x.id === 'vacanta-mare');
      ok(!fara.disponibil && /lei/.test(fara.motiv), `motivul arată suma: ${fara.motiv}`);
    },

    'lotul 1: „maxPeAn” și flag-urile din activități (hobby, voluntariat pentru CV)'() {
      const { ctx, state } = jocLiber('hobby', true);
      ok(!descrieActivitati(state, ctx).find((x) => x.id === 'exersezi-hobby').disponibil, 'fără hobby nu poți exersa');
      ok(actiune(state, ctx, 'activitate', { activitate: 'hobby' }).ok, 'te apuci de hobby');
      ok(descrieActivitati(state, ctx).find((x) => x.id === 'exersezi-hobby').disponibil, 'acum poți exersa');
      ok(actiune(state, ctx, 'activitate', { activitate: 'voluntariat' }).ok, 'voluntariat');
      ok(areFlag(state, 'cv_voluntariat'), 'voluntariatul intră în CV');
      ok(actiune(state, ctx, 'activitate', { activitate: 'vacanta-mare' }).ok, 'prima vacanță la mare');
      const r = actiune(state, ctx, 'activitate', { activitate: 'vacanta-mare' });
      ok(!r.ok && /deja/.test(r.mesaj), `a doua vacanță la mare în același an e refuzată („${r.mesaj}”)`);
    },

    'lotul 1: fiecare activitate din conținut se poate face și are rezultat; norocul nu schimbă evenimentele'() {
      let n = 0;
      for (const act of ctxBaza.activitati.values()) {
        const { ctx, state } = jocLiber(`act-${act.id}`, true);
        state.luna = 36; // 21 de ani: peste pragurile de vârstă din activități
        if (act.conditii?.flag?.includes('are_hobby')) state.flaguri.are_hobby = { setatLa: 0, expiraLa: null };
        if (act.conditii?.job) {
          const cuJob = jocLiber(`act-${act.id}-job`);
          Object.assign(state, cuJob.state);
        }
        const rngEv = state.rng.evenimente;
        const r = actiune(state, ctx, 'activitate', { activitate: act.id });
        ok(r.ok, `${act.id}: ${r.mesaj}`);
        ok(r.mesaj && r.mesaj.length > 5, `${act.id}: mesaj gol`);
        egal(state.rng.evenimente, rngEv, `${act.id}: fluxul de evenimente nu se atinge`);
        n += 1;
      }
      ok(n >= 12, `prea puține activități: ${n}`);
      return `${n} activități`;
    },

    'lotul 1: căutatul unui job consumă timp'() {
      const { ctx, state } = jocLiber('cauta', true);
      const inainte = timpRamas(state, ctx);
      const r = actiune(state, ctx, 'cautaJob');
      ok(r.ok, r.mesaj);
      egal(timpRamas(state, ctx), inainte - ctx.balans.timp.costCautareJob, 'timpul a scăzut');
    },

    'lotul 1: o salvare veche (versiunea 1) și checkpoint-urile ei se încarcă și se joacă mai departe'() {
      const { ctx, state } = jocLiber('migrare', true);
      const veche = cloneaza(state);
      veche.versiune = 1;
      delete veche.timp;
      delete veche.rng.actiuni;
      const storage = creeazaStorageMemorie();
      salveazaJoc(storage, veche);
      adaugaCheckpoint(storage, veche, 'vechi');
      const s = incarcaJoc(storage);
      ok(s, 'salvarea veche nu se pierde');
      egal(s.versiune, VERSIUNE_SALVARE, 'versiunea e adusă la zi');
      ok(s.timp && typeof s.rng.actiuni === 'number', 'câmpurile noi sunt completate');
      ok(actiune(s, ctx, 'activitate', { activitate: 'alergare' }).ok, 'activitățile merg pe salvarea migrată');
      a.consuma(s, ctx, avanseaza(s, ctx), a.primaDisponibila);
      a.verificaInvarianti(s);
      const cp = incarcaCheckpoint(storage, listaCheckpointuri(storage)[0].id);
      egal(cp.versiune, VERSIUNE_SALVARE, 'și checkpoint-ul e migrat');
      const viitoare = { ...cloneaza(state), versiune: VERSIUNE_SALVARE + 1 };
      salveazaJoc(storage, viitoare);
      egal(incarcaJoc(storage), null, 'o salvare dintr-o versiune mai nouă nu se încarcă pe jumătate');
    },
  };
}

// ---------- Lotul 0: fiecare acțiune și fiecare decizie are un rezultat vizibil ----------

// Un joc cu o restanță la utilități, creată ca în motor (luna în care banii n-au ajuns).
function jocCuRestante(a, seed) {
  const { ctx, state } = a.jocCuJob(seed);
  const f = creeazaProdus({ tip: 'factura', categorie: 'utilitati', cauza: null }, state, ctx);
  f.restanta = inBani(300);
  f.luniRestanta = 1;
  state.produse.push(f);
  return { ctx, state };
}

function lot0(ctxBaza, a) {
  const { ok, egal } = a;
  return {
    'lotul 0: restanța la o factură se plătește din meniul Bancă, cu mesaj'() {
      const { ctx, state } = jocCuRestante(a, 'restante');
      const factura = state.produse.find((p) => p.tip === 'factura');
      ok(factura, 'jocul de test trebuie să aibă o restanță la facturi');
      state.numerar = 10_000_000;
      const r = actiune(state, ctx, 'ramburseaza', { id: factura.id });
      ok(r.ok, `plata trebuie acceptată, nu: ${r.mesaj}`);
      ok(/restanță la/.test(r.mesaj), `mesajul spune ce s-a plătit: ${r.mesaj}`);
      ok(!state.produse.includes(factura), 'factura achitată dispare din datorii');
    },

    'lotul 0: fiecare acțiune din meniuri întoarce un mesaj (reușită sau motiv)'() {
      const { ctx, state } = a.jocCuJob('mesaje');
      state.numerar = 5_000_000;
      const id = (tip) => state.produse.find((p) => p.tip === tip)?.id;
      actiune(state, ctx, 'deschide', { tip: 'contEconomii' });
      const cazuri = {
        deschide: [{ tip: 'depozit', suma: 1000 }, { tip: 'depozit' }, { tip: 'credit' }],
        seteaza: [{ id: id('contEconomii'), campuri: { fondUrgenta: true } }, { id: id('contEconomii'), campuri: { sold: 1 } }],
        depune: [{ id: id('contEconomii'), suma: 500 }, { id: id('contEconomii') }, { id: id('contEconomii'), suma: 1e9 }],
        retrage: [{ id: id('contEconomii'), suma: 100 }, { id: id('contEconomii'), suma: 1e9 }],
        lichideaza: [{ id: id('depozit') }, { id: 'inexistent' }],
        ramburseaza: [{ id: id('contCurent') }],
        cumpara: [{ suma: 50, eticheta: 'o carte' }, { suma: 0 }],
        stilViata: [{ nivel: 'confortabil' }, { nivel: 'confortabil' }],
        cereMarire: [{}],
        cautaJob: [{}],
        activitate: [{ activitate: 'alergare' }, { activitate: 'nu-exista' }, { activitate: 'exersezi-hobby' }],
        platesteRestanta: [{ id: id('contCurent') }, {}],
        ramburseazaPartial: [{ id: id('contCurent'), suma: 100 }],
        esaloneaza: [{ id: id('contCurent'), luni: 12 }, {}],
        consolideaza: [{ ids: [], luni: 36 }, { ids: [id('contEconomii')], luni: 36 }],
        inscrieProgram: [{ program: 'nu-exista' }, { program: 'master' }],
        renuntaStudii: [{}],
        inscrieCurs: [{ curs: 'educatie-financiara' }, { curs: 'educatie-financiara' }],
      };
      for (const tip of ACTIUNI) ok(cazuri[tip], `acțiunea „${tip}” nu are caz de test`);
      let n = 0;
      for (const tip of ACTIUNI) {
        for (const param of cazuri[tip]) {
          const r = actiune(state, ctx, tip, param);
          ok(typeof r.mesaj === 'string' && r.mesaj.trim().length > 3, `${tip} ${JSON.stringify(param)} n-a întors mesaj: ${JSON.stringify(r)}`);
          ok(!/necunoscut/i.test(r.mesaj), `${tip}: ${r.mesaj}`);
          n += 1;
          if (state.pendinte) state.pendinte = null; // cautaJob deschide CV-ul
        }
      }
      egal(actiune(state, ctx, 'zboara', {}).ok, false, 'o acțiune necunoscută e refuzată');
      return `${n} apăsări verificate`;
    },

    'lotul 0: fiecare alegere disponibilă din fiecare eveniment are un rezultat de afișat'() {
      const { ctx, state: baza } = a.jocCuJob('rezultate');
      baza.numerar = 20_000_000;
      let n = 0;
      const fara = [];
      for (const ev of ctx.evenimente.values()) {
        let o;
        const s0 = cloneaza(baza);
        try { o = forteazaEveniment(s0, ctx, ev.id); } catch { continue; }
        if (o?.tip !== 'eveniment') continue;
        const cai = o.alegeri.flatMap((x) => (x.grup ? x.subalegeri : [x])).filter((x) => x.disponibil).map((x) => x.cale);
        for (const cale of cai) {
          const s = cloneaza(s0);
          const r = alege(s, ctx, cale);
          n += 1;
          if (!textRezultat(r.rezultat)) fara.push(`${ev.id} › ${cale}`);
        }
      }
      ok(!fara.length, `alegeri fără rezultat:\n${fara.join('\n')}`);
      ok(n > 100, `prea puține alegeri verificate: ${n}`);
      return `${n} alegeri`;
    },
  };
}
