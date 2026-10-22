"use client";

import { useTranslations } from "next-intl";
import { CHOICE_RT_SPEC, CHOICE_RT_ZONES, type ChoiceRtStimulus } from "@/engine/choice-rt";
import { ChoicePlayer, choiceEngine } from "./choice-player";

const ENGINE = choiceEngine("choice_rt", CHOICE_RT_SPEC);
const KEYS = ["d", "f", "j", "k"];

/** The four zones, aligned with the answer buttons below; the lit one is the signal. */
function Zones({ lit }: { lit: number | null }) {
  return (
    <div className="grid w-full grid-cols-4 gap-3">
      {Array.from({ length: CHOICE_RT_ZONES }, (_, position) => (
        <div
          key={position}
          className={`h-28 w-full rounded-md border-2 md:h-40 ${
            position === lit ? "border-chrono bg-chrono" : "border-trait/30"
          }`}
        />
      ))}
    </div>
  );
}

export function ChoiceRtPlayer() {
  const t = useTranslations("choiceRt");
  return (
    <ChoicePlayer<ChoiceRtStimulus>
      engine={ENGINE}
      namespace="choiceRt"
      options={KEYS.map((key, position) => ({
        id: String(position),
        label: key.toUpperCase(),
        keyHint: t("zone", { number: position + 1 }),
        keys: [key, key.toUpperCase()],
      }))}
      optionsClassName="grid-cols-4"
      renderStimulus={(stimulus) => <Zones lit={stimulus.position} />}
      renderIdle={() => <Zones lit={null} />}
    />
  );
}
