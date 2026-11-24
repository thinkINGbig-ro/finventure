// Testele extinderii, grupate pe loturi. Primesc ajutoarele din tests/suite.js.

import { ACTIUNI, actiune, alege, avanseaza, forteazaEveniment, oprireCurenta } from '../js/engine.js';
import { textRezultat } from '../js/events.js';
import { baniDisponibili, creeazaProdus } from '../js/finance.js';
import { descrieActivitati, timpPeAn, timpRamas } from '../js/activitati.js';
import { creeazaStorageMemorie } from '../js/storage.js';
import { VERSIUNE_SALVARE, adaugaCheckpoint, areFlag, incarcaCheckpoint, incarcaJoc, listaCheckpointuri, salveazaJoc } from '../js/state.js';
import { cloneaza, inBani } from '../js/util.js';

export function testeLoturi(ctxBaza, a) {
  return {
    ...lot0(ctxBaza, a),
    ...lot1(ctxBaza, a),
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
