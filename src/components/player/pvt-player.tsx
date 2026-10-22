"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { FREE_PRACTICE_DURATIONS_MIN } from "@/engine/exercises";
import {
  activeTime,
  beginMain,
  frame,
  pause,
  respond,
  resume,
  startPvt,
  type PvtPhase,
  type PvtRun,
} from "@/engine/pvt";
import type { InputMode } from "@/engine/trial";
import { detectDevice, detectInputMode, pointerInput } from "./device";
import { abandonSessionRequest, completeRunRequest, startFreePracticeRequest } from "./training-api";
import { resendLeftoverTrials, TrialUploader } from "./trial-uploader";

type Stage = "setup" | "starting" | "running" | "saving" | "error";

type View = { phase: PvtPhase; paused: boolean; stimulus: boolean };

const RESPONSE_KEYS = new Set([" ", "Enter"]);

export function PvtPlayer() {
  const t = useTranslations("pvt");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("setup");
  const [durationMin, setDurationMin] = useState<number>(FREE_PRACTICE_DURATIONS_MIN[0]);
  const [view, setView] = useState<View>({ phase: "practice", paused: false, stimulus: false });

  // The run changes every frame, so it lives in refs rather than state.
  const runRef = useRef<PvtRun | null>(null);
  const idsRef = useRef<{ sessionId: string; runId: string } | null>(null);
  const uploaderRef = useRef<TrialUploader | null>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    void resendLeftoverTrials();
  }, []);

  /** The run reached its end: upload everything, let the server compute results, show them. */
  const finish = useCallback(
    async (run: PvtRun) => {
      setStage("saving");
      try {
        await uploaderRef.current?.flush();
        await completeRunRequest(idsRef.current!.runId, run.trials, run.pauses);
        router.push(`/entrainement/resultats/${idsRef.current!.runId}`);
      } catch {
        setStage("error");
      }
    },
    [router],
  );

  /** Applies a new engine state: queues new trials and refreshes the view on visible changes. */
  const commit = useCallback((next: PvtRun) => {
    const previous = runRef.current;
    runRef.current = next;
    if (!previous || next === previous) return;
    for (const trial of next.trials.slice(previous.trials.length)) uploaderRef.current?.add(trial);
    if (next.phase === "done" && previous.phase !== "done") void finish(next);
    const stimulus = next.stimulusOnsetMs !== null;
    if (
      next.phase !== previous.phase ||
      (next.pausedAt !== null) !== (previous.pausedAt !== null) ||
      stimulus !== (previous.stimulusOnsetMs !== null)
    ) {
      setView({ phase: next.phase, paused: next.pausedAt !== null, stimulus });
    }
  }, [finish]);

  const respondNow = useCallback(
    (at: number, input: InputMode) => {
      const run = runRef.current;
      if (run) commit(respond(run, at, { input }));
    },
    [commit],
  );

  const togglePause = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const now = performance.now();
    commit(run.pausedAt === null ? pause(run, now) : resume(run, now));
  }, [commit]);

  // Frame loop: advances the engine and paints the counter without re-rendering React.
  useEffect(() => {
    if (stage !== "running") return;
    let handle = 0;
    const loop = (now: number) => {
      const run = runRef.current;
      if (run) {
        const next = frame(run, now);
        commit(next);
        if (next.stimulusOnsetMs !== null && counterRef.current) {
          const elapsed = Math.max(0, Math.floor(activeTime(next, now) - next.stimulusOnsetMs));
          counterRef.current.textContent = String(elapsed).padStart(3, "0");
        }
      }
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [stage, commit]);

  // Keyboard responses, Escape to pause, and automatic pause when the tab is hidden.
  useEffect(() => {
    if (stage !== "running") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return togglePause();
      if (!RESPONSE_KEYS.has(event.key) || event.repeat) return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      respondNow(event.timeStamp, "keyboard");
    };
    const onVisibility = () => {
      const run = runRef.current;
      if (document.hidden && run) commit(pause(run, performance.now()));
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stage, commit, respondNow, togglePause]);

  // Leaving mid-run (tab closed or navigation away) keeps the trials and marks the session incomplete.
  useEffect(() => {
    if (stage !== "running") return;
    const leave = () => {
      uploaderRef.current?.flushOnExit();
      if (idsRef.current) abandonSessionRequest(idsRef.current.sessionId, true);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      if (runRef.current?.phase !== "done") leave();
    };
  }, [stage]);

  async function start() {
    setStage("starting");
    try {
      const started = await startFreePracticeRequest({
        exercise: "pvt",
        durationMin,
        device: detectDevice(),
        inputMode: detectInputMode(),
        userAgent: navigator.userAgent.slice(0, 512),
      });
      idsRef.current = { sessionId: started.sessionId, runId: started.runId };
      uploaderRef.current = new TrialUploader(started.runId);
      runRef.current = startPvt(started.config, started.seed, performance.now());
      setView({ phase: runRef.current.phase, paused: false, stimulus: false });
      setStage("running");
    } catch {
      setStage("error");
    }
  }

  function stop() {
    if (idsRef.current) abandonSessionRequest(idsRef.current.sessionId);
    uploaderRef.current?.flushOnExit();
    runRef.current = null;
    router.push("/entrainement");
  }

  if (stage === "setup" || stage === "starting") {
    return (
      <section className="max-w-[60ch]">
        <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 text-lg text-schiste">{t("domain")}</p>
        <p className="mt-8 text-lg">{t("instructions")}</p>
        <fieldset className="mt-8">
          <legend className="text-sm font-semibold">{t("durationLabel")}</legend>
          <div className="mt-3 flex gap-2">
            {FREE_PRACTICE_DURATIONS_MIN.map((minutes) => (
              <label
                key={minutes}
                className="cursor-pointer rounded-md border border-trait px-4 py-2.5 font-semibold has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono"
              >
                <input
                  type="radio"
                  name="duration"
                  value={minutes}
                  checked={durationMin === minutes}
                  onChange={() => setDurationMin(minutes)}
                  className="sr-only"
                />
                {t("minutes", { minutes })}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-6 text-sm text-schiste">{t("practiceNote")}</p>
        <button
          type="button"
          onClick={start}
          disabled={stage === "starting"}
          className="mt-8 h-12 rounded-md bg-ardoise px-6 font-semibold text-brume hover:bg-ardoise/90 disabled:cursor-wait disabled:opacity-70"
        >
          {stage === "starting" ? t("starting") : t("start")}
        </button>
      </section>
    );
  }

  if (stage === "error") {
    return (
      <section role="alert" className="max-w-[60ch]">
        <h1 className="type-wide text-3xl font-extrabold">{t("errorTitle")}</h1>
        <p className="mt-4 text-lg text-schiste">{t("errorBody")}</p>
        <button
          type="button"
          onClick={() => router.push("/entrainement")}
          className="mt-8 h-12 rounded-md bg-ardoise px-6 font-semibold text-brume"
        >
          {t("backToList")}
        </button>
      </section>
    );
  }

  const run = runRef.current;
  return (
    <section
      aria-label={t("title")}
      onPointerDown={(event) => {
        if (event.target instanceof HTMLButtonElement) return;
        respondNow(event.timeStamp, pointerInput(event.pointerType));
      }}
      className="relative flex min-h-[70dvh] touch-none flex-col rounded-lg bg-ardoise text-brume select-none"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm text-trait">{view.phase === "practice" ? t("practiceBadge") : t("title")}</p>
        {view.phase === "practice" || view.phase === "main" ? (
          <button type="button" onClick={togglePause} className="text-sm font-semibold underline underline-offset-4">
            {view.paused ? t("resume") : t("pause")}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-10">
        {stage === "saving" ? (
          <p className="text-lg text-trait" role="status">
            {t("saving")}
          </p>
        ) : view.paused ? (
          <div className="text-center">
            <p className="type-wide text-3xl font-extrabold">{t("pausedTitle")}</p>
            <p className="mt-3 text-trait">{t("pausedBody")}</p>
            <div className="mt-8 flex justify-center gap-6">
              <button type="button" onClick={togglePause} className="h-12 rounded-md bg-chrono px-6 font-semibold text-ardoise">
                {t("resume")}
              </button>
              <button type="button" onClick={stop} className="font-semibold underline underline-offset-4">
                {t("stop")}
              </button>
            </div>
          </div>
        ) : view.phase === "practice_done" ? (
          <div className="max-w-[40ch] text-center">
            <p className="type-wide text-3xl font-extrabold">{t("practiceDoneTitle")}</p>
            <p className="mt-3 text-trait">{t("practiceDoneBody", { minutes: durationMin })}</p>
            <button
              type="button"
              onClick={() => run && commit(beginMain(run, performance.now()))}
              className="mt-8 h-12 rounded-md bg-chrono px-6 font-semibold text-ardoise"
            >
              {t("beginMain")}
            </button>
          </div>
        ) : view.stimulus ? (
          <p aria-live="off" className="type-wide flex items-baseline gap-3 leading-none font-extrabold text-chrono">
            <span ref={counterRef} className="text-[clamp(5rem,18vw,12rem)] tabular-nums">
              000
            </span>
            <span className="text-3xl">ms</span>
          </p>
        ) : (
          <p className="text-trait">{t("waitHint")}</p>
        )}
      </div>
    </section>
  );
}
