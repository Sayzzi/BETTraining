"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  beginMain,
  frame,
  pause,
  respond,
  resume,
  startChoiceTask,
  type ChoiceTaskConfig,
  type ChoiceTaskRun,
  type ChoiceTaskSpec,
} from "@/engine/choice-task";
import type { FreePracticeExercise } from "@/engine/exercises";
import type { InputMode } from "@/engine/trial";
import { pointerInput } from "./device";
import { ErrorPanel, ExerciseIntro, ExerciseStage, PausedPanel, PracticeDonePanel, SavingPanel } from "./exercise-ui";
import { useExerciseRun, type ExerciseEngine, type FixedRun } from "./use-exercise-run";

export type ChoiceOption = { id: string; label: string; keyHint: string; keys: string[]; swatch?: string };

/**
 * Builds the engine adapter for a choice task; call once at module level so it stays stable.
 * Pass a function when the spec depends on the run's seed (such as a reshuffled key).
 */
export function choiceEngine<S>(
  exercise: FreePracticeExercise,
  spec: ChoiceTaskSpec<S> | ((seed: number) => ChoiceTaskSpec<S>),
): ExerciseEngine<ChoiceTaskRun<S>> {
  return {
    exercise,
    start: (started, at) =>
      startChoiceTask(
        started.config as ChoiceTaskConfig,
        typeof spec === "function" ? spec(started.seed) : spec,
        started.seed,
        at,
        started.level ?? 1,
      ),
    frame,
    pause,
    resume,
    beginMain,
    viewKey: (run) =>
      [run.phase, run.pausedAt !== null, run.trials.length, run.current ? run.current.onsetMs : "-"].join("|"),
  };
}

export function ChoicePlayer<S>({
  engine,
  namespace,
  options,
  optionsClassName = options.length > 2 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2",
  renderStimulus,
  renderIdle,
  renderLegend,
  fixed,
}: {
  engine: ExerciseEngine<ChoiceTaskRun<S>>;
  /** Message namespace with title, domain, instructions, keys and adaptive. */
  namespace: "stroop" | "flanker" | "choiceRt" | "symbolDigit";
  options: ChoiceOption[];
  /** Grid classes for the answer buttons. */
  optionsClassName?: string;
  renderStimulus: (stimulus: S) => ReactNode;
  /** What stays on screen between stimuli (empty by default). */
  renderIdle?: () => ReactNode;
  /** Reference shown above the stimulus for the whole run, such as a symbol key. */
  renderLegend?: (run: ChoiceTaskRun<S>) => ReactNode;
  fixed?: FixedRun;
}) {
  const t = useTranslations(namespace);
  const tChoice = useTranslations("choiceTask");
  const tPlayer = useTranslations("player");
  const router = useRouter();

  const { stage, run, start, stop, apply, togglePause, beginMain: begin } = useExerciseRun(engine, {
    fixed,
    onKeyDown: (event) => {
      const option = options.find((o) => o.keys.includes(event.key));
      if (!option) return;
      event.preventDefault();
      apply((current, at) => respond(current, at, option.id, "keyboard"), event.timeStamp);
    },
  });

  if (stage === "setup" || stage === "starting") {
    return (
      <ExerciseIntro
        title={t("title")}
        domain={t("domain")}
        instructions={
          <>
            <p>{t("instructions")}</p>
            <p>{t("keys")}</p>
            <p className="text-schiste">{t("adaptive")}</p>
          </>
        }
        starting={stage === "starting"}
        onStart={start}
        fixed={fixed && { label: fixed.label, durationMs: fixed.step.config.durationMs }}
      />
    );
  }
  if (stage === "error" || !run) return <ErrorPanel onBack={() => (fixed ? fixed.onStop() : router.push("/entrainement"))} />;

  const paused = run.pausedAt !== null;
  const active = run.phase === "practice" || run.phase === "main";
  const answer = (choice: string, input: InputMode, at: number) =>
    apply((current, now) => respond(current, now, choice, input), at);
  const lastPractice = run.phase === "practice" && !run.current ? run.trials.at(-1) : undefined;

  let body: ReactNode;
  if (stage === "saving") body = <SavingPanel />;
  else if (paused) body = <PausedPanel onResume={togglePause} onStop={stop} />;
  else if (run.phase === "practice_done") {
    body = (
      <PracticeDonePanel
        body={tPlayer("practiceDoneBody", { minutes: Math.round(run.config.durationMs / 60_000) })}
        onBegin={begin}
      />
    );
  } else {
    body = (
      <div className="flex w-full flex-col items-center gap-6 text-center">
        {renderLegend?.(run)}
        <div aria-live="off" className="flex min-h-[clamp(5rem,16vw,9rem)] w-full items-center justify-center">
          {run.current ? renderStimulus(run.current.stimulus) : renderIdle?.()}
        </div>
        <p className="min-h-6 text-trait">
          {lastPractice
            ? tChoice(
                lastPractice.outcome === "hit"
                  ? "feedbackRight"
                  : lastPractice.outcome === "miss"
                    ? "feedbackSlow"
                    : "feedbackWrong",
              )
            : ""}
        </p>
      </div>
    );
  }

  return (
    <ExerciseStage
      label={run.phase === "practice" ? tPlayer("practiceBadge") : t("title")}
      showPause={active && stage === "running"}
      paused={paused}
      onTogglePause={togglePause}
      footer={
        active && !paused && stage === "running" ? (
          <div className={`grid gap-3 px-5 pb-5 ${optionsClassName}`}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                onPointerDown={(event) => {
                  // Keep focus on the page so keyboard answers keep working.
                  event.preventDefault();
                  answer(option.id, pointerInput(event.pointerType), event.timeStamp);
                }}
                className="flex h-16 flex-col items-center justify-center rounded-md border-2 border-trait/40 text-lg font-semibold text-brume active:border-chrono md:h-20"
              >
                <span className="flex items-center gap-2">
                  {option.swatch ? (
                    <span aria-hidden="true" className="size-4 rounded-sm" style={{ backgroundColor: option.swatch }} />
                  ) : null}
                  {option.label}
                </span>
                {option.keyHint ? (
                  <span className="mt-1 text-sm font-normal opacity-70">{option.keyHint}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {body}
    </ExerciseStage>
  );
}
