"use client";

import { useState } from "react";
import { ChoiceRtPlayer } from "@/components/player/choice-rt-player";
import { FlankerPlayer } from "@/components/player/flanker-player";
import { NBackPlayer } from "@/components/player/nback-player";
import { PvtPlayer } from "@/components/player/pvt-player";
import { StroopPlayer } from "@/components/player/stroop-player";
import { SymbolDigitPlayer } from "@/components/player/symbol-digit-player";
import type { FixedRun } from "@/components/player/use-exercise-run";
import type { StartedRun } from "@/server/training";

export type ProtocolStep = StartedRun & { position: number; block: string };

export const PRIMARY_BUTTON =
  "h-12 rounded-md bg-ardoise px-6 font-semibold text-brume hover:bg-ardoise/90 disabled:opacity-70";

/**
 * Plays pre-created steps in order (an assessment or a BET session), with a
 * briefing whenever a new block starts. Each step's run uploads and completes
 * through the usual player; stopping hands control back to the caller.
 */
export function ProtocolRunner<S extends ProtocolStep>({
  steps,
  briefing,
  stepLabel,
  onFinished,
  onStopped,
}: {
  steps: S[];
  briefing: (step: S) => { eyebrow: string; title: string; body: string; action: string };
  stepLabel: (step: S) => string;
  onFinished: () => void;
  onStopped: () => void;
}) {
  const [state, setState] = useState<{ index: number; briefed: boolean }>({ index: 0, briefed: false });
  const step = steps[state.index];

  if (!state.briefed) {
    const content = briefing(step);
    return (
      <section className="max-w-[60ch]">
        <p className="text-sm font-semibold text-schiste">{content.eyebrow}</p>
        <h1 className="type-wide mt-2 text-4xl font-extrabold">{content.title}</h1>
        <p className="mt-6 text-lg">{content.body}</p>
        <button type="button" onClick={() => setState({ ...state, briefed: true })} className={`mt-8 ${PRIMARY_BUTTON}`}>
          {content.action}
        </button>
      </section>
    );
  }

  const fixed: FixedRun = {
    step,
    label: stepLabel(step),
    onCompleted: () => {
      const next = state.index + 1;
      if (next >= steps.length) return onFinished();
      // A briefing opens each new block.
      setState({ index: next, briefed: steps[next].block === step.block });
    },
    onStop: onStopped,
  };
  // Keyed by position so every step gets a fresh player.
  return <StepPlayer key={step.position} exercise={step.exercise} fixed={fixed} />;
}

function StepPlayer({ exercise, fixed }: { exercise: string; fixed: FixedRun }) {
  switch (exercise) {
    case "pvt":
    case "pvt_b":
      return <PvtPlayer fixed={fixed} />;
    case "nback":
      return <NBackPlayer fixed={fixed} />;
    case "stroop":
      return <StroopPlayer fixed={fixed} />;
    case "flanker":
      return <FlankerPlayer fixed={fixed} />;
    case "choice_rt":
      return <ChoiceRtPlayer fixed={fixed} />;
    case "symbol_digit":
      return <SymbolDigitPlayer fixed={fixed} />;
    default:
      throw new Error(`No player for ${exercise}`);
  }
}
