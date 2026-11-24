// Analiza conținutului, peste validarea de schemă (content.js): legături care nu se văd
// dintr-un singur fișier. Folosită de tools/validate.html și de teste.
// - flag-uri setate dar niciodată citite (și invers)
// - evenimente la care nu se poate ajunge
// - concepte fără nicio sursă (nu se pot debloca)

// Ce face motorul singur, fără JSON (ținut aici ca să nu dea alarme false).
export const MOTOR = {
  flaguriSetate: ['istoric_restante', 'executare_silita', 'datorie_recuperator', 'deconectat', 'telefon_suspendat',
    'evacuat', 'absolvent_licenta', 'absolvent_profesionala', 'experienta_munca', 'cautare_job', 'clauza_fidelitate'],
  flaguriCitite: ['cautare_job', 'somaj', 'deconectat', 'telefon_suspendat', 'cv_umflat', 'pastrat_in_criza', 'are_locuinta', 'netratat', 'clauza_fidelitate',
    'concurenta_afacere'],
  evenimente: ['facturi-somatie', 'evacuare', 'independenta-financiara', 'prabusire-bursa', 'rata-variabila-crescuta',
    'imobil-reparatie', 'imobil-chirias-nu-plateste', 'afacere-client-neplatitor', 'afacere-concurenta', 'afacere-control-fiscal'],
  concepte: ['rata', 'brut-net', 'pilonii-pensiei', 'poprire', 'poprire-cont', 'dobanda-compusa', 'puterea-de-cumparare',
    // din acțiunile meniului „Datoriile mele” (js/datorii.js)
    'rambursare-anticipata', 'avalansa-bulgare', 'refinantare', 'esalonare',
    // din meniul Investiții (js/investitii.js)
    'etf', 'cost-comisioane', 'diversificare', 'investitie-lunara', 'rebalansare',
    // din imobiliarele de închiriat (js/imobiliare.js)
    'randament-chirie', 'declaratia-unica',
    // din meniul Carieră (js/munca.js)
    'ore-suplimentare', 'clauza-fidelitate', 'venit-variabil',
    // din afacerea proprie (js/afacere.js)
    'plan-de-afaceri', 'raspundere-limitata', 'capital-de-lucru', 'salariu-angajator', 'evaluare-afacere',
    // din cumpărături (js/cumparaturi.js)
    'cost-total-detinere'],
};

const numeFlag = (f) => f.split(':')[0];

// Toate alegerile finale ale unui eveniment (inclusiv sub-alegeri și rezultate), cu calea lor.
function* pachete(ev) {
  for (const a of ev.alegeri ?? []) {
    const finale = a.subalegeri ? a.subalegeri.map((s) => [`${a.id}/${s.id}`, s, a]) : [[a.id, a, null]];
    for (const [cale, al, grup] of finale) {
      yield { cale, p: al, cere: [grup?.cere, al.cere] };
      for (const r of al.rezultate ?? []) yield { cale, p: r, cere: [] };
    }
  }
}

function flaguriDinConditii(cond, cititeAcc) {
  if (!cond) return;
  for (const f of [...(cond.flag ?? []), ...(cond.lipsaFlag ?? [])]) cititeAcc.add(f);
  for (const c of cond.sau ?? []) flaguriDinConditii(c, cititeAcc);
}

export function analizeazaContinut(ctx) {
  const setate = new Map(); // flag -> unde
  const citite = new Map();
  const adauga = (map, flag, unde) => {
    if (!map.has(flag)) map.set(flag, []);
    map.get(flag).push(unde);
  };
  const referite = new Set(); // evenimente programate ca urmări
  const concepteFolosite = new Set(MOTOR.concepte);
  const probleme = [];

  for (const ev of ctx.evenimente.values()) {
    const c = new Set();
    flaguriDinConditii(ev.conditii, c);
    c.forEach((f) => adauga(citite, f, `${ev.id} (condiții)`));
    for (const { cale, p, cere } of pachete(ev)) {
      const unde = `${ev.id} › ${cale}`;
      for (const f of p.flaguri ?? []) adauga(setate, numeFlag(f), unde);
      for (const pr of [p.produsNou ?? []].flat()) {
        if (pr.flag) adauga(setate, numeFlag(pr.flag), unde);
        if (pr.laRestanta) referite.add(pr.laRestanta);
      }
      const cc = new Set();
      cere.forEach((x) => flaguriDinConditii(x, cc));
      cc.forEach((f) => adauga(citite, f, `${unde} (cere)`));
      for (const u of p.urmari ?? []) referite.add(u.eveniment);
      for (const k of p.concepte ?? []) concepteFolosite.add(k);
    }
    // Condiții imposibile, ușor de prins
    const co = ev.conditii ?? {};
    if (co.varstaMin != null && co.varstaMax != null && co.varstaMin > co.varstaMax) probleme.push({ id: ev.id, mesaj: 'varstaMin > varstaMax: evenimentul nu poate apărea' });
    // Cel puțin o alegere fără nicio condiție: altfel jucătorul poate rămâne fără nicio variantă.
    const areSigura = (ev.alegeri ?? []).some((al) => !al.cere && (!al.subalegeri || al.subalegeri.some((sub) => !sub.cere)));
    if (!areSigura) probleme.push({ id: ev.id, mesaj: 'nicio alegere nu e mereu disponibilă (toate au „cere”): jucătorul poate rămâne blocat' });
    const contra = (co.flag ?? []).filter((f) => (co.lipsaFlag ?? []).includes(f));
    if (contra.length) probleme.push({ id: ev.id, mesaj: `cere și interzice același flag: ${contra.join(', ')}` });
  }
  // Activitățile din meniu: setează și citesc flag-uri, deblochează concepte, pot programa urmări.
  for (const act of ctx.activitati?.values() ?? []) {
    const unde = `activitate ${act.id}`;
    const c = new Set();
    flaguriDinConditii(act.conditii, c);
    c.forEach((f) => adauga(citite, f, `${unde} (condiții)`));
    for (const p of [act, ...(act.rezultate ?? [])]) {
      for (const f of p.flaguri ?? []) adauga(setate, numeFlag(f), unde);
      for (const k of p.concepte ?? []) concepteFolosite.add(k);
      for (const u of p.urmari ?? []) referite.add(u.eveniment);
    }
  }
  // Educația: condițiile citesc flag-uri, cursurile setează certificatul, iar joburile îl citesc.
  for (const p of [...(ctx.educatie?.programe.values() ?? []), ...(ctx.educatie?.cursuri.values() ?? [])]) {
    const c = new Set();
    flaguriDinConditii(p.conditii, c);
    c.forEach((f) => adauga(citite, f, `educație ${p.id} (condiții)`));
    if (p.flag) adauga(setate, p.flag, `curs ${p.id}`);
    for (const k of p.concepte ?? []) concepteFolosite.add(k);
  }
  for (const j of ctx.joburi.values()) {
    if (j.cerinte?.flagInLocDeStudii) adauga(citite, j.cerinte.flagInLocDeStudii, `job ${j.id} (în loc de diplomă)`);
    if (j.cerinte?.flagNecesar) adauga(citite, j.cerinte.flagNecesar, `job ${j.id} (cerință)`);
  }
  for (const s of ctx.secundare?.values() ?? []) if (s.cerinte?.flagNecesar) adauga(citite, s.cerinte.flagNecesar, `job secundar ${s.id}`);
  for (const b of ctx.cumparaturi?.bunuri.values() ?? []) if (b.flag) adauga(setate, b.flag, `cumpărătura ${b.id}`);
  // Studiile terminate setează absolvent_<nivel> și, unele, un flag propriu (balans.studii.<id>.flagLaFinal).
  for (const info of Object.values(ctx.balans?.studii ?? {})) {
    if (info?.nivel) adauga(setate, `absolvent_${info.nivel}`, 'motor (studii terminate)');
    if (info?.flagLaFinal) adauga(setate, info.flagLaFinal, 'motor (studii terminate)');
  }
  for (const f of Object.keys(ctx.balans?.cariera?.cv?.bonusFlaguri ?? {})) adauga(citite, f, 'motor (scorul CV-ului)');
  MOTOR.flaguriSetate.forEach((f) => adauga(setate, f, 'motor'));
  MOTOR.flaguriCitite.forEach((f) => adauga(citite, f, 'motor'));

  const pornire = [ctx.balans?.start?.evenimentStart, ctx.balans?.cariera?.evenimentCV, ...MOTOR.evenimente].filter(Boolean);
  pornire.forEach((id) => referite.add(id));

  const neatinse = [...ctx.evenimente.values()].filter((ev) => ev.doarUrmare && !referite.has(ev.id)).map((ev) => ev.id);
  const toateConceptele = [...ctx.concepte.keys()];

  return {
    flaguriNecitite: [...setate.keys()].filter((f) => !citite.has(f)).sort().map((f) => ({ flag: f, unde: setate.get(f) })),
    flaguriNesetate: [...citite.keys()].filter((f) => !setate.has(f)).sort().map((f) => ({ flag: f, unde: citite.get(f) })),
    evenimenteNeatinse: neatinse,
    concepteFaraSursa: toateConceptele.filter((k) => !concepteFolosite.has(k)),
    probleme,
    statistici: {
      evenimente: ctx.evenimente.size,
      peFaza: [1, 2, 3, 4, 5].map((f) => [...ctx.evenimente.values()].filter((e) => e.faza?.includes(f)).length),
      urmari: [...ctx.evenimente.values()].filter((e) => e.doarUrmare).length,
      concepte: toateConceptele.length,
      finaluri: ctx.finaluri?.size ?? 0,
      joburi: ctx.joburi.size,
      activitati: ctx.activitati?.size ?? 0,
    },
  };
}
