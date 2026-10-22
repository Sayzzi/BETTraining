"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { detectDevice, detectInputMode } from "@/components/player/device";
import { PRIMARY_BUTTON, ProtocolRunner } from "@/components/protocol/protocol-runner";
import type { AssessmentBlock } from "@/engine/assessment";
import type { AssessmentStepRun, StartedAssessment } from "@/server/assessment";

type State =
  | { kind: "intro"; interrupted: boolean }
  | { kind: "starting" }
  | { kind: "running"; plan: StartedAssessment }
  | { kind: "finishing" }
  | { kind: "error" };

const PART: Record<AssessmentBlock, number> = { cold: 1, bet: 2, fatigued: 3 };

/** Intro, then the nine protocol steps, then the scores. */
export function AssessmentRunner() {
  const t = useTranslations("assessment");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "intro", interrupted: false });

  async function start() {
    setState({ kind: "starting" });
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          device: detectDevice(),
          inputMode: detectInputMode(),
          userAgent: navigator.userAgent.slice(0, 512),
        }),
      });
      if (!response.ok) throw new Error(`Start failed with status ${response.status}`);
      setState({ kind: "running", plan: await response.json() });
    } catch {
      setState({ kind: "error" });
    }
  }

  async function finish(assessmentId: string) {
    setState({ kind: "finishing" });
    try {
      const response = await fetch(`/api/assessment/${assessmentId}/complete`, { method: "POST" });
      if (!response.ok) throw new Error(`Completion failed with status ${response.status}`);
      router.push(`/bilan/resultats/${assessmentId}`);
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "intro" || state.kind === "starting") {
    return (
      <section className="max-w-[62ch]">
        <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
        {state.kind === "intro" && state.interrupted ? (
          <p role="status" className="mt-4 font-semibold text-alerte">
            {t("interrupted")}
          </p>
        ) : null}
        <p className="mt-6 text-lg">{t("intro")}</p>
        <ol className="mt-8 space-y-5 border-l-2 border-trait pl-6">
          {(["cold", "bet", "fatigued"] as const).map((block) => (
            <li key={block}>
              <p className="type-wide text-lg font-bold">{t(`parts.${block}.title`)}</p>
              <p className="mt-1 text-schiste">{t(`parts.${block}.summary`)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-lg">{t("advice")}</p>
        <button type="button" onClick={start} disabled={state.kind === "starting"} className={`mt-8 ${PRIMARY_BUTTON}`}>
          {state.kind === "starting" ? t("starting") : t("start")}
        </button>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section role="alert" className="max-w-[60ch]">
        <h1 className="type-wide text-3xl font-extrabold">{t("errorTitle")}</h1>
        <p className="mt-4 text-lg text-schiste">{t("errorBody")}</p>
        <button
          type="button"
          onClick={() => setState({ kind: "intro", interrupted: false })}
          className={`mt-8 ${PRIMARY_BUTTON}`}
        >
          {t("restart")}
        </button>
      </section>
    );
  }

  if (state.kind === "finishing") {
    return (
      <p role="status" className="text-lg text-schiste">
        {t("finishing")}
      </p>
    );
  }

  const { plan } = state;
  return (
    <ProtocolRunner<AssessmentStepRun>
      steps={plan.steps}
      briefing={(step) => ({
        eyebrow: t("partOf", { part: PART[step.block] }),
        title: t(`parts.${step.block}.title`),
        body: t(`parts.${step.block}.briefing`),
        action: t("continue"),
      })}
      stepLabel={(step) => {
        const part = PART[step.block];
        if (step.block === "bet") return t("stepLabelBet", { part });
        const inBlock = plan.steps.filter((s) => s.block === step.block);
        return t("stepLabel", { part, test: inBlock.indexOf(step) + 1, total: inBlock.length });
      }}
      onFinished={() => void finish(plan.assessmentId)}
      onStopped={() => setState({ kind: "intro", interrupted: true })}
    />
  );
}
