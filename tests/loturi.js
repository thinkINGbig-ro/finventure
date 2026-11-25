// Testele extinderii, grupate pe loturi. Primesc ajutoarele din tests/suite.js.

import { ACTIUNI, actiune, alege, avanseaza, forteazaEveniment, jocNou, oprireCurenta } from '../js/engine.js';
import { gradIndatorare, motivNeindeplinire as motivNeindeplinireTest, textRezultat } from '../js/events.js';
import { baniDisponibili, creeazaProdus, datorieProdus, facturiLunare, fluturas, pret, valoareProdus } from '../js/finance.js';
import { aplicaComisioaneAnuale, miscaCompanii, portofoliu, proceseazaDCA } from '../js/investitii.js';
import { actualizeazaImobileAnual, descrieImobile, proceseazaImobile, simuleazaCumparare, simuleazaVanzare } from '../js/imobiliare.js';
import { bilantEducatie, descrieCurs, descrieProgram, proceseazaCursuriLuna, proceseazaStudiiLuna } from '../js/educatie.js';
import { indeplinesteCerinte, luniPanaLaPromovare, schimbaJob } from '../js/cariera.js';
import { descrieSecundare, proceseazaSecundar, simuleazaOreSuplimentare, venitArtistLuna } from '../js/munca.js';
import { pregatire, proceseazaAfacere, simuleazaPornire, simuleazaVanzare as simuleazaVanzareFirma } from '../js/afacere.js';
import { descrieCatalog, optiuniPlata, proceseazaBunuri } from '../js/cumparaturi.js';
import { costRamasCredit, listaDatorii, simuleazaConsolidare, simuleazaRambursare } from '../js/datorii.js';
import { descrieActivitati, motivTimp, timpPeAn, timpRamas } from '../js/activitati.js';
import { PREFIX_PREVIEW, PREFIX_PRINCIPAL, creeazaStorage, creeazaStorageMemorie, prefixPentru } from '../js/storage.js';
import { descrieAsigurari } from '../js/asigurari.js';
import { aplicaFamilie, bugetFamilie, casaComuna, proceseazaFamilie, venitPartener, verificaCuplu } from '../js/familie.js';
import { VERSIUNE_SALVARE, adaugaCheckpoint, areFlag, avereNeta, incarcaCheckpoint, incarcaJoc, listaCheckpointuri, salveazaJoc } from '../js/state.js';
import { cloneaza, inBani } from '../js/util.js';
import { COD_PAGINA } from '../js/versiune.js';

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
    ...lot6b(ctxBaza, a),
    ...lot7(ctxBaza, a),
    ...lot8(ctxBaza, a),
    ...lot9a(ctxBaza, a),
    ...lot9b(ctxBaza, a),
    ...lot9c(ctxBaza, a),
    ...migrareDinMain(ctxBaza, a),
  };
}

// ---------- Salvările reale de pe `main` (versiunea 1) se încarcă și se joacă pe extindere ----------
// Fixture-ul e generat cu codul de pe `main`: node tools/genereaza-salvari-main.js <worktree-main> tests/fixtures/salvari-main-v1.json

function migrareDinMain(ctxBaza, a) {
  const { ok, egal } = a;
  const storageDin = (date) => {
    const m = new Map(Object.entries(date));
    // Salvările de pe main au cheile „finventure.*”; prefixul e dat explicit, ca testul să meargă și în browser pe localhost.
    return creeazaStorage({ tip: 'memorie', getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }, PREFIX_PRINCIPAL);
  };
  // Tot ce citesc panourile din meniuri (fără DOM): dacă o salvare veche n-are un câmp, aici se vede.
  const deschideMeniurile = (state, ctx) => {
    descrieActivitati(state, ctx);
    listaDatorii(state, ctx);
    portofoliu(state, ctx);
    descrieImobile(state, ctx);
    descrieCatalog(state, ctx);
    descrieSecundare(state, ctx);
    descrieAsigurari(state, ctx);
    bugetFamilie(state, ctx);
    for (const p of ctx.educatie.programe.values()) descrieProgram(state, ctx, p);
    for (const c of ctx.educatie.cursuri.values()) descrieCurs(state, ctx, c);
    ok(Number.isFinite(avereNeta(state)), 'averea netă e un număr');
  };
  return {
    async 'pornire: index.html și codul au aceeași versiune, iar încărcătorul găsește toate modulele din main.js'() {
      const index = await a.citeste('index.html');
      egal(index.match(/<meta name="finventure-cod" content="([^"]+)">/)?.[1], COD_PAGINA, 'versiunea din index.html = js/versiune.js');
      ok(/window\.finventurePregateste\(\)\.then\(\(\) => import\('\.\/js\/main\.js'\)\)/.test(index), 'main.js pornește după verificarea modulelor');
      ok(!/<script type="module" src=/.test(index), 'fără încărcare directă a lui main.js (ar ocoli verificarea)');
      const sursa = index.match(/const IMPORTURI = (\/.+\/g);/)?.[1];
      ok(sursa, 'expresia pentru importuri e în index.html');
      const IMPORTURI = new RegExp(sursa.slice(1, -2), 'g');
      // Același mers ca în index.html, pe fișiere: fiecare modul atins există, iar expresia prinde toate importurile relative.
      const vazute = new Set();
      const mergi = async (cale) => {
        if (vazute.has(cale)) return;
        vazute.add(cale);
        const text = await a.citeste(cale);
        const gasite = [...text.matchAll(IMPORTURI)].map((m) => m[1] ?? m[2]);
        const asteptate = (text.match(/\bfrom\s*['"]\.{1,2}\//g)?.length ?? 0) + (text.match(/\bimport\s*\(\s*['"]\.{1,2}\//g)?.length ?? 0);
        egal(gasite.length, asteptate, `${cale}: importuri găsite`);
        const baza = new URL(cale, 'https://x/');
        await Promise.all(gasite.map((g) => mergi(new URL(g, baza).pathname.slice(1))));
      };
      await mergi('js/main.js');
      for (const m of ['js/ui/debug.js', 'js/familie.js', 'js/storage.js', 'js/versiune.js', 'js/ui/meniuri.js', 'js/content.js']) ok(vazute.has(m), `${m} e atins`);
      ok(vazute.size >= 35, `${vazute.size} module`);
    },
    'salvări: prefixul cheilor depinde de adresă (site-ul principal „finventure.”, preview-ul și restul „finventure-preview.”)'() {
      const adresa = (url) => new URL(url);
      for (const url of [
        'https://thinkingbig-ro.github.io/finventure/',
        'https://thinkingbig-ro.github.io/finventure/index.html?debug=1',
        'https://thinkingbig-ro.github.io/finventure',
        'https://ThinkINGbig-ro.github.io/finventure/',
        'https://thinkingbig-ro.github.io/finventure/tests/run.html',
      ]) egal(prefixPentru(adresa(url)), PREFIX_PRINCIPAL, url);
      for (const url of [
        'https://thinkingbig-ro.github.io/finventure/preview/',
        'https://thinkingbig-ro.github.io/finventure/preview/index.html?debug=1',
        'https://thinkingbig-ro.github.io/finventure/preview',
        'https://thinkingbig-ro.github.io/finventure-preview/',
        'https://thinkingbig-ro.github.io/',
        'https://alt-cont.github.io/finventure/',
        'http://localhost:8000/',
        'http://10.190.2.136:8000/',
      ]) egal(prefixPentru(adresa(url)), PREFIX_PREVIEW, url);
      egal(prefixPentru(null), PREFIX_PRINCIPAL, 'fără adresă (Node)');
      // Pe același localStorage (același domeniu), preview-ul nu vede și nu atinge salvarea site-ului principal.
      const comun = new Map([['finventure.salvare', '{"versiune":1}']]);
      const backend = { getItem: (k) => comun.get(k) ?? null, setItem: (k, v) => comun.set(k, String(v)), removeItem: (k) => comun.delete(k) };
      const preview = creeazaStorage(backend, prefixPentru(adresa('https://thinkingbig-ro.github.io/finventure/preview/')));
      egal(preview.citeste('salvare'), null, 'preview-ul nu vede salvarea principală');
      preview.scrie('salvare', { versiune: 6 });
      preview.sterge('checkpointuri');
      egal(comun.get('finventure.salvare'), '{"versiune":1}', 'salvarea principală rămâne neatinsă');
      egal(comun.get('finventure-preview.salvare'), '{"versiune":6}', 'preview-ul are cheia lui');
      const principal = creeazaStorage(backend, prefixPentru(adresa('https://thinkingbig-ro.github.io/finventure/')));
      egal(principal.citeste('salvare')?.versiune, 1, 'site-ul principal își citește salvarea');
    },
    async 'migrare: salvările reale de pe main (versiunea 1) se încarcă, se văd în meniuri și se joacă 3 ani'() {
      const fixture = JSON.parse(await a.citeste('tests/fixtures/salvari-main-v1.json'));
      const cazuri = Object.entries(fixture.cazuri);
      ok(cazuri.length >= 8, `${cazuri.length} salvări`);
      let cuCard = 0;
      for (const [id, caz] of cazuri) {
        const ctx = ctxBaza;
        const storage = storageDin(caz.localStorage);
        const state = incarcaJoc(storage);
        ok(state, `${id}: salvarea se încarcă`);
        egal(state.versiune, VERSIUNE_SALVARE, `${id}: versiunea adusă la zi`);
        ok(state.familie && state.infractiuni && Array.isArray(state.cursuri) && state.timp, `${id}: câmpurile noi`);
        deschideMeniurile(state, ctx);
        if (state.final) continue; // un joc terminat se vede doar pe ecranul de final
        const oprire = oprireCurenta(state, ctx);
        if (oprire) cuCard++;
        a.consuma(state, ctx, oprire, a.primaDisponibila);
        for (const tip of ['activitate', 'asigurare']) actiune(state, ctx, tip, tip === 'activitate' ? { activitate: 'alergare' } : { tip: 'viata' });
        for (let an = 0; an < 3 && !state.final; an++) {
          a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
          a.verificaInvarianti(state);
        }
        deschideMeniurile(state, ctx);
        // Checkpoint-urile salvate pe main se încarcă și ele.
        for (const cp of listaCheckpointuri(storage)) {
          const s = incarcaCheckpoint(storage, cp.id);
          ok(s && s.versiune === VERSIUNE_SALVARE, `${id}: checkpoint „${cp.eticheta}”`);
          a.consuma(s, ctx, oprireCurenta(s, ctx) ?? avanseaza(s, ctx), a.primaDisponibila);
          a.verificaInvarianti(s);
        }
      }
      ok(cuCard >= 3, `${cuCard} salvări cu un card de eveniment deschis`);
      return `${cazuri.length} salvări, ${cuCard} cu un card deschis`;
    },
  };
}

// ---------- Lotul 9c: partener și familie ----------

function lot9c(ctxBaza, a) {
  const { ok, egal } = a;
  // Un joc cu job, locuință doar a ta și partener (prin evenimentul „intalnire”).
  const cuPartener = (seed) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.pendinte = null;
    state.situatie.locuinta = 'chirieSingur';
    forteazaEveniment(state, ctx, 'intalnire');
    alege(state, ctx, 'muta');
    state.pendinte = null;
    return { ctx, state };
  };
  const netTau = (state, ctx) => {
    const c = state.produse.find((p) => p.tip === 'contractMunca');
    return fluturas(c.brut, c.contract, ctx).net;
  };
  return {
    'lotul 9c: partenerul plătește jumătate din chirie și facturi; banii lui nu sunt ai tăi'() {
      const { ctx, state } = cuPartener('fam-partener');
      ok(areFlag(state, 'partener') && state.familie.partener, 'partenerul');
      const { chirie, utilitati } = facturiLunare(state, ctx);
      const b = bugetFamilie(state, ctx);
      egal(b.contributie, Math.round((chirie + utilitati) / 2), 'jumătate din locuință');
      const inainte = baniDisponibili(state);
      const r = proceseazaFamilie(state, ctx);
      egal(r.venit, b.contributie, 'venitul lunii');
      egal(baniDisponibili(state) - inainte, b.contributie, 'banii intră în cont');
      // Fără venit, partenerul nu poate contribui.
      aplicaFamilie(state, ctx, 'partenerSomer');
      egal(bugetFamilie(state, ctx).contributie, 0, 'partenerul fără job nu pune nimic');
    },

    'lotul 9c: banca adună veniturile doar dacă luați creditul împreună (co-debitori)'() {
      const { ctx, state } = cuPartener('fam-codebitor');
      const spec = { suma: inBani(300_000), luni: 360, dae: 0.06 };
      const singur = gradIndatorare(state, ctx, spec);
      const impreuna = gradIndatorare(state, ctx, { ...spec, coDebitor: true });
      egal(impreuna.net, singur.net + venitPartener(state, ctx), 'venitul vostru net');
      ok(impreuna.grad < singur.grad, `grad ${impreuna.grad.toFixed(2)} vs. ${singur.grad.toFixed(2)}`);
      // Cumpărarea normală („cumpara-locuinta”) nu pune venitul partenerului la socoteală.
      const ev = ctx.evenimente.get('cumpara-locuinta');
      ok(JSON.stringify(ev).indexOf('coDebitor') < 0, 'creditul pe numele tău: doar venitul tău');
      const fara = cloneaza(state);
      fara.familie.partener = null;
      egal(gradIndatorare(fara, ctx, { ...spec, coDebitor: true }).net, singur.net, 'fără partener, co-debitorul nu ajută');
    },

    'lotul 9c: copilul costă lunar, alocația scade la 2 ani, totul se oprește la 18 ani'() {
      const { ctx, state } = cuPartener('fam-copil');
      aplicaFamilie(state, ctx, 'copil');
      let b = bugetFamilie(state, ctx);
      egal(b.costCopii, pret(state, ctx, 'familie.costLunarCopil'), 'costul');
      egal(b.alocatie, pret(state, ctx, 'familie.alocatieSub2'), 'alocația sub 2 ani');
      const { chirie, utilitati } = facturiLunare(state, ctx);
      egal(b.contributie, Math.round((chirie + utilitati + b.costCopii) / 2), 'partenerul plătește jumătate și din copil');
      state.familie.copii[0].nascutLa -= 30;
      egal(bugetFamilie(state, ctx).alocatie, pret(state, ctx, 'familie.alocatiePeste2'), 'alocația după 2 ani');
      state.familie.copii[0].nascutLa -= 12 * 16;
      b = bugetFamilie(state, ctx);
      egal(b.costCopii + b.alocatie, 0, 'majorat: fără cost și fără alocație');
    },

    'lotul 9c: în concediul de creștere vine indemnizația (85% din net, plafonată), nu salariul'() {
      const { ctx, state } = cuPartener('fam-concediu');
      state.pendinte = null;
      forteazaEveniment(state, ctx, 'nastere');
      alege(state, ctx, 'eu');
      ok(areFlag(state, 'concediu_crestere') && state.familie.copii.length === 1, 'concediul și copilul');
      const net = netTau(state, ctx);
      const asteptat = Math.min(pret(state, ctx, 'familie.indemnizatieMax'), Math.max(pret(state, ctx, 'familie.indemnizatieMin'), Math.round(net * 0.85)));
      egal(bugetFamilie(state, ctx).indemnizatie, asteptat, 'indemnizația');
      state.pendinte = null;
      const fara = cloneaza(state);
      delete fara.flaguri.concediu_crestere;
      const venituri = (s) => {
        a.consuma(s, ctx, avanseaza(s, ctx), a.primaDisponibila);
        return avereNeta(s);
      };
      const cu = venituri(state);
      const faraConcediu = venituri(fara);
      const minim = 12 * (net - asteptat);
      ok(faraConcediu - cu >= minim * 0.8, `după un an: ${cu / 100} lei în concediu, ${faraConcediu / 100} lei cu salariu (diferență așteptată ~${minim / 100})`);
    },

    'lotul 9c: divorțul cu casă și credit comun: vânzarea închide creditul și împarte restul pe din două'() {
      const { ctx, state } = cuPartener('fam-divort');
      aplicaFamilie(state, ctx, 'casatorie');
      aplicaFamilie(state, ctx, 'copil');
      state.produse.push(creeazaProdus({ tip: 'proprietate', valoare: inBani(450_000), marime: 'apartament' }, state, ctx));
      state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'ipoteca', suma: inBani(300_000), dae: 0.06, luni: 360, coDebitor: true }, state, ctx));
      state.situatie.locuinta = 'proprietate';
      const cc = casaComuna(state, ctx);
      ok(cc && cc.credit.coDebitor, 'casa comună');
      const rata = cc.credit.rata;
      ok(bugetFamilie(state, ctx).contributie >= Math.round(rata / 2), 'partenerul plătește jumătate din rată');
      forteazaEveniment(state, ctx, 'divort');
      const oprire = oprireCurenta(state, ctx);
      ok(!oprire.alegeri.find((x) => x.id === 'despartire').disponibil, 'căsătoriți: e nevoie de divorț');
      const r = alege(state, ctx, 'notar');
      ok(!areFlag(state, 'partener') && areFlag(state, 'divortat'), 'divorțați');
      egal(r.oprire?.eveniment, 'divort-casa', 'urmează casa și creditul comun');
      const vand = cloneaza(state);
      const raman = cloneaza(state);
      const inainte = baniDisponibili(vand);
      alege(vand, ctx, 'vindem');
      ok(!vand.produse.some((p) => p.coDebitor) && !vand.produse.some((p) => p.tip === 'proprietate'), 'casa vândută, creditul închis');
      egal(baniDisponibili(vand) - inainte, cc.partea, 'jumătate din ce rămâne după bancă și comision');
      egal(vand.situatie.locuinta, 'chirieSingur', 'te muți în chirie');
      // Copiii rămân la celălalt părinte: pensia de întreținere, 25% din net pentru un copil.
      const b = bugetFamilie(vand, ctx);
      egal(b.costCopii, 0, 'costul copilului nu mai e al tău');
      egal(b.pensie, Math.round(netTau(vand, ctx) * 0.25), 'pensia de întreținere');
      // Rămâneți amândoi pe credit: fostul plătește jumătate, până când nu mai plătește.
      alege(raman, ctx, 'ramanem');
      ok(areFlag(raman, 'credit_cu_fostul'), 'credit cu fostul');
      egal(bugetFamilie(raman, ctx).contributie, Math.round(Math.min(rata, cc.credit.rest) / 2), 'fostul plătește jumătate din rată');
      raman.familie.fostulNuPlateste = true;
      egal(bugetFamilie(raman, ctx).contributie, 0, 'fostul nu mai plătește: toată rata e a ta');
      raman.pendinte = null;
      forteazaEveniment(raman, ctx, 'fostul-nu-plateste');
      alege(raman, ctx, 'platesc');
      ok(!raman.produse.some((p) => p.coDebitor) && !areFlag(raman, 'credit_cu_fostul'), 'creditul e acum doar al tău');
    },

    'lotul 9c: preluarea creditului la divorț cere ca salariul tău să acopere singur rata'() {
      const { ctx, state } = cuPartener('fam-preia');
      aplicaFamilie(state, ctx, 'casatorie');
      state.produse.push(creeazaProdus({ tip: 'proprietate', valoare: inBani(450_000), marime: 'apartament' }, state, ctx));
      state.produse.push(creeazaProdus({ tip: 'credit', furnizor: 'ipoteca', suma: inBani(380_000), dae: 0.06, luni: 360, coDebitor: true }, state, ctx));
      state.numerar = inBani(200_000);
      forteazaEveniment(state, ctx, 'divort');
      const r = alege(state, ctx, 'notar');
      const preiau = r.oprire.alegeri.find((x) => x.id === 'preiau');
      ok(!preiau.disponibil && /Creditorul te refuză/.test(preiau.motiv), `curierul nu poate duce singur rata: ${preiau.motiv}`);
      ok(r.oprire.alegeri.some((x) => x.disponibil), 'rămâne o variantă');
    },

    'lotul 9c: stresul financiar crește riscul de divorț'() {
      const rata = (luniLipsuri) => {
        let divorturi = 0;
        for (let i = 0; i < 300; i++) {
          const { ctx, state } = cuPartener(`fam-stres-${i % 3}`);
          state.rng.actiuni = 1000 + i;
          for (let l = 0; l < 12; l++) verificaCuplu(state, ctx, l < luniLipsuri);
          if (state.familie.divortProgramat) divorturi++;
        }
        return divorturi;
      };
      const linistit = rata(0);
      const stresat = rata(12);
      ok(stresat > linistit * 2, `divorțuri într-un an: ${linistit} fără lipsuri, ${stresat} cu lipsuri în fiecare lună (din 300)`);
    },

    'lotul 9c: o salvare din versiunea 5 primește familia goală'() {
      const { ctx, state } = a.jocCuJob('fam-migrare');
      const veche = cloneaza(state);
      veche.versiune = 5;
      delete veche.familie;
      const storage = creeazaStorageMemorie();
      salveazaJoc(storage, veche);
      const s = incarcaJoc(storage);
      egal(s.versiune, VERSIUNE_SALVARE, 'versiunea');
      ok(s.familie && s.familie.partener === null && Array.isArray(s.familie.copii), 'familia goală');
      a.consuma(s, ctx, oprireCurenta(s, ctx) ?? avanseaza(s, ctx), a.primaDisponibila);
    },
  };
}

// ---------- Lotul 9b: asigurări, moșteniri, donații, părinți ----------

function lot9b(ctxBaza, a) {
  const { ok, egal } = a;
  return {
    'lotul 9b: asigurarea de viață: prima lunară, flagul, renunțarea; fără venit e refuzată'() {
      const { ctx, state } = a.jocCuJob('asig-viata');
      a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
      const r = actiune(state, ctx, 'asigurare', { tip: 'viata' });
      ok(r.ok, r.mesaj);
      ok(areFlag(state, 'asigurare_viata'), 'flagul');
      const rec = state.recurente.find((x) => x.asigurare === 'viata');
      egal(rec.suma, pret(state, ctx, 'asigurari.primaViata'), 'prima');
      ok(!actiune(state, ctx, 'asigurare', { tip: 'viata' }).ok, 'nu de două ori');
      ok(actiune(state, ctx, 'asigurare', { tip: 'viata', activ: false }).ok, 'renunțarea');
      ok(!areFlag(state, 'asigurare_viata') && !state.recurente.some((x) => x.asigurare), 'fără flag și fără primă');
      state.produse = state.produse.filter((p) => p.tip !== 'contractMunca');
      ok(/venit/.test(actiune(state, ctx, 'asigurare', { tip: 'viata' }).mesaj), 'fără venit: motivul');
    },

    'lotul 9b: inundația: cu asigurare plătești franciza, fără ea toată paguba'() {
      const pierdere = (cuAsigurare) => {
        const { ctx, state } = a.jocCuJob('inundatie');
        a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
        state.produse.push(creeazaProdus({ tip: 'proprietate', valoare: inBani(250_000), marime: 'garsoniera' }, state, ctx));
        state.numerar = inBani(50_000);
        if (cuAsigurare) ok(actiune(state, ctx, 'asigurare', { tip: 'locuinta' }).ok, 'asigurarea');
        state.pendinte = null;
        forteazaEveniment(state, ctx, 'inundatie-locuinta');
        const oprire = oprireCurenta(state, ctx);
        egal(oprire.alegeri.find((x) => x.id === 'asigurare').disponibil, cuAsigurare, 'alegerea cu asigurarea');
        const inainte = baniDisponibili(state);
        alege(state, ctx, cuAsigurare ? 'asigurare' : 'vecin');
        return inainte - baniDisponibili(state);
      };
      const cu = pierdere(true);
      const fara = pierdere(false);
      ok(cu < fara / 10, `cu asigurare ${cu / 100} lei, fără ${fara / 100} lei`);
    },

    'lotul 9b: asigurarea locuinței dispare când vinzi ultima locuință'() {
      const { ctx, state } = a.jocCuJob('asig-vanzare');
      a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
      ok(/locuință a ta/.test(actiune(state, ctx, 'asigurare', { tip: 'locuinta' }).mesaj), 'fără locuință: motivul');
      const casa = creeazaProdus({ tip: 'proprietate', valoare: inBani(250_000), marime: 'garsoniera' }, state, ctx);
      state.produse.push(casa);
      ok(actiune(state, ctx, 'asigurare', { tip: 'locuinta' }).ok, 'asigurată');
      state.produse = state.produse.filter((p) => p !== casa);
      state.pendinte = null;
      a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      ok(!state.recurente.some((x) => x.asigurare === 'locuinta'), 'prima nu se mai plătește');
    },

    'lotul 9b: moștenirea cu datorii (art. 1114 C. civ.): nicio variantă nu ia din banii tăi mai mult decât valoarea casei'() {
      const ev = ctxBaza.evenimente.get('mostenire-datorii');
      const v = ev.variabile;
      egal(v.diferenta, v.casa - v.datorii, 'diferența');
      egal(v.rest, v.casa - v.datorii - ctxBaza.config.mostenire.taxaNotar.valoare, 'restul după bancă și notar');
      ok(ev.alegeri.every((x) => !x.produsNou || [x.produsNou].flat().every((p) => p.tip !== 'credit')), 'nicio alegere nu deschide un credit');
      ok(ev.alegeri.some((x) => !x.cere), 'o alegere fără „cere”');

      const { ctx, state } = a.jocCuJob('mostenire-datorii');
      a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
      state.pendinte = null;
      state.numerar = inBani(100_000);
      const credite = () => state.produse.filter((p) => p.tip === 'credit').length;
      const nrCredite = credite();
      forteazaEveniment(state, ctx, 'mostenire-datorii');
      const vars = oprireCurenta(state, ctx).variabile;
      const avere = avereNeta(state);
      const vand = cloneaza(state);
      const platesc = cloneaza(state);
      alege(state, ctx, 'renunt');
      egal(avereNeta(state), avere, 'renunț: averea nu se schimbă');
      egal(credite(), nrCredite, 'renunț: nicio datorie nouă');
      alege(vand, ctx, 'vand');
      egal(avereNeta(vand) - avere, inBani(vars.rest), 'vând: primesc diferența');
      alege(platesc, ctx, 'platesc');
      const casa = platesc.produse.find((p) => p.tip === 'imobil');
      ok(casa && casa.valoare === inBani(vars.casa), 'plătesc: păstrez casa, ca imobil de închiriat');
      ok(avereNeta(platesc) - avere === inBani(vars.casa - vars.datorii), 'plătesc: câștig valoarea casei minus datoria');
      ok(platesc.concepte.includes('mostenire-datorii'), 'conceptul');

      const sarac = cloneaza(vand);
      sarac.numerar = 0;
      sarac.produse = sarac.produse.filter((p) => !['contCurent', 'contEconomii', 'depozit', 'investitie'].includes(p.tip) || p.tip === 'contCurent');
      for (const p of sarac.produse) if (p.tip === 'contCurent') p.sold = 0;
      sarac.pendinte = null;
      forteazaEveniment(sarac, ctx, 'mostenire-datorii');
      ok(!oprireCurenta(sarac, ctx).alegeri.find((x) => x.id === 'platesc').disponibil, 'fără bani: nu poți plăti din buzunar');
    },

    'lotul 9b: o primă de asigurare neplătită reziliază polița, nu devine datorie'() {
      const { ctx, state } = a.jocCuJob('asig-reziliere');
      a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
      ok(actiune(state, ctx, 'asigurare', { tip: 'viata' }).ok, 'asigurată');
      state.produse = state.produse.filter((p) => p.tip !== 'contractMunca' && p.tip !== 'contEconomii');
      state.numerar = 0;
      for (const p of state.produse) if (p.tip === 'contCurent') p.sold = 0;
      state.pendinte = null;
      a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      ok(!state.recurente.some((x) => x.asigurare === 'viata'), 'prima nu se mai plătește');
      ok(!areFlag(state, 'asigurare_viata'), 'fără flag');
      ok(state.jurnal.some((j) => /reziliat/.test(j.text ?? j)), 'jurnalul');
    },
  };
}

// ---------- Lotul 9a: scenariile de start, averea netă an de an ----------

function lot9a(ctxBaza, a) {
  const { ok, egal } = a;
  const ctx = ctxBaza;
  return {
    'lotul 9a: fiecare scenariu pornește un joc valid, cu prima decizie deschisă'() {
      ok(ctx.scenarii.size >= 4 && ctx.scenarii.has('obisnuit'), `${ctx.scenarii.size} scenarii`);
      for (const id of ctx.scenarii.keys()) {
        const state = jocNou(ctx, { seed: `sc-${id}`, scenariu: id });
        const oprire = oprireCurenta(state, ctx) ?? avanseaza(state, ctx);
        ok(oprire?.tip === 'eveniment', `${id}: prima decizie`);
      }
    },

    'lotul 9a: „Începi cu datorii” are un credit cu rată, fără banii pe mână'() {
      const st = jocNou(ctx, { seed: 'datorii', scenariu: 'datorii' });
      const c = st.produse.find((p) => p.tip === 'credit');
      ok(c && c.rest === inBani(15_000) && c.rata > 0, 'creditul de 15.000 lei');
      const normal = jocNou(ctx, { seed: 'datorii' });
      egal(baniDisponibili(st), baniDisponibili(normal), 'banii au fost deja cheltuiți');
    },

    'lotul 9a: „Fără bac” închide facultatea (cu motiv), iar bacul luat o redeschide'() {
      const st = jocNou(ctx, { seed: 'farabac', scenariu: 'fara-bac' });
      const oprire = oprireCurenta(st, ctx) ?? avanseaza(st, ctx);
      const taxa = oprire.alegeri.find((x) => x.id === 'facultate-taxa');
      ok(!taxa.disponibil && /bacalaureat/.test(taxa.motiv), `facultatea cu taxă: ${taxa.motiv}`);
      ok(oprire.alegeri.some((x) => x.disponibil), 'mai are ce alege');
      ok(!indeplinesteCerinte(ctx.joburi.get('agent-politie'), st, ctx), 'fără școala de agenți');
      // bacul, din Educație
      st.pendinte = null;
      st.numerar = inBani(10_000);
      const r = actiune(st, ctx, 'inscrieCurs', { curs: 'bacalaureat' });
      ok(r.ok, r.mesaj);
      st.cursuri[0].luniRamase = 1;
      proceseazaCursuriLuna(st, ctx);
      ok(!st.flaguri.fara_bac, 'fara_bac s-a șters');
      ok(st.jurnal.some((j) => /Ai luat bacalaureatul/.test(j.text)), 'jurnalul');
    },

    'lotul 9a: „Moștenești o garsonieră”: imobil de închiriat, fără credit, se poate vinde'() {
      const st = jocNou(ctx, { seed: 'mostenire', scenariu: 'mostenire' });
      const im = st.produse.find((p) => p.tip === 'imobil');
      ok(im && !im.creditId && im.valoare > 0, 'garsoniera');
      ok(avereNeta(st) >= im.valoare, 'intră în averea netă');
      ok(st.concepte.includes('mostenire'), 'conceptul');
    },

    'lotul 9a: istoricul averii nete se adună an de an (pentru grafic)'() {
      const { ctx: c, state } = a.jocCuJob('avere');
      for (let i = 0; i < 3 && !state.final; i++) a.consuma(state, c, avanseaza(state, c), a.primaDisponibila);
      ok(state.istoricPortofoliu.length >= 3, `${state.istoricPortofoliu.length} ani`);
      ok(state.istoricPortofoliu.every((p) => typeof p.avere === 'number' && p.indice > 0), 'avere și indice pe fiecare an');
    },
  };
}

// ---------- Lotul 8: infracțiuni și consecințe ----------

function lot8(ctxBaza, a) {
  const { ok, egal } = a;
  const jocTanar = (seed) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.numerar = inBani(30_000);
    return { ctx, state };
  };
  return {
    'lotul 8: nicio faptă nu e rentabilă: câștigul e mai mic decât amenda așteptată, chiar la prima abatere'() {
      const c = (k) => ctxBaza.config.infractiuni[k].valoare;
      const b = ctxBaza.balans.infractiuni;
      const ev = (id) => ctxBaza.evenimente.get(id);
      const castig = (id, cale) => ev(id).variabile[alegerePeCaleEv(ev(id), cale).infractiune.castig.slice(1, -1)];
      const cazuri = {
        furt: [castig('furt-marunt', 'iau'), c('amendaFurt')],
        mule: [castig('oferta-cont', 'accept'), c('amendaFurt')],
        frauda: [castig('decont-fals', 'accept'), c('amendaFrauda')],
        evaziune: [castig('tentatie-evaziune', 'ascund'), castig('tentatie-evaziune', 'ascund') * c('multiplicatorEvaziune')],
      };
      for (const [tip, [g, amenda]] of Object.entries(cazuri)) {
        const asteptat = g - b[tip].sansaBaza * amenda;
        ok(asteptat < 0, `${tip}: câștig ${g} lei, pierdere așteptată ${b[tip].sansaBaza * amenda} lei → ${asteptat}`);
      }
    },

    'lotul 8: money mule: bani pe loc, apoi dosar, cazier, credit refuzat, joburi închise'() {
      let prins = null;
      for (let i = 0; i < 20 && !prins; i++) {
        const { ctx, state } = jocTanar(`mule-${i}`);
        forteazaEveniment(state, ctx, 'oferta-cont');
        const bani = baniDisponibili(state);
        alege(state, ctx, 'accept');
        ok(baniDisponibili(state) > bani, 'banii vin pe loc');
        const u = state.urmari.find((x) => x.eveniment === 'dosar-penal');
        if (u) prins = { ctx, state, u };
      }
      ok(prins, 'cu 75% șanse, cel puțin unul din 20 e prins');
      const { ctx, state, u } = prins;
      state.pendinte = null;
      state.an = null;
      state.urmari = [];
      forteazaEveniment(state, ctx, 'dosar-penal', u.variabile);
      alege(state, ctx, 'recunosc');
      ok(areFlag(state, 'cazier'), 'are cazier');
      ok(!indeplinesteCerinte(ctx.joburi.get('agent-politie'), state, ctx), 'nu mai poate fi polițist');
      ok(/cazier/.test(motivNeindeplinireTest({ indatorare: { suma: 1000, luni: 12, dae: 0.1 } }, state, ctx)), 'banca refuză creditul');
      ok(state.concepte.includes('money-mule') && state.concepte.includes('cazier'), 'conceptele');
    },

    'lotul 8: furtul repetat duce la închisoare: fără job, fără timp, meniurile blocate; apoi eliberarea'() {
      const { ctx, state } = jocTanar('inchisoare');
      state.infractiuni.furt = 3;
      forteazaEveniment(state, ctx, 'dosar-penal', { fapta: 'furt', faptaText: 'Te-au prins din nou.', castig: 150, nr: 2 });
      alege(state, ctx, 'recunosc');
      ok(state.infractiuni.inchisoare > 0, `în detenție: ${state.infractiuni.inchisoare} luni`);
      ok(!state.produse.some((p) => p.tip === 'contractMunca'), 'și-a pierdut jobul');
      egal(timpPeAn(state, ctx), 0, 'niciun timp liber');
      ok(/detenție/.test(motivTimp(state, ctx)), 'motivul din Activități spune de ce');
      ok(!actiune(state, ctx, 'activitate', { activitate: 'alergare' }).ok, 'activitățile sunt blocate');
      const luni = state.infractiuni.inchisoare;
      state.pendinte = null;
      for (let i = 0; i < 2 && !state.final; i++) a.consuma(state, ctx, avanseaza(state, ctx), a.primaDisponibila);
      ok(state.final || state.infractiuni.inchisoare === 0, `după ${luni} luni a ieșit`);
      ok(state.final || state.jurnal.some((j) => /Ai ieșit din închisoare/.test(j.text)), 'jurnalul spune');
    },

    'lotul 8: cazierul se șterge după anii de reabilitare'() {
      const { ctx, state } = jocTanar('reabilitare');
      forteazaEveniment(state, ctx, 'dosar-penal', { fapta: 'furt', faptaText: 'Ai fost filmat.', castig: 150, nr: 0 });
      alege(state, ctx, 'recunosc');
      ok(areFlag(state, 'cazier'), 'cazier');
      state.luna += ctx.config.infractiuni.aniReabilitare.valoare * 12 + 1;
      ok(!areFlag(state, 'cazier'), 'după reabilitare, cazierul nu mai apare');
    },
  };
}

// Alegerea de pe o cale („id” sau „grup/sub”) direct din JSON-ul evenimentului.
function alegerePeCaleEv(ev, cale) {
  const [x, y] = cale.split('/');
  const prim = ev.alegeri.find((al) => al.id === x);
  return y ? prim.subalegeri.find((s) => s.id === y) : prim;
}

// ---------- Lotul 7: cumpărături ----------

function lot7(ctxBaza, a) {
  const { ok, egal } = a;
  const jocCumparator = (seed, bani = 200_000) => {
    const { ctx, state } = a.jocCuJob(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    const c = state.produse.find((p) => p.tip === 'contractMunca');
    Object.assign(c, { brut: inBani(8000), contract: 'cim' });
    state.numerar = inBani(bani);
    return { ctx, state };
  };
  return {
    'lotul 7: fiecare fel de plată arată costul: ratele costă mai mult decât prețul, BNPL nu'() {
      const { ctx, state } = jocCumparator('plati');
      const o = optiuniPlata(state, ctx, ctx.cumparaturi.bunuri.get('telefon-premium'));
      const p = pret(state, ctx, 'cumparaturi.telefonPremium');
      egal(o.cash.total, p, 'cash = prețul');
      ok(o.rate.total > p, `în rate plătești mai mult (${o.rate.total / 100} lei)`);
      egal(o.bnpl.total, p, 'BNPL la timp = prețul');
      ok(o.card.motiv, 'fără card de credit, plata cu cardul e indisponibilă');
      ok(actiune(state, ctx, 'cumparaBun', { bun: 'telefon-premium', plata: 'rate' }).ok, 'cumpărat în rate');
      ok(state.produse.some((x) => x.tip === 'credit' && x.furnizor === 'magazin'), 'creditul de la magazin există');
      ok(state.produse.some((x) => x.tip === 'bun' && x.bunId === 'telefon-premium'), 'telefonul e al tău');
    },

    'lotul 7: bunurile se depreciază și se revând cu pierdere; ceasul își ține valoarea'() {
      const { ctx, state } = jocCumparator('depreciere');
      actiune(state, ctx, 'cumparaBun', { bun: 'telefon-premium', plata: 'cash' });
      actiune(state, ctx, 'cumparaBun', { bun: 'ceas', plata: 'cash' });
      for (let i = 0; i < 12; i++) proceseazaBunuri(state, ctx);
      const tel = state.produse.find((x) => x.bunId === 'telefon-premium');
      const ceas = state.produse.find((x) => x.bunId === 'ceas');
      ok(tel.valoare < tel.pretCumparare * 0.8, `telefonul a pierdut mult (${tel.valoare / 100} lei)`);
      ok(ceas.valoare > ceas.pretCumparare * 0.9, 'ceasul aproape deloc');
      const bani = baniDisponibili(state);
      const r = actiune(state, ctx, 'vindeBun', { id: tel.id });
      ok(r.ok && /pierdut/.test(r.mesaj), r.mesaj);
      egal(baniDisponibili(state) - bani, tel.valoare, 'primești valoarea de acum');
    },

    'lotul 7: mașina și animalele costă lunar; animalul nu se vinde; o singură mașină'() {
      const { ctx, state } = jocCumparator('costuri');
      ok(actiune(state, ctx, 'cumparaBun', { bun: 'masina-sh', plata: 'cash' }).ok, 'mașină');
      ok(areFlag(state, 'are_masina'), 'flag-ul de mașină (evenimentul „O mașină?” nu mai apare)');
      ok(!actiune(state, ctx, 'cumparaBun', { bun: 'masina-suv', plata: 'cash' }).ok, 'a doua mașină: nu');
      ok(actiune(state, ctx, 'cumparaBun', { bun: 'caine', plata: 'cash' }).ok, 'câine');
      const cost = proceseazaBunuri(state, ctx);
      egal(cost, pret(state, ctx, 'cumparaturi.costLunarMasinaMica') + pret(state, ctx, 'cumparaturi.costLunarCaine'), 'costurile lunare');
      const caine = state.produse.find((x) => x.bunId === 'caine');
      ok(!actiune(state, ctx, 'vindeBun', { id: caine.id }).ok, 'un animal nu se vinde');
      egal(caine.valoare, 0, 'nu intră în avere');
      ok(actiune(state, ctx, 'vindeBun', { id: state.produse.find((x) => x.bunId === 'masina-sh').id }).ok, 'mașina se vinde');
      ok(!areFlag(state, 'are_masina'), 'fără mașină, flag-ul dispare');
    },

    'lotul 7: tentația telefonului nou adaugă bunul; din meniu se poate deschide decizia despre locuință'() {
      const { ctx, state } = jocCumparator('tentatie');
      actiune(state, ctx, 'cumparaBun', { bun: 'telefon-buget', plata: 'cash' });
      forteazaEveniment(state, ctx, 'tentatie-telefon-nou');
      alege(state, ctx, 'cash');
      ok(state.produse.some((x) => x.bunId === 'telefon-premium'), 'telefonul nou e în inventar');
      ok(state.concepte.includes('cumparaturi-impuls'), 'concept');
      state.pendinte = null;
      state.an = null;
      const r = actiune(state, ctx, 'vreauLocuinta');
      ok(r.ok ? r.oprire?.eveniment === 'cumpara-locuinta' : r.mesaj.length > 3, `locuința: ${r.ok ? 'decizia s-a deschis' : r.mesaj}`);
    },
  };
}

// ---------- Lotul 6b: funcționarea afacerii ----------

function lot6b(ctxBaza, a) {
  const { ok, egal } = a;
  // O firmă pornită (SRL, pregătire dată), cu lunile rulate direct prin proceseazaAfacere.
  const firma = (seed, domeniu, pregatireTotal = 70, setari = {}) => {
    const { ctx, state } = a.jocFaraVenit(seed);
    a.consuma(state, ctx, oprireCurenta(state, ctx), a.primaDisponibila);
    state.luna = 10 * 12;
    state.numerar = inBani(400_000);
    state.recurente = [];
    state.an = null; // între ani, ca într-un joc real (evenimentele forțate se pot alege)
    const r = actiune(state, ctx, 'pornesteAfacere', { domeniu, forma: 'srl' });
    if (!r.ok) throw new Error(r.mesaj);
    const af = state.produse.find((p) => p.tip === 'afacere');
    af.pregatire = pregatireTotal;
    if (Object.keys(setari).length) actiune(state, ctx, 'seteazaAfacere', setari);
    const luni = (n) => { for (let i = 0; i < n; i++) { proceseazaAfacere(state, ctx); state.luna += 1; } };
    return { ctx, state, af, luni };
  };
  const suma = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
  return {
    'lotul 6b: prețul mic aduce mai multe vânzări; prețul mare, mai puțină marfă pe aceeași lună'() {
      const mic = firma('pret', 'cafenea', 70, { pret: 'mic' });
      const mare = firma('pret', 'cafenea', 70, { pret: 'mare' });
      mic.luni(18);
      mare.luni(18);
      ok(suma(mic.af.istoric, 'venit') > suma(mare.af.istoric, 'venit'), 'vânzări mai mari cu preț mic');
      ok(suma(mic.af.istoric, 'costuri') > suma(mare.af.istoric, 'costuri'), 'dar și mai multă marfă (costuri)');
    },

    'lotul 6b: fără angajați în plus pierzi clienții peste capacitate; marketingul are randament descrescător'() {
      const plin = firma('capacitate', 'salon', 100, { marketing: 3000, pret: 'mic' });
      plin.luni(14);
      ok(plin.state.produse.includes(plin.af), 'firma e încă activă');
      ok(plin.af.clientiPierduti > 0, 'cererea depășește capacitatea echipei');
      const pierduti = plin.af.clientiPierduti;
      actiune(plin.state, plin.ctx, 'seteazaAfacere', { angajatiExtra: 3 });
      plin.luni(1);
      ok(plin.af.clientiPierduti < pierduti, `cu 3 angajați în plus pierzi mai puțini clienți (${pierduti / 100} → ${plin.af.clientiPierduti / 100} lei)`);
      const b = plin.ctx.balans.afaceri.marketing;
      const bonus = (m) => b.bonusMax * (1 - Math.exp(-m / (b.scalaMarketing * 1)));
      ok(bonus(0.1) - bonus(0) > bonus(0.2) - bonus(0.1), 'primii lei de marketing aduc mai mult decât următorii');
    },

    'lotul 6b: la IT clienții plătesc după 2 luni: profit pe hârtie, cont gol la început'() {
      const { af, luni } = firma('cash', 'it', 80);
      luni(2);
      const profit = suma(af.istoric, 'profit');
      const cash = suma(af.istoric, 'cash');
      ok(cash < profit, `primele 2 luni: profit ${profit / 100} lei, bani intrați net ${cash / 100} lei`);
      luni(10);
      // Pe tot anul: banii intrați = profitul minus facturile ultimelor 2 luni, încă neîncasate.
      const neincasat = af.istoric.slice(-2).reduce((s, x) => s + x.venit, 0);
      egal(suma(af.istoric, 'cash'), suma(af.istoric, 'profit') - neincasat, 'diferența dintre profit și cash = facturile neîncasate');
    },

    'lotul 6b: riscurile sunt decizii: clientul rău-platnic, concurența, controlul fiscal'() {
      const { ctx, state, af, luni } = firma('riscuri', 'constructii', 70);
      luni(8);
      const cont = af.cont;
      forteazaEveniment(state, ctx, 'afacere-client-neplatitor', { suma: 3000 });
      alege(state, ctx, 'renunt');
      egal(af.cont, cont, 'renunțarea nu aduce bani');
      forteazaEveniment(state, ctx, 'afacere-concurenta');
      alege(state, ctx, 'nimic');
      ok(areFlag(state, 'concurenta_afacere'), 'concurența ține un an');
      const cont2 = af.cont;
      forteazaEveniment(state, ctx, 'afacere-control-fiscal');
      alege(state, ctx, 'platesc');
      egal(af.cont, cont2 - pret(state, ctx, 'afaceri.amendaControlFiscal'), 'amenda iese din contul firmei');
      ok(state.concepte.includes('control-fiscal'), 'concept');
    },

    'lotul 6b: vânzarea după un an pe profit; extinderea cere afacere așezată și bani'() {
      const { ctx, state, af, luni } = firma('vanzare', 'it', 90);
      ok(!actiune(state, ctx, 'vindeAfacerea').ok, 'nimeni nu cumpără o firmă nouă');
      ok(!actiune(state, ctx, 'extindeAfacerea').ok, 'nici extinderea nu merge de la început');
      luni(24);
      const potentialInainte = af.nivel ?? 0;
      af.cont += inBani(100_000);
      ok(actiune(state, ctx, 'extindeAfacerea').ok, 'extinsă');
      egal(af.nivel, potentialInainte + 1, 'un nivel în plus');
      luni(12);
      const sim = simuleazaVanzareFirma(state, ctx);
      ok(sim.ok && sim.pretFirma > 0, `prețul firmei: ${sim.pretFirma / 100} lei`);
      const bani = baniDisponibili(state);
      ok(actiune(state, ctx, 'vindeAfacerea').ok, 'vândută');
      egal(baniDisponibili(state) - bani, sim.net, 'primești prețul net');
      ok(!state.produse.includes(af), 'firma nu mai e a ta');
    },
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
        seteazaAfacere: [{ pret: 'mic' }, { pret: 'gratis' }, { marketing: 100 }, { angajatiExtra: 9 }],
        extindeAfacerea: [{}],
        imprumutFirma: [{ suma: 1000 }],
        vindeAfacerea: [{}],
        cumparaBun: [{ bun: 'bicicleta', plata: 'cash' }, { bun: 'nu-exista', plata: 'cash' }, { bun: 'ceas', plata: 'bnpl' }],
        vindeBun: [{ id: id('contCurent') }],
        vreauLocuinta: [{}],
        asigurare: [{ tip: 'viata' }, { tip: 'locuinta' }, { tip: 'viata', activ: false }, { tip: 'nu-exista' }],
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
