// On-screen quantities. Scenes read these fields so a label cannot drift from the number it describes.
// illustrative: true means the graphic is a labeled scenario, not a census.

const CRUDE_BBL_PER_TONNE = 7.33;

export const malacca = {
  asOf: "2024",
  source: "Episode 3 planning case. The import split is a round level; the stock is hypothetical, not a published reserve.",
  illustrative: true,
  importsMbd: 11,
  southernMbd: 6,
  pacificOrLandMbd: 5,
  stockMbbl: 800,
};

export const inlandCrude = {
  asOf: "design capacity",
  source: "Design capacities named in episode 3. Tons of crude convert at 7.33 barrels per tonne.",
  illustrative: false,
  lines: [
    { label: "MYANMAR", mtYear: 22 },
    { label: "KAZAKHSTAN", mtYear: 20 },
    { label: "RUSSIA → DAQING", mtYear: 30 },
  ],
  powerOfSiberiaBcmYear: 38,
};

export const germanGasBeforeBreak = {
  asOf: "before 2022",
  source: "Episode 4 pre-break split: more than half of imported gas from Russia, drawn as an approximate Sankey.",
  illustrative: true,
  shares: [
    { label: "RUSSIA · PIPE", pct: 55, colorKey: "russia" },
    { label: "NORWAY", pct: 30, colorKey: "other" },
    { label: "NETHERLANDS", pct: 12, colorKey: "other" },
    { label: "OTHER", pct: 3, colorKey: "other" },
  ],
};

// Hand trace in geo.mjs. The date is what the episode 2 map is claiming to show.
export const contactLine = {
  asOf: "2026-01",
  approximate: true,
  source: "Hand-placed coordinates in geo.mjs (CONTACT_LINE). Not a survey and not a legal boundary.",
  caption: "CONTACT LINE · APPROX. · JAN 2026",
};

export function inlandMtYear() {
  return inlandCrude.lines.reduce((sum, line) => sum + line.mtYear, 0);
}

export function inlandMbd() {
  return (inlandMtYear() * CRUDE_BBL_PER_TONNE) / 365;
}

// Spoken orders of magnitude: tens of days below 100, otherwise rough 30-day months.
export function orderOf(stockMbbl, deficitMbd) {
  const days = stockMbbl / deficitMbd;
  if (days < 100) return `≈ ${Math.round(days / 10) * 10} DAYS`;
  return `≈ ${Math.round(days / 30)} MONTHS`;
}

function assertFigures() {
  const { importsMbd, southernMbd, pacificOrLandMbd } = malacca;
  if (southernMbd + pacificOrLandMbd !== importsMbd) {
    throw new Error(`malacca split ${southernMbd}+${pacificOrLandMbd} does not equal imports ${importsMbd}`);
  }
  const pct = germanGasBeforeBreak.shares.reduce((sum, row) => sum + row.pct, 0);
  if (pct !== 100) throw new Error(`German gas shares sum to ${pct}, not 100`);
  if (!(inlandMbd() < 1.5)) throw new Error(`inland crude ${inlandMbd()} is no longer under 1.5 mb/d; update the narration`);
}

assertFigures();
