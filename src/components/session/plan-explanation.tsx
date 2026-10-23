import { useFormatter, useTranslations } from "next-intl";
import type { PlanExplanation } from "@/engine/session-plan";

/** Why the session is composed this way, in a few short sentences. */
export function PlanExplanationText({ explanation }: { explanation: PlanExplanation }) {
  const t = useTranslations("planExplanation");
  const tNames = useTranslations("names");
  const format = useFormatter();
  const list = (items: string[]) => format.list(items, { type: "conjunction" });
  const domains = (items: string[]) => list(items.map((d) => tNames(`domains.${d}` as "domains.inhibition")));
  const exercises = (items: string[]) => list(items.map((e) => tNames(`exercises.${e}` as "exercises.stroop")));
  const targeted = [...new Set(explanation.targetedDomains)];

  return (
    <p>
      {!explanation.rankingAvailable
        ? t("noRanking")
        : explanation.weaknesses.length > 0
          ? t("weaknesses", { count: explanation.weaknesses.length, domains: domains(explanation.weaknesses) })
          : t("noWeakness")}{" "}
      {t("targeted", { domains: domains(targeted) })}{" "}
      {explanation.betExercises.length === 0
        ? null
        : explanation.replacedBetExercises.length > 0
        ? t("betRotation", {
            exercises: exercises(explanation.betExercises),
            replaced: exercises(explanation.replacedBetExercises),
          })
        : t("bet", { exercises: exercises(explanation.betExercises) })}
    </p>
  );
}
