// Analiza conținutului, peste validarea de schemă (content.js): legături care nu se văd
// dintr-un singur fișier. Folosită de tools/validate.html și de teste.
// - flag-uri setate dar niciodată citite (și invers)
// - evenimente la care nu se poate ajunge
// - concepte fără nicio sursă (nu se pot debloca)

// Ce face motorul singur, fără JSON (ținut aici ca să nu dea alarme false).
export const MOTOR = {
  flaguriSetate: ['istoric_restante', 'executare_silita', 'datorie_recuperator', 'deconectat', 'telefon_suspendat',
    'evacuat', 'absolvent_licenta', 'absolvent_profesionala', 'experienta_munca', 'cautare_job'],
  flaguriCitite: ['cautare_job', 'somaj', 'deconectat', 'telefon_suspendat', 'cv_umflat', 'pastrat_in_criza', 'are_locuinta', 'netratat'],
  evenimente: ['facturi-somatie', 'evacuare', 'independenta-financiara', 'prabusire-bursa', 'rata-variabila-crescuta'],
  concepte: ['rata', 'brut-net', 'pilonii-pensiei', 'poprire', 'poprire-cont', 'dobanda-compusa', 'puterea-de-cumparare'],
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
    },
  };
}
