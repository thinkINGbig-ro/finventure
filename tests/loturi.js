// Testele extinderii, grupate pe loturi. Primesc ajutoarele din tests/suite.js.

import { ACTIUNI, actiune, alege, forteazaEveniment } from '../js/engine.js';
import { textRezultat } from '../js/events.js';
import { creeazaProdus } from '../js/finance.js';
import { cloneaza, inBani } from '../js/util.js';

export function testeLoturi(ctxBaza, a) {
  return {
    ...lot0(ctxBaza, a),
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
