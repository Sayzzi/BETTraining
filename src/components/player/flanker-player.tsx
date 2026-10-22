"use client";

import { useTranslations } from "next-intl";
import { FLANKER_SPEC, flankerDisplay, type FlankerStimulus } from "@/engine/flanker";
import { ChoicePlayer, choiceEngine } from "./choice-player";
import type { FixedRun } from "./use-exercise-run";

const ENGINE = choiceEngine("flanker", FLANKER_SPEC);

export function FlankerPlayer({ fixed }: { fixed?: FixedRun } = {}) {
  const t = useTranslations("flanker");
  return (
    <ChoicePlayer<FlankerStimulus>
      engine={ENGINE}
      fixed={fixed}
      namespace="flanker"
      options={[
        { id: "left", label: t("left"), keyHint: t("leftKey"), keys: ["f", "F", "ArrowLeft"] },
        { id: "right", label: t("right"), keyHint: t("rightKey"), keys: ["j", "J", "ArrowRight"] },
      ]}
      renderStimulus={(stimulus) => (
        <p
          className="text-[clamp(3.5rem,12vw,7rem)] leading-none font-bold tracking-[0.15em] text-brume"
        >
          {flankerDisplay(stimulus).replaceAll("<", "←").replaceAll(">", "→")}
        </p>
      )}
    />
  );
}
