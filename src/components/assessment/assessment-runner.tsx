"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AssessmentBlock } from "@/engine/assessment";
import { detectDevice, detectInputMode } from "@/components/player/device";
import { NBackPlayer } from "@/components/player/nback-player";
import { PvtPlayer } from "@/components/player/pvt-player";
import { StroopPlayer } from "@/components/player/stroop-player";
import { SymbolDigitPlayer } from "@/components/player/symbol-digit-player";
import type { FixedRun } from "@/components/player/use-exercise-run";
import type { AssessmentStepRun, StartedAssessment } from "@/server/assessment";

type State =
  | { kind: "intro"; interrupted: boolean }
  | { kind: "starting" }
  | { kind: "transition"; index: number }
  | { kind: "step"; index: number }
  | { kind: "finishing" }
  | { kind: "error" };

const PART: Record<AssessmentBlock, number> = { cold: 1, bet: 2, fatigued: 3 };
const PRIMARY = "h-12 rounded-md bg-ardoise px-6 font-semibold text-brume hover:bg-ardoise/90 disabled:opacity-70";

/** Plays the nine protocol steps in order, with a short briefing before each part. */
export function AssessmentRunner() {
  const t = useTranslations("assessment");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "intro", interrupted: false });
  const [plan, setPlan] = useState<StartedAssessment | null>(null);

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
      setPlan(await response.json());
      setState({ kind: "transition", index: 0 });
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

  function next(index: number) {
    const steps = plan!.steps;
    if (index + 1 >= steps.length) return void finish(plan!.assessmentId);
    // A briefing opens each new part of the protocol.
    setState(
      steps[index + 1].block !== steps[index].block
        ? { kind: "transition", index: index + 1 }
        : { kind: "step", index: index + 1 },
    );
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
        <button type="button" onClick={start} disabled={state.kind === "starting"} className={`mt-8 ${PRIMARY}`}>
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
        <button type="button" onClick={() => setState({ kind: "intro", interrupted: false })} className={`mt-8 ${PRIMARY}`}>
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

  const step = plan!.steps[state.index];
  if (state.kind === "transition") {
    return (
      <section className="max-w-[60ch]">
        <p className="text-sm font-semibold text-schiste">{t("partOf", { part: PART[step.block] })}</p>
        <h1 className="type-wide mt-2 text-4xl font-extrabold">{t(`parts.${step.block}.title`)}</h1>
        <p className="mt-6 text-lg">{t(`parts.${step.block}.briefing`)}</p>
        <button type="button" onClick={() => setState({ kind: "step", index: state.index })} className={`mt-8 ${PRIMARY}`}>
          {t("continue")}
        </button>
      </section>
    );
  }

  const fixed: FixedRun = {
    step,
    label: stepLabel(t, step, plan!.steps),
    onCompleted: () => next(state.index),
    onStop: () => setState({ kind: "intro", interrupted: true }),
  };
  // Keyed by position so every step gets a fresh player.
  return <StepPlayer key={step.position} exercise={step.exercise} fixed={fixed} />;
}

function stepLabel(t: ReturnType<typeof useTranslations<"assessment">>, step: AssessmentStepRun, steps: AssessmentStepRun[]) {
  const part = PART[step.block];
  if (step.block === "bet") return t("stepLabelBet", { part });
  const inBlock = steps.filter((s) => s.block === step.block);
  return t("stepLabel", { part, test: inBlock.indexOf(step) + 1, total: inBlock.length });
}

function StepPlayer({ exercise, fixed }: { exercise: string; fixed: FixedRun }) {
  switch (exercise) {
    case "pvt_b":
      return <PvtPlayer fixed={fixed} />;
    case "nback":
      return <NBackPlayer fixed={fixed} />;
    case "stroop":
      return <StroopPlayer fixed={fixed} />;
    case "symbol_digit":
      return <SymbolDigitPlayer fixed={fixed} />;
    default:
      throw new Error(`No player for ${exercise}`);
  }
}
