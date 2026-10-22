"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  beginMain,
  frame,
  isVisible,
  pause,
  respond,
  resume,
  startNBack,
  type NBackChoice,
  type NBackConfig,
  type NBackRun,
} from "@/engine/nback";
import type { InputMode } from "@/engine/trial";
import { pointerInput } from "./device";
import { ErrorPanel, ExerciseIntro, ExerciseStage, PausedPanel, PracticeDonePanel, SavingPanel } from "./exercise-ui";
import { useExerciseRun, type ExerciseEngine, type FixedRun } from "./use-exercise-run";

const KEYS: Record<string, NBackChoice> = {
  f: "different",
  F: "different",
  ArrowLeft: "different",
  j: "match",
  J: "match",
  ArrowRight: "match",
};

const NBACK_ENGINE: ExerciseEngine<NBackRun> = {
  exercise: "nback",
  start: (started, at) => startNBack(started.config as NBackConfig, started.seed, at, started.level ?? 1),
  frame,
  pause,
  resume,
  beginMain,
  viewKey: (run, at) =>
    [
      run.phase,
      run.pausedAt !== null,
      run.block.n,
      run.sequenceIndex,
      isVisible(run, at),
      run.current?.answer?.choice ?? "",
      run.trials.length,
    ].join("|"),
};

export function NBackPlayer({ fixed }: { fixed?: FixedRun } = {}) {
  const t = useTranslations("nback");
  const tPlayer = useTranslations("player");
  const router = useRouter();

  const { stage, run, viewAt, start, stop, apply, togglePause, beginMain: begin } = useExerciseRun(NBACK_ENGINE, {
    fixed,
    onKeyDown: (event) => {
      const choice = KEYS[event.key];
      if (!choice) return;
      event.preventDefault();
      apply((current, at) => respond(current, at, { choice, input: "keyboard" }), event.timeStamp);
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
  const answer = (choice: NBackChoice, input: InputMode, at: number) =>
    apply((current, now) => respond(current, now, { choice, input }), at);

  const lastPractice = run.phase === "practice" ? run.trials.at(-1) : undefined;
  const label =
    run.phase === "practice" ? t("practiceLabel", { n: run.block.n }) : t("runLabel", { n: run.block.n });

  let body: React.ReactNode;
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
    const visible = isVisible(run, viewAt);
    body = (
      <div className="flex flex-col items-center gap-6 text-center">
        <p
          aria-live="off"
          className="type-wide flex h-[clamp(6rem,20vw,11rem)] items-center text-[clamp(6rem,20vw,11rem)] leading-none font-extrabold"
        >
          {visible ? run.current!.letter : ""}
        </p>
        <p className="min-h-6 text-trait">
          {run.current === null && run.position === 0
            ? t("newBlock", { n: run.block.n })
            : run.current && !run.current.scored
              ? t("memorise")
              : lastPractice
                ? t(lastPractice.correct ? "feedbackRight" : "feedbackWrong")
                : ""}
        </p>
      </div>
    );
  }

  return (
    <ExerciseStage
      label={label}
      showPause={active && stage === "running"}
      paused={paused}
      onTogglePause={togglePause}
      footer={
        active && !paused && stage === "running" ? (
          <div className="grid grid-cols-2 gap-3 px-5 pb-5">
            {(["different", "match"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                tabIndex={-1}
                onPointerDown={(event) => {
                  // Keep focus on the page so keyboard answers keep working.
                  event.preventDefault();
                  answer(choice, pointerInput(event.pointerType), event.timeStamp);
                }}
                className={`h-20 rounded-md border-2 text-lg font-semibold transition-colors ${
                  run.current?.answer?.choice === choice
                    ? "border-chrono bg-chrono text-ardoise"
                    : "border-trait/40 text-brume"
                }`}
              >
                {t(choice)}
                <span className="mt-1 block text-sm font-normal opacity-70">{t(`${choice}Key`)}</span>
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
