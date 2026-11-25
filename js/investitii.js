// Meniul Investiții: cumpărare și vânzare pe clase (inclusiv companii inventate), investiția automată
// lunară (DCA, și în Pilonul III), portofoliul (alocare, câștig, comisioane), rebalansarea după o
// strategie și istoricul anual pentru grafic. Conținutul e în data/investitii.json.

import { cfg, formateazaLei, inLei, varstaLa } from './util.js';
import { aleator, normal } from './rng.js';
import {
  baniDisponibili, esteCompanie, incaseaza, indiceClasa, paramClasa, plateste, valoareProdus, valoareVanzare,
} from './finance.js';
import { deschideProdus } from './events.js';
import { adaugaJurnal, avereNeta, datoriiTotale } from './state.js';

const leiText = (bani) => `${formateazaLei(inLei(bani))} lei`;
const bl = (state) => state.bilant ?? {};

// ---------- Clase ----------

export function infoClasa(ctx, clasa) {
  return ctx.investitii?.clase.get(clasa) ?? ctx.investitii?.companii.get(clasa) ?? null;
}

export const esteDePiata = (p) => p.tip === 'investitie' && p.clasa !== 'titluriStat';
const investitii = (state) => state.produse.filter((p) => p.tip === 'investitie');

export function companieFalimentata(state, clasa) {
  return esteCompanie(clasa) && !(state.piete[clasa] > 0);
}

// ---------- Piața companiilor (lunar, din motor) ----------

// Companiile se mișcă cu bursa (beta), plus norocul lor (alfa, volatilitate) și un risc de faliment.
// Folosesc fluxul RNG „companii”: piața principală rămâne aceeași, orice ar face jucătorul.
export function miscaCompanii(state, ctx, factorActiuni) {
  for (const c of ctx.investitii?.companii.values() ?? []) {
    if (!(c.id in state.piete)) state.piete[c.id] = 100; // salvare veche sau companie nouă în conținut
    const z = normal(state, 'companii');
    const faliment = aleator(state, 'companii') < c.riscFalimentAnual / 12;
    if (!(state.piete[c.id] > 0)) continue; // falimentată: rămâne la zero
    if (faliment) {
      state.piete[c.id] = 0;
      if (investitii(state).some((p) => p.clasa === c.id)) {
        adaugaJurnal(state, `${c.titlu} a intrat în faliment. Acțiunile tale nu mai valorează nimic.`);
      }
      continue;
    }
    const sigma = c.volatilitate / Math.sqrt(12);
    state.piete[c.id] *= Math.pow(factorActiuni, c.beta) * Math.exp(c.alfa / 12 - (sigma * sigma) / 2 + sigma * z);
  }
}

// Comisionul anual de administrare (TER), scăzut lunar din unități. Întoarce cât s-a dus pe comisioane.
export function aplicaComisioaneAnuale(state, ctx) {
  let total = 0;
  for (const p of investitii(state)) {
    const ter = paramClasa(ctx, p.clasa, 'comisionAnual');
    if (!ter || p.clasa === 'titluriStat') continue;
    const inainte = valoareProdus(p, state);
    p.unitati *= 1 - ter / 12;
    total += inainte - valoareProdus(p, state);
  }
  if (total && state.bilant) state.bilant.comisioaneInvestitii = (state.bilant.comisioaneInvestitii ?? 0) + total;
  return total;
}

// ---------- Cumpărare și vânzare ----------

export function cumpara(state, ctx, clasa, suma, { automat = false } = {}) {
  if (!infoClasa(ctx, clasa)) return { ok: false, mesaj: 'Nu există o astfel de investiție.' };
  if (companieFalimentata(state, clasa)) return { ok: false, mesaj: 'Compania a dat faliment: acțiunile ei nu se mai pot cumpăra.' };
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma pe care vrei s-o investești.' };
  if (baniDisponibili(state) < suma) return { ok: false, mesaj: 'Nu ai destui bani disponibili.' };
  const p = deschideProdus(state, ctx, { tip: 'investitie', clasa, suma });
  if (!p) return { ok: false, mesaj: 'Nu ai destui bani disponibili.' };
  if (state.bilant && p.comision) state.bilant.comisioaneInvestitii = (state.bilant.comisioaneInvestitii ?? 0) + p.comision;
  const info = infoClasa(ctx, clasa);
  if (!automat) adaugaJurnal(state, `Ai investit ${leiText(suma)} în ${info.titlu}.`);
  const concepte = ['risc-randament'];
  if (clasa === 'etf' || clasa === 'fondActiv') concepte.push('etf', 'cost-comisioane');
  if (esteCompanie(clasa)) concepte.push('diversificare');
  return {
    ok: true, produs: p,
    mesaj: `Ai investit ${leiText(suma)} în ${info.titlu}${p.comision ? ` (comision ${leiText(p.comision)})` : ''}.`,
    lectie: esteCompanie(clasa) ? 'O singură companie poate să se dubleze sau să dispară. Un ETF are sute: dacă una cade, abia simți.' : null,
    concepte,
  };
}

// Vinde o fracțiune (0–1] dintr-o investiție de piață: comision + impozit pe câștig.
function vindeFractiune(state, ctx, p, fractie) {
  const v = valoareVanzare(p, state, ctx);
  const brut = Math.round(v.brut * fractie);
  const comision = Math.round(v.comision * fractie);
  const cost = Math.round((p.cost ?? 0) * fractie);
  const impozit = Math.round(Math.max(0, brut - comision - cost) * cfg(ctx, 'taxe.impozitCastiguriInvestitii'));
  const net = brut - comision - impozit;
  incaseaza(state, net);
  if (state.bilant) {
    state.bilant.castigRealizat = (state.bilant.castigRealizat ?? 0) + (net - cost);
    state.bilant.comisioaneInvestitii = (state.bilant.comisioaneInvestitii ?? 0) + comision;
  }
  if (fractie >= 0.9999) state.produse = state.produse.filter((x) => x !== p);
  else {
    p.unitati *= 1 - fractie;
    p.cost -= cost;
  }
  return { net, comision, impozit, castig: net - cost };
}

// Vinde `suma` (lei, valoare de piață) dintr-o clasă, începând cu cele mai vechi cumpărături. suma = null: tot.
export function vinde(state, ctx, clasa, suma = null) {
  if (clasa === 'titluriStat') return { ok: false, mesaj: 'Titlurile de stat se încasează la scadență, nu se vând înainte.' };
  const loturi = investitii(state).filter((p) => p.clasa === clasa);
  const total = loturi.reduce((s, p) => s + valoareProdus(p, state), 0);
  if (!total) return { ok: false, mesaj: 'Nu ai investiții de felul ăsta (sau nu mai valorează nimic).' };
  let deVandut = suma == null ? total : Math.min(suma, total);
  if (!(deVandut > 0)) return { ok: false, mesaj: 'Scrie suma pe care vrei s-o vinzi.' };
  const r = { net: 0, comision: 0, impozit: 0, castig: 0 };
  for (const p of loturi) {
    if (deVandut <= 0) break;
    const val = valoareProdus(p, state);
    const f = Math.min(1, deVandut / val);
    const x = vindeFractiune(state, ctx, p, f);
    for (const k of Object.keys(r)) r[k] += x[k];
    deVandut -= val * f;
  }
  const info = infoClasa(ctx, clasa);
  adaugaJurnal(state, `Ai vândut ${info?.titlu ?? clasa} și ai primit ${leiText(r.net)}${r.castig >= 0 ? `, cu un câștig de ${leiText(r.castig)}` : `, cu o pierdere de ${leiText(-r.castig)}`}.`);
  return {
    ok: true, ...r,
    mesaj: `Ai primit ${leiText(r.net)} (comision ${leiText(r.comision)}${r.impozit ? `, impozit pe câștig ${leiText(r.impozit)}` : ''}).`,
  };
}

// ---------- Investiția automată lunară (DCA) ----------

// state.dca: [{ clasa (sau „pilon3”), suma (lei, la prețurile din momentul setării) }]
export function seteazaDCA(state, ctx, clasa, sumaLei) {
  if (clasa !== 'pilon3' && !infoClasa(ctx, clasa)) return { ok: false, mesaj: 'Nu există o astfel de investiție.' };
  if (clasa === 'titluriStat') return { ok: false, mesaj: 'Titlurile de stat se cumpără la emisiuni, nu lunar automat.' };
  state.dca = (state.dca ?? []).filter((x) => x.clasa !== clasa);
  if (!(sumaLei > 0)) return { ok: true, mesaj: 'Ai oprit investiția automată.' };
  state.dca.push({ clasa, suma: Math.round(sumaLei * 100), luniSarite: 0 });
  const nume = clasa === 'pilon3' ? 'Pilonul III' : infoClasa(ctx, clasa).titlu;
  return {
    ok: true,
    mesaj: `În fiecare lună, după salariu, se investesc automat ${leiText(Math.round(sumaLei * 100))} în ${nume}.`,
    lectie: 'Investind aceeași sumă lunar cumperi mai mult când e ieftin și mai puțin când e scump, fără să ghicești momentul.',
    concepte: clasa === 'pilon3' ? ['pilonii-pensiei', 'investitie-lunara'] : ['investitie-lunara'],
  };
}

// Lunar, la sfârșitul lunii (după facturi): investește doar dacă banii ajung, altfel sare luna.
export function proceseazaDCA(state, ctx) {
  let investit = 0;
  for (const d of state.dca ?? []) {
    if (baniDisponibili(state) < d.suma) {
      d.luniSarite = (d.luniSarite ?? 0) + 1;
      continue;
    }
    if (d.clasa === 'pilon3') {
      plateste(state, d.suma);
      state.pensie.pilon3 = (state.pensie.pilon3 ?? 0) + d.suma;
      investit += d.suma;
    } else if (cumpara(state, ctx, d.clasa, d.suma, { automat: true }).ok) investit += d.suma;
  }
  return investit;
}

export function depunePilon3(state, ctx, suma) {
  if (!(suma > 0)) return { ok: false, mesaj: 'Scrie suma.' };
  if (baniDisponibili(state) < suma) return { ok: false, mesaj: 'Nu ai destui bani disponibili.' };
  plateste(state, suma);
  state.pensie.pilon3 = (state.pensie.pilon3 ?? 0) + suma;
  adaugaJurnal(state, `Ai depus ${leiText(suma)} în Pilonul III.`);
  return {
    ok: true, mesaj: `Ai depus ${leiText(suma)} în Pilonul III. Banii cresc până la pensie.`,
    lectie: 'Pilonul III e o pensie pe care ți-o construiești singur; banii se pot scoate abia la 60 de ani.',
    concepte: ['pilonii-pensiei'],
  };
}

// ---------- Portofoliul ----------

export function portofoliu(state, ctx) {
  const randuri = new Map();
  for (const p of investitii(state)) {
    const r = randuri.get(p.clasa) ?? { clasa: p.clasa, titlu: infoClasa(ctx, p.clasa)?.titlu ?? p.clasa, emoji: infoClasa(ctx, p.clasa)?.emoji ?? '', valoare: 0, cost: 0, loturi: 0 };
    r.valoare += valoareProdus(p, state);
    r.cost += p.cost ?? 0;
    r.loturi += 1;
    randuri.set(p.clasa, r);
  }
  const lista = [...randuri.values()];
  const total = lista.reduce((s, r) => s + r.valoare, 0);
  for (const r of lista) {
    r.castig = r.valoare - r.cost;
    r.pondere = total ? r.valoare / total : 0;
    r.falimentata = companieFalimentata(state, r.clasa);
  }
  lista.sort((a, b) => b.valoare - a.valoare);
  return {
    randuri: lista, total, cost: lista.reduce((s, r) => s + r.cost, 0),
    comisioane: Math.round(bl(state).comisioaneInvestitii ?? 0),
    castigRealizat: Math.round(bl(state).castigRealizat ?? 0),
    pilon3: state.pensie.pilon3 ?? 0, pilon2: state.pensie.pilon2 ?? 0,
    dca: state.dca ?? [], istoric: state.istoricPortofoliu ?? [],
  };
}

// La sfârșitul fiecărui an: un punct pentru graficul portofoliului și al averii nete.
export function instantaneuAnual(state) {
  const p = investitii(state);
  (state.istoricPortofoliu ??= []).push({
    varsta: varstaLa(state.luna - 1),
    investitii: p.reduce((s, x) => s + valoareProdus(x, state), 0),
    investit: p.reduce((s, x) => s + (x.cost ?? 0), 0),
    avere: avereNeta(state),
    datorii: datoriiTotale(state),
    indice: state.indicePreturi,
  });
}

// ---------- Rebalansare ----------

// Aduce portofoliul la alocarea strategiei: vinde ce e peste țintă, cumpără ce e sub.
// Titlurile de stat nu se vând (se ating doar prin cumpărare).
export function rebalanseaza(state, ctx, idStrategie) {
  const s = ctx.investitii?.strategii.get(idStrategie);
  if (!s) return { ok: false, mesaj: 'Strategia asta nu există.' };
  const port = portofoliu(state, ctx);
  if (port.total < 10000) return { ok: false, mesaj: 'Ai prea puțin investit ca să rebalansezi.' };
  const valoare = (clasa) => port.randuri.find((r) => r.clasa === clasa)?.valoare ?? 0;
  let comisioane = 0;
  let impozit = 0;
  // 1. Vinde surplusul (inclusiv clasele care nu sunt în strategie, ex. o companie).
  for (const r of port.randuri) {
    if (r.clasa === 'titluriStat') continue;
    const surplus = r.valoare - (s.alocare[r.clasa] ?? 0) * port.total;
    if (surplus > 1000) {
      const v = vinde(state, ctx, r.clasa, surplus);
      if (v.ok) { comisioane += v.comision; impozit += v.impozit; }
    }
  }
  // 2. Cumpără ce lipsește, cât ajung banii obținuți (și cei din cont).
  for (const [clasa, w] of Object.entries(s.alocare)) {
    const lipsa = Math.round(w * port.total - valoare(clasa));
    const suma = Math.min(lipsa, baniDisponibili(state));
    if (suma > 1000) {
      const c = cumpara(state, ctx, clasa, suma, { automat: true });
      if (c.ok) comisioane += c.produs.comision ?? 0;
    }
  }
  state.tintaInvestitii = idStrategie;
  adaugaJurnal(state, `Ți-ai rebalansat portofoliul pe strategia ${s.titlu.toLowerCase()}.`);
  return {
    ok: true,
    mesaj: `Portofoliul e acum pe strategia ${s.titlu.toLowerCase()}. Te-a costat ${leiText(comisioane)} comisioane${impozit ? ` și ${leiText(impozit)} impozit pe câștig` : ''}.`,
    lectie: 'Rebalansarea vinde ce a crescut mult și cumpără ce a rămas în urmă: îți ține riscul acolo unde l-ai ales.',
    concepte: ['diversificare', 'rebalansare'],
  };
}
