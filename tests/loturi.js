// Testele extinderii, grupate pe loturi. Primesc ajutoarele din tests/suite.js.

import { ACTIUNI, actiune, alege, avanseaza, forteazaEveniment, oprireCurenta } from '../js/engine.js';
import { textRezultat } from '../js/events.js';
import { baniDisponibili, creeazaProdus, datorieProdus, pret, valoareProdus } from '../js/finance.js';
import { aplicaComisioaneAnuale, miscaCompanii, portofoliu, proceseazaDCA } from '../js/investitii.js';
import { actualizeazaImobileAnual, proceseazaImobile, simuleazaCumparare, simuleazaVanzare } from '../js/imobiliare.js';
import { bilantEducatie, descrieCurs, descrieProgram, proceseazaCursuriLuna, proceseazaStudiiLuna } from '../js/educatie.js';
import { indeplinesteCerinte, luniPanaLaPromovare, schimbaJob } from '../js/cariera.js';
import { proceseazaSecundar, simuleazaOreSuplimentare, venitArtistLuna } from '../js/munca.js';
import { pregatire, proceseazaAfacere, simuleazaPornire } from '../js/afacere.js';
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
    ...lot4a(ctxBaza, a),
    ...lot4b(ctxBaza, a),
    ...lot5(ctxBaza, a),
    ...lot6a(ctxBaza, a),
  };
}

// ---------- Lotul 6a: afacerea proprie (pornire, luna firmei, răspundere, închidere) ----------

function lot6a(ctxBaza, a) {
  const { ok, egal } = a;
  const flag = (state, f) => { state.flaguri[f] = { setatLa: 0, expiraLa: null }; };
  const jocAntreprenor = (seed, bani = 300_000) => {
    const { ctx, state } = a.jocFaraVenit(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.luna = 10 * 12;
    state.numerar = inBani(bani);
    state.recurente = [];
    state.an = { start: state.luna, lunaCrash: null, ac: { venituri: 0, taxe: 0, cheltuieliTrai: 0 } };
    return { ctx, state };
  };
  const luni = (state, ctx, n) => { for (let i = 0; i < n; i++) { proceseazaAfacere(state, ctx); state.luna += 1; } };
  return {
    'lotul 6a: pregătirea crește cu planul, studiul de piață, cursul și experiența'() {
      const { ctx, state } = jocAntreprenor('pregatire');
      const p0 = pregatire(state, ctx, 'cafenea').total;
      ok(actiune(state, ctx, 'faPlanAfaceri').ok, 'plan');
      ok(actiune(state, ctx, 'faStudiuPiata', { domeniu: 'cafenea' }).ok, 'studiu');
      flag(state, 'curs_antreprenoriat');
      flag(state, 'experienta_horeca');
      const p = pregatire(state, ctx, 'cafenea');
      ok(p.total >= p0 + 60, `pregătirea: ${p0} → ${p.total}`);
      ok(pregatire(state, ctx, 'it').parti.experienta === 0, 'experiența din HoReCa nu contează la IT');
    },

    'lotul 6a: pregătirea decide rezultatul, nu zarul (aceleași luni, pregătire mică vs. mare)'() {
      const profit = (pregatireTotal) => {
        const { ctx, state } = jocAntreprenor('zar');
        state.timp = { an: Math.floor(state.luna / 12), folosit: 0, activitati: {} };
        ok(actiune(state, ctx, 'pornesteAfacere', { domeniu: 'cafenea', forma: 'srl' }).ok, 'pornită');
        const af = state.produse.find((p) => p.tip === 'afacere');
        af.pregatire = pregatireTotal;
        luni(state, ctx, 36);
        return af.istoric.reduce((s, x) => s + x.profit, 0);
      };
      const slab = profit(15);
      const bun = profit(85);
      ok(slab < 0 && bun > 0, `profit pe ultimele 24 de luni: slab ${slab / 100} lei, bun ${bun / 100} lei`);
    },

    'lotul 6a: la PFA pierderile se plătesc din banii tăi; la SRL nu, dar vine insolvența (creditul garantat rămâne al tău)'() {
      // PFA cu pregătire foarte slabă: banii personali scad
      const pfa = jocAntreprenor('pfa');
      ok(actiune(pfa.state, pfa.ctx, 'pornesteAfacere', { domeniu: 'constructii', forma: 'pfa' }).ok, 'PFA pornit');
      const af1 = pfa.state.produse.find((p) => p.tip === 'afacere');
      af1.pregatire = 0;
      const bani1 = baniDisponibili(pfa.state);
      luni(pfa.state, pfa.ctx, 12);
      ok(baniDisponibili(pfa.state) < bani1, 'la PFA, pierderile au ieșit din banii tăi');
      // SRL cu credit garantat: banii personali nu se ating; după câteva luni de datorii, insolvență
      const srl = jocAntreprenor('srl');
      flag(srl.state, 'plan_afaceri');
      flag(srl.state, 'curs_antreprenoriat');
      srl.state.ascunse.skill = 90;
      const r = actiune(srl.state, srl.ctx, 'pornesteAfacere', { domeniu: 'turism', forma: 'srl', credit: true });
      ok(r.ok, r.mesaj);
      const af2 = srl.state.produse.find((p) => p.tip === 'afacere');
      ok(af2.garantiePersonala && af2.credit, 'creditul e al firmei, garantat de tine');
      af2.pregatire = 0;
      const bani2 = baniDisponibili(srl.state);
      luni(srl.state, srl.ctx, 30);
      ok(!srl.state.produse.includes(af2), 'firma a intrat în insolvență');
      egal(baniDisponibili(srl.state), bani2, 'banii tăi personali n-au fost atinși');
      ok(srl.state.produse.some((p) => p.tip === 'credit' && p.furnizor === 'garantieFirma'), 'doar creditul garantat a trecut pe numele tău');
      ok(srl.state.jurnal.some((j) => /insolvență/.test(j.text)), 'jurnalul explică');
    },

    'lotul 6a: dividendele de la SRL se impozitează; la PFA banii vin direct; închiderea întoarce restul'() {
      const { ctx, state } = jocAntreprenor('dividende');
      ok(actiune(state, ctx, 'pornesteAfacere', { domeniu: 'arta', forma: 'srl' }).ok, 'SRL');
      const af = state.produse.find((p) => p.tip === 'afacere');
      af.cont = inBani(10_000);
      const bani = baniDisponibili(state);
      ok(actiune(state, ctx, 'retrageDinFirma', { suma: 1000 }).ok, 'dividende');
      egal(baniDisponibili(state) - bani, inBani(800), '20% impozit + CASS pe dividende');
      ok(state.concepte.includes('dividende'), 'concept');
      const inainte = baniDisponibili(state);
      ok(actiune(state, ctx, 'inchideAfacere').ok, 'închisă');
      ok(baniDisponibili(state) > inainte && !state.produse.includes(af), 'restul banilor firmei s-a întors');
    },

    'lotul 6a: creditul pentru firmă cere plan și pregătire; fără bani nu pornești'() {
      const { ctx, state } = jocAntreprenor('credit-firma');
      const r = simuleazaPornire(state, ctx, 'cafenea', 'srl', { credit: true });
      ok(!r.ok && /plan de afaceri/.test(r.mesaj), r.mesaj);
      const sarac = jocAntreprenor('sarac', 5000);
      const r2 = simuleazaPornire(sarac.state, sarac.ctx, 'turism', 'pfa', {});
      ok(!r2.ok && /Îți trebuie/.test(r2.mesaj), r2.mesaj);
    },
  };
}

// ---------- Lotul 5: joburi și muncă ----------

function lot5(ctxBaza, a) {
  const { ok, egal } = a;
  const flag = (state, f) => { state.flaguri[f] = { setatLa: 0, expiraLa: null }; };
  const jocAngajat = (seed, jobId = 'curier', brut = 6000) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    schimbaJob(state, ctx, { id: jobId, contract: 'cim', brut: inBani(brut) });
    state.numerar = inBani(50_000);
    state.situatie.studii = null;
    return { ctx, state };
  };
  return {
    'lotul 5: joburi noi cu cerințe: permis pentru șofer, diplomă de medicină pentru medic'() {
      const { ctx, state } = jocAngajat('cerinte');
      const sofer = ctx.joburi.get('sofer');
      ok(!indeplinesteCerinte(sofer, state, ctx), 'fără permis: nu');
      flag(state, 'permis_auto');
      ok(indeplinesteCerinte(sofer, state, ctx), 'cu permis: da');
      const medic = ctx.joburi.get('medic-rezident');
      state.ascunse.skill = 70;
      state.situatie.nivelStudii = 'licenta';
      ok(!indeplinesteCerinte(medic, state, ctx), 'licența obișnuită nu ajunge');
      state.situatie.studii = { id: 'medicina', luniRamase: 1, inceputLa: state.luna };
      for (let i = 0; i < 12 && state.situatie.studii; i++) a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      ok(areFlag(state, 'absolvent_medicina'), 'medicina terminată');
      ok(indeplinesteCerinte(medic, state, ctx), 'acum poate fi medic rezident');
      ok(ctx.joburi.size >= 50, `joburi: ${ctx.joburi.size}`);
      return `${ctx.joburi.size} joburi`;
    },

    'lotul 5: artistul are venit variabil și faimă; mărirea nu există'() {
      const { ctx, state } = jocAngajat('artist');
      state.ascunse.skill = 50;
      const r0 = actiune(state, ctx, 'devinoArtist', { job: 'pictor' });
      ok(!r0.ok && /hobby/.test(r0.mesaj), `fără hobby: ${r0.mesaj}`);
      flag(state, 'are_hobby');
      ok(actiune(state, ctx, 'devinoArtist', { job: 'pictor' }).ok, 'devine pictor');
      const c = state.produse.find((p) => p.tip === 'contractMunca');
      egal(c.contract, 'pfa', 'pe cont propriu');
      const venituri = [];
      for (let i = 0; i < 36; i++) venituri.push(venitArtistLuna(state, ctx, c, ctx.joburi.get('pictor')));
      const medie = venituri.reduce((s, x) => s + x, 0) / venituri.length;
      const abatere = Math.sqrt(venituri.reduce((s, x) => s + (x - medie) ** 2, 0) / venituri.length);
      ok(abatere / medie > 0.3, `venitul variază mult (abatere/medie ${(abatere / medie).toFixed(2)})`);
      ok(c.faima !== ctx.balans.cariera.artist.faimaStart, 'faima s-a mișcat');
      ok(!actiune(state, ctx, 'cereMarire').ok, 'nicio mărire la artist');
      ok(state.concepte.includes('venit-variabil'), 'concept');
    },

    'lotul 5: ritmul intens obosește, dar crește reputația și scurtează drumul spre promovare'() {
      const rul = (r) => {
        const { ctx, state } = jocAngajat('ritm', 'vanzator');
        actiune(state, ctx, 'seteazaRitm', { ritm: r });
        const rep = state.ascunse.reputatie;
        const luni = luniPanaLaPromovare(state, ctx);
        a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
        return { energie: state.stat.energie, rep: state.ascunse.reputatie - rep, luni };
      };
      const intens = rul('intens');
      const relaxat = rul('relaxat');
      ok(intens.energie < relaxat.energie, `energie: intens ${intens.energie.toFixed(0)} < relaxat ${relaxat.energie.toFixed(0)}`);
      ok(intens.rep > relaxat.rep, 'reputația crește mai mult în ritm intens');
      ok(intens.luni < relaxat.luni, 'promovarea vine mai repede');
    },

    'lotul 5: orele suplimentare aduc bani cu spor și iau energie și timp'() {
      const { ctx, state } = jocAngajat('ore', 'curier', 6000);
      const bani = baniDisponibili(state);
      const energie = state.stat.energie;
      const timp = timpRamas(state, ctx);
      const sim = simuleazaOreSuplimentare(state, ctx);
      ok(actiune(state, ctx, 'oreSuplimentare').ok, 'ore suplimentare');
      egal(baniDisponibili(state) - bani, sim.net, 'banii net');
      ok(Math.abs(sim.brut - Math.round((inBani(6000) / 168) * 80 * 1.75)) < 2, 'sporul de 75%');
      ok(state.stat.energie < energie, 'obosește');
      egal(timpRamas(state, ctx), timp - 1, 'consumă o acțiune de timp');
    },

    'lotul 5: cursul plătit de firmă vine cu clauză; demisia în clauză costă'() {
      const { ctx, state } = jocAngajat('clauza');
      const c = state.produse.find((p) => p.tip === 'contractMunca');
      c.luniVechime = 5;
      ok(!actiune(state, ctx, 'cursFirma').ok, 'fără vechime: nu');
      c.luniVechime = 24;
      ok(actiune(state, ctx, 'cursFirma').ok, 'curs făcut');
      ok(areFlag(state, 'clauza_fidelitate'), 'clauza e activă');
      const bani = baniDisponibili(state);
      const r = actiune(state, ctx, 'demisie');
      ok(r.ok && /returnat/.test(r.mesaj), `demisie: ${r.mesaj}`);
      egal(bani - baniDisponibili(state), pret(state, ctx, 'munca.costCursFirma'), 'a returnat costul cursului');
      ok(!state.produse.some((p) => p.tip === 'contractMunca'), 'nu mai are job');
    },

    'lotul 5: jobul secundar aduce venit lunar, ia din timp; promovarea cerută are condiții'() {
      const { ctx, state } = jocAngajat('secundar', 'vanzator');
      state.ascunse.skill = 60;
      const timpInainte = timpPeAn(state, ctx);
      ok(actiune(state, ctx, 'incepeSecundar', { secundar: 'meditatii' }).ok, 'meditații');
      egal(timpPeAn(state, ctx), timpInainte - 1, 'un job în plus ia din timpul anului');
      const bani = baniDisponibili(state);
      const r = proceseazaSecundar(state, ctx);
      ok(r.net > 0 && baniDisponibili(state) === bani + r.net, 'venitul net intră');
      ok(!actiune(state, ctx, 'incepeSecundar', { secundar: 'livrari-weekend' }).ok, 'doar o activitate în plus odată');
      ok(actiune(state, ctx, 'opresteSecundar').ok, 'se oprește');
      const p = actiune(state, ctx, 'cerePromovare');
      ok(!p.ok && /luni/.test(p.mesaj), `prea devreme: ${p.mesaj}`);
      state.produse.find((x) => x.tip === 'contractMunca').luniVechime = 60;
      ok(actiune(state, ctx, 'cerePromovare').ok, 'promovat după vechime');
      egal(state.produse.find((x) => x.tip === 'contractMunca').jobId, 'sef-tura', 'acum e șef de tură');
    },
  };
}

// ---------- Lotul 4b: imobiliare de închiriat ----------

function lot4b(ctxBaza, a) {
  const { ok, egal } = a;
  const jocProprietar = (seed, { brut = 12_000, bani = 400_000 } = {}) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    const c = state.produse.find((p) => p.tip === 'contractMunca');
    if (c) Object.assign(c, { brut: inBani(brut), contract: 'cim' });
    state.numerar = inBani(bani);
    return { ctx, state };
  };
  return {
    'lotul 4b: cumperi cash, găsești chiriaș, chiria netă intră, costurile ies'() {
      const { ctx, state } = jocProprietar('cash');
      const bani = baniDisponibili(state);
      const sim = simuleazaCumparare(state, ctx, 'garsoniera', 'cash');
      ok(actiune(state, ctx, 'cumparaImobil', { marime: 'garsoniera', finantare: 'cash' }).ok, 'cumpărată');
      egal(bani - baniDisponibili(state), sim.valoare + sim.costuri, 'a plătit prețul plus costurile tranzacției');
      const p = state.produse.find((x) => x.tip === 'imobil');
      let venit = 0;
      let impozit = 0;
      for (let i = 0; i < 24; i++) { const r = proceseazaImobile(state, ctx); venit += r.venit; impozit += r.impozit; }
      ok(venit > 0 && p.chirieIncasata > 0, 'a încasat chirie');
      ok(Math.abs(impozit - venit / 9) < 200, 'impozitul pe chirie e 10%');
      ok(state.concepte.includes('randament-chirie'), 'concept');
    },

    'lotul 4b: cu credit: avans 25%, verificarea gradului de îndatorare; vânzarea închide creditul'() {
      const sarac = jocProprietar('credit-mic', { brut: 4000 });
      const r0 = actiune(sarac.state, sarac.ctx, 'cumparaImobil', { marime: 'apartament', finantare: 'credit' });
      ok(!r0.ok && /îndatorare|salariul tău net|%/.test(r0.mesaj), `salariu mic: refuz (${r0.mesaj})`);
      const { ctx, state } = jocProprietar('credit', { brut: 20_000 });
      const sim = simuleazaCumparare(state, ctx, 'garsoniera', 'credit');
      ok(sim.ok, sim.mesaj);
      ok(Math.abs(sim.credit - sim.valoare * 0.75) < 100, 'creditul e 75% din preț');
      ok(actiune(state, ctx, 'cumparaImobil', { marime: 'garsoniera', finantare: 'credit' }).ok, 'cumpărată cu credit');
      const p = state.produse.find((x) => x.tip === 'imobil');
      const credit = state.produse.find((x) => x.id === p.creditId);
      ok(credit && credit.furnizor === 'ipotecaInvestitie', 'are creditul de investiție');
      const v = simuleazaVanzare(state, ctx, p);
      egal(v.impozit, Math.round(p.valoare * 0.03), 'sub 3 ani: impozit 3%');
      const bani = baniDisponibili(state);
      ok(actiune(state, ctx, 'vindeImobil', { id: p.id }).ok, 'vândută');
      ok(!state.produse.includes(credit) && !state.produse.includes(p), 'creditul și proprietatea au dispărut');
      egal(baniDisponibili(state) - bani, v.net, 'banii primiți = prețul minus costuri, impozit și credit');
    },

    'lotul 4b: reparația amânată alungă chiriașul; valoarea și chiria cresc cu inflația'() {
      const { ctx, state } = jocProprietar('reparatie', { bani: 700_000 });
      ok(actiune(state, ctx, 'cumparaImobil', { marime: 'apartament', finantare: 'cash' }).ok, 'cumpărat');
      const p = state.produse.find((x) => x.tip === 'imobil');
      p.chirias = true;
      p.chirie = inBani(2800);
      forteazaEveniment(state, ctx, 'imobil-reparatie');
      alege(state, ctx, 'amana');
      egal(p.chirias, false, 'chiriașul a plecat');
      const valoare = p.valoare;
      actualizeazaImobileAnual(state, ctx, 0.05);
      ok(p.valoare > valoare * 1.05 && p.chirie === Math.round(inBani(2800) * 1.05), 'valoarea și chiria au crescut');
    },
  };
}

// ---------- Lotul 4a: Investiții ----------

function lot4a(ctxBaza, a) {
  const { ok, egal } = a;
  const jocInvestitor = (seed) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.numerar = inBani(200_000);
    return { ctx, state };
  };
  const valoareClasa = (state, clasa) => state.produse.filter((p) => p.tip === 'investitie' && p.clasa === clasa).reduce((s, p) => s + valoareProdus(p, state), 0);
  return {
    'lotul 4a: același indice, comisioane diferite: fondul activ rămâne mult în urma ETF-ului'() {
      const { ctx, state } = jocInvestitor('comisioane');
      ok(actiune(state, ctx, 'investeste', { clasa: 'etf', suma: 10_000 }).ok, 'ETF');
      ok(actiune(state, ctx, 'investeste', { clasa: 'fondActiv', suma: 10_000 }).ok, 'fond activ');
      for (let i = 0; i < 360; i++) { state.piete.etf *= 1.07 ** (1 / 12); aplicaComisioaneAnuale(state, ctx); }
      const etf = valoareClasa(state, 'etf');
      const fond = valoareClasa(state, 'fondActiv');
      ok(fond < etf * 0.65, `după 30 de ani: ETF ${etf / 100} lei, fond activ ${fond / 100} lei`);
      ok(portofoliu(state, ctx).comisioane > 0, 'comisioanele plătite sunt ținute minte');
      ok(state.concepte.includes('cost-comisioane'), 'conceptul s-a deblocat');
      return `ETF ${Math.round(etf / 100)} lei vs. fond activ ${Math.round(fond / 100)} lei`;
    },

    'lotul 4a: o companie poate da faliment; companiile au norocul lor, piața rămâne aceeași'() {
      const { ctx: ctx0, state } = jocInvestitor('faliment');
      const companii = new Map([...ctx0.investitii.companii].map(([k, c]) => [k, k === 'co-zborapid' ? { ...c, riscFalimentAnual: 0.9999 * 12 } : c]));
      const ctx = { ...ctx0, investitii: { ...ctx0.investitii, companii } };
      ok(actiune(state, ctx, 'investeste', { clasa: 'co-zborapid', suma: 5000 }).ok, 'cumpără acțiuni ZboRapid');
      const piete = state.rng.piete;
      miscaCompanii(state, ctx, 1.01);
      egal(state.rng.piete, piete, 'companiile nu consumă din fluxul pieței');
      egal(state.piete['co-zborapid'], 0, 'ZboRapid a dat faliment');
      egal(valoareClasa(state, 'co-zborapid'), 0, 'acțiunile nu mai valorează nimic');
      ok(!actiune(state, ctx, 'investeste', { clasa: 'co-zborapid', suma: 100 }).ok, 'nu se mai poate cumpăra');
      ok(state.jurnal.some((j) => /faliment/.test(j.text)), 'jurnalul spune ce s-a întâmplat');
    },

    'lotul 4a: investiția automată lunară cumpără după salariu și sare lunile fără bani'() {
      const { ctx, state } = jocInvestitor('dca');
      ok(actiune(state, ctx, 'seteazaDCA', { clasa: 'etf', suma: 300 }).ok, 'DCA setat');
      ok(actiune(state, ctx, 'seteazaDCA', { clasa: 'pilon3', suma: 100 }).ok, 'și în Pilonul III');
      const pilon3 = state.pensie.pilon3 ?? 0;
      a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      const cost = state.produse.filter((p) => p.tip === 'investitie' && p.clasa === 'etf').reduce((s, p) => s + p.cost, 0);
      egal(cost, 12 * inBani(300), 'un an de investiții lunare în ETF');
      ok((state.pensie.pilon3 ?? 0) >= pilon3 + 12 * inBani(100), 'Pilonul III a primit lunar');
      ok(state.istoricPortofoliu.length >= 1, 'istoricul are un punct pe an');
      state.numerar = 0;
      for (const p of state.produse) if (p.tip === 'contCurent') p.sold = 0;
      for (const p of state.produse) if (p.tip === 'contractMunca') state.produse = state.produse.filter((x) => x !== p);
      state.recurente = [];
      proceseazaDCA(state, ctx);
      ok(state.dca.every((d) => d.luniSarite > 0), 'fără bani, luna se sare');
    },

    'lotul 4a: vânzarea parțială plătește comision și impozit doar pe câștigul vândut'() {
      const { ctx, state } = jocInvestitor('vanzare');
      actiune(state, ctx, 'investeste', { clasa: 'etf', suma: 10_000 });
      state.piete.etf *= 1.5;
      const valoare = valoareClasa(state, 'etf');
      const inainte = baniDisponibili(state);
      const r = actiune(state, ctx, 'vinde', { clasa: 'etf', suma: 5000 });
      ok(r.ok, r.mesaj);
      ok(r.impozit > 0 && r.comision > 0, 'comision și impozit');
      egal(baniDisponibili(state) - inainte, r.net, 'banii primiți = net');
      const p = state.produse.find((x) => x.tip === 'investitie' && x.clasa === 'etf');
      ok(Math.abs(valoareProdus(p, state) - (valoare - inBani(5000))) < 100, 'a rămas restul investiției');
      ok(Math.abs(p.cost - inBani(10_000) * (1 - inBani(5000) / valoare)) < 100, 'costul rămas scade proporțional');
    },

    'lotul 4a: rebalansarea aduce portofoliul la strategie'() {
      const { ctx, state } = jocInvestitor('rebalansare');
      actiune(state, ctx, 'investeste', { clasa: 'crypto', suma: 50_000 });
      const r = actiune(state, ctx, 'rebalanseaza', { strategie: 'echilibrata' });
      ok(r.ok, r.mesaj);
      const port = portofoliu(state, ctx);
      const pondere = (clasa) => port.randuri.find((x) => x.clasa === clasa)?.pondere ?? 0;
      ok(Math.abs(pondere('etf') - 0.6) < 0.05, `ETF ~60%: ${pondere('etf')}`);
      ok(pondere('crypto') < 0.02, 'crypto vândut (nu e în strategie)');
      ok(pondere('titluriStat') > 0.2, 'titluri de stat cumpărate');
      ok(state.concepte.includes('rebalansare'), 'concept');
    },

    'lotul 4a: la prăbușirea bursei, „vând tot” vinde și companiile, și fondul activ'() {
      const { ctx, state } = jocInvestitor('panica');
      for (const clasa of ['etf', 'fondActiv', 'co-medicor', 'titluriStat']) actiune(state, ctx, 'investeste', { clasa, suma: 1000 });
      const o = forteazaEveniment(state, ctx, 'prabusire-bursa', { pierdere: 100, procent: 20 });
      alege(state, ctx, 'vand');
      const ramase = state.produse.filter((p) => p.tip === 'investitie').map((p) => p.clasa);
      egal(JSON.stringify(ramase), JSON.stringify(['titluriStat']), 'rămân doar titlurile de stat');
      ok(o.tip === 'eveniment', 'evenimentul a apărut');
    },
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
    'ecranele se încarcă fără erori de sintaxă (testele motorului nu le ating altfel)'() {
      const ecrane = ['meniuri', 'ecrane', 'final', 'grafic', 'eveniment', 'principal', 'strat', 'toast', 'dom', 'concepte', 'debug'];
      return Promise.all(ecrane.map((f) => import(`../js/ui/${f}.js`).catch((e) => { throw new Error(`js/ui/${f}.js: ${e.message}`); })))
        .then(() => `${ecrane.length} module de interfață`);
    },

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
        investeste: [{ clasa: 'etf', suma: 1000 }, { clasa: 'nu-exista', suma: 10 }, { clasa: 'etf' }],
        vinde: [{ clasa: 'etf', suma: 100 }, { clasa: 'titluriStat' }, { clasa: 'crypto' }],
        seteazaDCA: [{ clasa: 'etf', suma: 200 }, { clasa: 'etf', suma: 0 }, { clasa: 'titluriStat', suma: 100 }],
        depunePilon3: [{ suma: 100 }, {}],
        rebalanseaza: [{ strategie: 'echilibrata' }, { strategie: 'nu-exista' }],
        cumparaImobil: [{ marime: 'garsoniera', finantare: 'credit' }, { marime: 'castel' }],
        vindeImobil: [{ id: id('contCurent') }],
        seteazaRitm: [{ ritm: 'intens' }, { ritm: 'intens' }, { ritm: 'turbo' }],
        oreSuplimentare: [{}],
        cerePromovare: [{}],
        cursFirma: [{}],
        devinoArtist: [{ job: 'pictor' }, { job: 'curier' }],
        incepeSecundar: [{ secundar: 'livrari-weekend' }, { secundar: 'nu-exista' }],
        opresteSecundar: [{}, {}],
        demisie: [{}, {}],
        faPlanAfaceri: [{}, {}],
        faStudiuPiata: [{ domeniu: 'cafenea' }, { domeniu: 'nu-exista' }],
        aplicaGrant: [{}],
        pornesteAfacere: [{ domeniu: 'arta', forma: 'pfa' }, { domeniu: 'arta', forma: 'xyz' }],
        retrageDinFirma: [{ suma: 10 }, {}],
        depuneInFirma: [{ suma: 10 }],
        inchideAfacere: [{}, {}],
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
