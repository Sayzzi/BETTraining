"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FreePracticeExercise } from "@/engine/exercises";
import type { Pause, Trial } from "@/engine/trial";
import type { StartedRun } from "@/server/training";
import { detectDevice, detectInputMode } from "./device";
import { abandonSessionRequest, completeRunRequest, startFreePracticeRequest } from "./training-api";
import { resendLeftoverTrials, TrialUploader } from "./trial-uploader";

/** What every exercise engine exposes to the player. */
export type RunShape = {
  phase: "practice" | "practice_done" | "main" | "done";
  pausedAt: number | null;
  trials: Trial[];
  pauses: Pause[];
};

export type ExerciseEngine<R extends RunShape> = {
  exercise: FreePracticeExercise;
  start(started: StartedRun, at: number): R;
  frame(run: R, at: number): R;
  pause(run: R, at: number): R;
  resume(run: R, at: number): R;
  beginMain(run: R, at: number): R;
  /** Everything the screen shows; React re-renders only when it changes. */
  viewKey(run: R, at: number): string;
};

export type Stage = "setup" | "starting" | "running" | "saving" | "error";

type Options<R> = {
  /** Paints per-frame details (such as a counter) without re-rendering React. */
  onFrame?: (run: R, at: number) => void;
  /** Exercise-specific response keys. Escape (pause) is handled here. */
  onKeyDown?: (event: KeyboardEvent) => void;
};

/**
 * Runs one free-practice exercise: starts the session, drives the engine every
 * animation frame, uploads trials, pauses when the tab is hidden, marks the
 * session incomplete if the user leaves, and completes it at the end.
 */
export function useExerciseRun<R extends RunShape>(engine: ExerciseEngine<R>, options: Options<R> = {}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("setup");
  // Snapshot of the run taken whenever what the screen shows changes.
  const [view, setView] = useState<{ key: string; run: R | null; at: number }>({ key: "", run: null, at: 0 });

  const runRef = useRef<R | null>(null);
  const idsRef = useRef<{ sessionId: string; runId: string } | null>(null);
  const uploaderRef = useRef<TrialUploader | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    void resendLeftoverTrials();
  }, []);

  const finish = useCallback(
    async (run: R) => {
      setStage("saving");
      const { runId } = idsRef.current!;
      try {
        await uploaderRef.current?.flush();
        await completeRunRequest(runId, run.trials, run.pauses);
        router.push(`/entrainement/resultats/${runId}`);
      } catch {
        setStage("error");
      }
    },
    [router],
  );

  /** Applies a new engine state: queues new trials, finishes at the end, refreshes the view. */
  const commit = useCallback(
    (next: R, at: number) => {
      const previous = runRef.current;
      runRef.current = next;
      if (previous && next !== previous) {
        for (const trial of next.trials.slice(previous.trials.length)) uploaderRef.current?.add(trial);
        if (next.phase === "done" && previous.phase !== "done") void finish(next);
      }
      const key = engine.viewKey(next, at);
      setView((current) => (current.key === key ? current : { key, run: next, at }));
    },
    [engine, finish],
  );

  const apply = useCallback(
    (update: (run: R, at: number) => R, at = performance.now()) => {
      const run = runRef.current;
      if (run) commit(update(run, at), at);
    },
    [commit],
  );

  const togglePause = useCallback(
    () => apply((run, at) => (run.pausedAt === null ? engine.pause(run, at) : engine.resume(run, at))),
    [apply, engine],
  );

  // Frame loop.
  useEffect(() => {
    if (stage !== "running") return;
    let handle = 0;
    const loop = (now: number) => {
      const run = runRef.current;
      if (run) {
        const next = engine.frame(run, now);
        commit(next, now);
        optionsRef.current.onFrame?.(next, now);
      }
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [stage, engine, commit]);

  // Keys and automatic pause when the tab is hidden.
  useEffect(() => {
    if (stage !== "running") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return togglePause();
      if (event.repeat || event.target instanceof HTMLButtonElement) return;
      optionsRef.current.onKeyDown?.(event);
    };
    const onVisibility = () => {
      if (document.hidden) apply(engine.pause);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stage, engine, apply, togglePause]);

  // Leaving mid-run keeps the trials and marks the session incomplete.
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

  async function start(durationMin: number) {
    setStage("starting");
    try {
      const started = await startFreePracticeRequest({
        exercise: engine.exercise,
        durationMin,
        device: detectDevice(),
        inputMode: detectInputMode(),
        userAgent: navigator.userAgent.slice(0, 512),
      });
      idsRef.current = { sessionId: started.sessionId, runId: started.runId };
      uploaderRef.current = new TrialUploader(started.runId);
      const now = performance.now();
      runRef.current = engine.start(started, now);
      setView({ key: engine.viewKey(runRef.current, now), run: runRef.current, at: now });
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

  return {
    stage,
    run: view.run,
    /** Timestamp of the snapshot, for time-dependent rendering such as stimulus visibility. */
    viewAt: view.at,
    start,
    stop,
    apply,
    togglePause,
    beginMain: () => apply(engine.beginMain),
  };
}
