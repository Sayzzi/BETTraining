// Figures and references for the « La science » page, taken from docs/research/bet-science.md.
// Bibliographic entries stay as published; what each one shows is translated in messages.

export type EffectGroup = "fatigued" | "fresh" | "effort";

export type Effect = {
  /** Review the figure comes from, matching a SOURCES id. */
  source: SourceId;
  group: EffectGroup;
  /** Standardised effect size (SMD or Hedges' g). */
  value: number;
  /** 95 % confidence interval, when the review reports it. */
  ci: [number, number] | null;
};

/** Pooled effects of BET in the three 2026 meta-analyses. */
export const EFFECTS: Effect[] = [
  { source: "yu2026", group: "fatigued", value: 0.87, ci: [0.61, 1.13] },
  { source: "zheng2026", group: "fatigued", value: 0.85, ci: null },
  { source: "wang2026", group: "fatigued", value: 0.82, ci: [0.33, 1.3] },
  { source: "yu2026", group: "fresh", value: 0.21, ci: [0.08, 0.34] },
  { source: "zheng2026", group: "fresh", value: 0.01, ci: null },
  { source: "wang2026", group: "fresh", value: 0.73, ci: [-0.03, 1.49] },
  { source: "zheng2026", group: "effort", value: -0.01, ci: null },
];

export const EFFECT_GROUPS: EffectGroup[] = ["fatigued", "fresh", "effort"];

/** Conventional threshold for a large standardised effect. */
export const LARGE_EFFECT = 0.8;

export const SOURCES = {
  marcora2009: {
    citation: "Marcora SM, Staiano W, Manning V (2009). J Appl Physiol 106:857.",
    doi: "10.1152/japplphysiol.91324.2008",
  },
  basner2011: {
    citation: "Basner M, Mollicone D, Dinges DF (2011). Acta Astronaut 69:949.",
    doi: "10.1016/j.actaastro.2011.07.015",
  },
  simons2016: {
    citation: "Simons DJ et al. (2016). Psychol Sci Public Interest 17:103.",
    doi: "10.1177/1529100616661983",
  },
  vanCutsem2017: {
    citation: "Van Cutsem J et al. (2017). Sports Med 47:1569.",
    doi: "10.1007/s40279-016-0672-0",
  },
  brown2020: {
    citation: "Brown DMY et al. (2020). Sports Med 50:497.",
    doi: "10.1007/s40279-019-01204-8",
  },
  holgado2020: {
    citation: "Holgado D et al. (2020). J Cogn 3:38.",
    doi: "10.5334/joc.126",
  },
  holgado2021: {
    citation: "Holgado D et al. (2021). Eur J Sport Sci 21:762.",
    doi: "10.1080/17461391.2020.1781265",
  },
  staiano2023: {
    citation: "Staiano W et al. (2023). J Sci Med Sport 26:375.",
    doi: "10.1016/j.jsams.2023.05.008",
  },
  deLimaJunior2023: {
    citation: "de Lima-Junior D et al. (2023). Scand J Med Sci Sports 33:2166.",
    doi: "10.1111/sms.14457",
  },
  dallaway2025: {
    citation: "Dallaway N et al. (2025). J Funct Morphol Kinesiol 10:391.",
    doi: "10.3390/jfmk10040391",
  },
  yu2026: {
    citation: "Yu J et al. (2026). Front Physiol 17:1746298.",
    doi: "10.3389/fphys.2026.1746298",
  },
  zheng2026: {
    citation: "Zheng X et al. (2026). Front Physiol 17:1923855.",
    doi: "10.3389/fphys.2026.1923855",
  },
  wang2026: {
    citation: "Wang N et al. (2026). Front Psychol.",
    doi: "10.3389/fpsyg.2026.1858200",
  },
  qing2026: {
    citation: "Qing Z et al. (2026). Front Psychol.",
    doi: "10.3389/fpsyg.2026.1828644",
  },
} satisfies Record<string, { citation: string; doi: string }>;

export type SourceId = keyof typeof SOURCES;

export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

export function doiUrl(doi: string) {
  return `https://doi.org/${doi}`;
}
