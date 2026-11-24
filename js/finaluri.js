// Finalurile colecționabile (data/endings.json): se alege cel cu prioritatea cea mai mare
// ale cărui condiții se potrivesc cu rezumatul vieții (bilant.rezumatViata).

const VERIFICARI = {
  motiv: (v, r) => v.includes(r.motiv),
  varstaMax: (v, r) => r.varsta <= v,
  avereAziMin: (v, r) => r.avereAzi >= v,
  avereAziMax: (v, r) => r.avereAzi <= v,
  venitPasivAcopera: (v, r) => r.venitPasivAcopera === v,
  varstaIndependentaMax: (v, r) => r.varstaIndependenta != null && r.varstaIndependenta <= v,
  aniLuxMax: (v, r) => r.aniLux <= v,
  aniConfortabilMax: (v, r) => r.aniConfortabil <= v,
  aniNegruMin: (v, r) => r.aniNegru >= v,
  ifnMin: (v, r) => r.ifnLuate >= v,
  rateCumparaturiMin: (v, r) => r.rateCumparaturi >= v,
  socuriAbsorbiteMin: (v, r) => r.socuriAbsorbite >= v,
  casaPlatita: (v, r) => r.casaPlatita === v,
};
export const CONDITII_FINAL = Object.keys(VERIFICARI);

export function potrivesteFinal(final, rezumat) {
  return Object.entries(final.conditii ?? {}).every(([k, v]) => VERIFICARI[k](v, rezumat));
}

export function alegeFinal(finaluri, rezumat) {
  return [...finaluri.values()]
    .filter((f) => potrivesteFinal(f, rezumat))
    .sort((a, b) => b.prioritate - a.prioritate)[0] ?? null;
}
