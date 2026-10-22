"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { activeTime, beginMain, frame, pause, respond, resume, startPvt, type PvtConfig, type PvtRun } from "@/engine/pvt";
import { pointerInput } from "./device";
import { ErrorPanel, ExerciseIntro, ExerciseStage, PausedPanel, PracticeDonePanel, SavingPanel } from "./exercise-ui";
import { useExerciseRun, type ExerciseEngine } from "./use-exercise-run";

const RESPONSE_KEYS = new Set([" ", "Enter"]);

const PVT_ENGINE: ExerciseEngine<PvtRun> = {
  exercise: "pvt",
  start: (started, at) => startPvt(started.config as PvtConfig, started.seed, at),
  frame,
  pause,
  resume,
  beginMain,
  viewKey: (run) => `${run.phase}|${run.pausedAt !== null}|${run.stimulusOnsetMs !== null}`,
};

export function PvtPlayer() {
  const t = useTranslations("pvt");
  const tPlayer = useTranslations("player");
  const router = useRouter();
  const counterRef = useRef<HTMLSpanElement>(null);

  const { stage, run, start, stop, apply, togglePause, beginMain: begin } = useExerciseRun(PVT_ENGINE, {
    // The counter changes every frame, so it is painted directly.
    onFrame: (current, now) => {
      if (current.stimulusOnsetMs === null || !counterRef.current) return;
      const elapsed = Math.max(0, Math.floor(activeTime(current, now) - current.stimulusOnsetMs));
      counterRef.current.textContent = String(elapsed).padStart(3, "0");
    },
    onKeyDown: (event) => {
      if (!RESPONSE_KEYS.has(event.key)) return;
      event.preventDefault();
      apply((current, at) => respond(current, at, { input: "keyboard" }), event.timeStamp);
    },
  });

  if (stage === "setup" || stage === "starting") {
    return (
      <ExerciseIntro
        title={t("title")}
        domain={t("domain")}
        instructions={<p>{t("instructions")}</p>}
        starting={stage === "starting"}
        onStart={start}
      />
    );
  }
  if (stage === "error" || !run) return <ErrorPanel onBack={() => router.push("/entrainement")} />;

  const paused = run.pausedAt !== null;
  const active = run.phase === "practice" || run.phase === "main";
  return (
    <ExerciseStage
      label={run.phase === "practice" ? tPlayer("practiceBadge") : t("title")}
      showPause={active && stage === "running"}
      paused={paused}
      onTogglePause={togglePause}
      onPointerDown={(event) => {
        if (event.target instanceof HTMLButtonElement) return;
        apply((current, at) => respond(current, at, { input: pointerInput(event.pointerType) }), event.timeStamp);
      }}
    >
      {stage === "saving" ? (
        <SavingPanel />
      ) : paused ? (
        <PausedPanel onResume={togglePause} onStop={stop} />
      ) : run.phase === "practice_done" ? (
        <PracticeDonePanel
          body={tPlayer("practiceDoneBody", { minutes: Math.round(run.config.durationMs / 60_000) })}
          onBegin={begin}
        />
      ) : run.stimulusOnsetMs !== null ? (
        <p aria-live="off" className="type-wide flex items-baseline gap-3 leading-none font-extrabold text-chrono">
          <span ref={counterRef} className="text-[clamp(5rem,18vw,12rem)] tabular-nums">
            000
          </span>
          <span className="text-3xl">ms</span>
        </p>
      ) : (
        <p className="text-trait">{t("waitHint")}</p>
      )}
    </ExerciseStage>
  );
}
