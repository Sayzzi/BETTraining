"use client";

import { useTranslations } from "next-intl";
import { STROOP_COLORS, STROOP_SPEC, type StroopColor, type StroopStimulus } from "@/engine/stroop";
import { ChoicePlayer, choiceEngine } from "./choice-player";
import type { FixedRun } from "./use-exercise-run";

const ENGINE = choiceEngine("stroop", STROOP_SPEC);

// Bright inks chosen to stand apart on the slate exercise surface.
export const INK: Record<StroopColor, string> = {
  red: "#ff5c5c",
  green: "#3dd68c",
  blue: "#5b9bff",
  yellow: "#ffc21a",
};

const KEYS: Record<StroopColor, string> = { red: "d", green: "f", blue: "j", yellow: "k" };

export function StroopPlayer({ fixed }: { fixed?: FixedRun } = {}) {
  const t = useTranslations("stroop");
  return (
    <ChoicePlayer<StroopStimulus>
      engine={ENGINE}
      fixed={fixed}
      namespace="stroop"
      options={STROOP_COLORS.map((color) => ({
        id: color,
        label: t(`colors.${color}`),
        keyHint: KEYS[color].toUpperCase(),
        keys: [KEYS[color], KEYS[color].toUpperCase()],
        swatch: INK[color],
      }))}
      renderStimulus={(stimulus) => (
        <p
          className="type-wide text-[clamp(3rem,11vw,6.5rem)] leading-none font-extrabold"
          style={{ color: INK[stimulus.ink] }}
        >
          {t(`words.${stimulus.word}`)}
        </p>
      )}
    />
  );
}
