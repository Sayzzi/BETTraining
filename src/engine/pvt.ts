// Psychomotor Vigilance Task: wait a random interval, show a counting stimulus,
// measure the reaction time. Pure state machine driven by injected timestamps
// (performance.now() in the browser, a fake clock in tests).

import { nextInt, type RngState } from "./random";
import type { Pause, Trial, TrialResponse } from "./trial";

export type PvtConfig = {
  durationMs: number;
  isiMinMs: number;
  isiMaxMs: number;
  lapseThresholdMs: number;
  /** Responses faster than this after onset are anticipations, not reactions. */
  anticipationThresholdMs: number;
  timeoutMs: number;
  practiceTrials: number;
};

/** Standard PVT (Dinges & Powell 1985) at a chosen duration. */
export function pvtStandard(durationMs: number): PvtConfig {
  return {
    durationMs,
    isiMinMs: 2_000,
    isiMaxMs: 10_000,
    lapseThresholdMs: 500,
    anticipationThresholdMs: 100,
    timeoutMs: 30_000,
    practiceTrials: 3,
  };
}

/** PVT-B (Basner et al. 2011): the 3-minute fatigue check. */
export const PVT_B: PvtConfig = {
  durationMs: 180_000,
  isiMinMs: 1_000,
  isiMaxMs: 4_000,
  lapseThresholdMs: 355,
  anticipationThresholdMs: 100,
  timeoutMs: 30_000,
  practiceTrials: 0,
};

export type PvtPhase = "practice" | "practice_done" | "main" | "done";

export type PvtRun = {
  config: PvtConfig;
  rng: RngState;
  phase: PvtPhase;
  /** Raw timestamp when the current phase started. */
  phaseStartedAt: number;
  /** Paused time accumulated since the current phase started. */
  phasePausedMs: number;
  pausedAt: number | null;
  pauses: Pause[];
  currentIsiMs: number;
  /** Active time (since phase start) when the next stimulus should appear. */
  nextStimulusDueMs: number;
  stimulusOnsetMs: number | null;
  trials: Trial[];
};

export function startPvt(config: PvtConfig, seed: number, at: number): PvtRun {
  return scheduleNext(
    {
      config,
      rng: seed >>> 0,
      phase: config.practiceTrials > 0 ? "practice" : "main",
      phaseStartedAt: at,
      phasePausedMs: 0,
      pausedAt: null,
      pauses: [],
      currentIsiMs: 0,
      nextStimulusDueMs: 0,
      stimulusOnsetMs: null,
      trials: [],
    },
    0,
  );
}

/** Called on every animation frame. Shows the stimulus, times out, or ends the run. */
export function frame(run: PvtRun, at: number): PvtRun {
  if (!isRunning(run)) return run;
  const now = activeTime(run, at);

  if (run.stimulusOnsetMs !== null) {
    if (now - run.stimulusOnsetMs < run.config.timeoutMs) return run;
    return afterStimulus(run, now, {
      responseMs: null,
      rtMs: null,
      outcome: "miss",
      correct: false,
      response: null,
    });
  }

  if (run.phase === "main" && now >= run.config.durationMs) return { ...run, phase: "done" };
  if (now < run.nextStimulusDueMs) return run;
  return { ...run, stimulusOnsetMs: now };
}

export function respond(run: PvtRun, at: number, response: TrialResponse): PvtRun {
  if (!isRunning(run)) return run;
  const now = activeTime(run, at);

  if (run.stimulusOnsetMs === null) {
    return {
      ...run,
      trials: [
        ...run.trials,
        {
          index: run.trials.length,
          practice: run.phase === "practice",
          onsetMs: null,
          responseMs: now,
          rtMs: null,
          outcome: "false_start",
          correct: false,
          stimulus: null,
          response,
        },
      ],
    };
  }

  const rtMs = now - run.stimulusOnsetMs;
  const { anticipationThresholdMs, lapseThresholdMs } = run.config;
  const outcome = rtMs < anticipationThresholdMs ? "false_start" : rtMs >= lapseThresholdMs ? "lapse" : "hit";
  return afterStimulus(run, now, {
    responseMs: now,
    rtMs,
    outcome,
    correct: outcome !== "false_start",
    response,
  });
}

/** Starts the counted run once the user is ready after practice. */
export function beginMain(run: PvtRun, at: number): PvtRun {
  if (run.phase !== "practice_done") return run;
  return scheduleNext({ ...run, phase: "main", phaseStartedAt: at, phasePausedMs: 0 }, 0);
}

export function pause(run: PvtRun, at: number): PvtRun {
  if (run.pausedAt !== null || run.phase === "done") return run;
  return { ...run, pausedAt: at };
}

/** A stimulus interrupted by a pause is dropped and a fresh interval starts. */
export function resume(run: PvtRun, at: number): PvtRun {
  if (run.pausedAt === null) return run;
  const durationMs = at - run.pausedAt;
  const resumed: PvtRun = {
    ...run,
    pausedAt: null,
    phasePausedMs: run.phasePausedMs + durationMs,
    pauses: [...run.pauses, { atMs: run.pausedAt, durationMs }],
  };
  if (run.stimulusOnsetMs === null) return resumed;
  return scheduleNext({ ...resumed, stimulusOnsetMs: null }, activeTime(resumed, at));
}

function isRunning(run: PvtRun) {
  return run.pausedAt === null && (run.phase === "practice" || run.phase === "main");
}

/** Milliseconds elapsed in the current phase, pauses excluded. */
export function activeTime(run: PvtRun, at: number) {
  return at - run.phaseStartedAt - run.phasePausedMs;
}

function scheduleNext(run: PvtRun, fromMs: number): PvtRun {
  const [isi, rng] = nextInt(run.rng, run.config.isiMinMs, run.config.isiMaxMs);
  return { ...run, rng, currentIsiMs: isi, nextStimulusDueMs: fromMs + isi, stimulusOnsetMs: null };
}

function afterStimulus(
  run: PvtRun,
  now: number,
  result: Pick<Trial, "responseMs" | "rtMs" | "outcome" | "correct" | "response">,
): PvtRun {
  const trial: Trial = {
    index: run.trials.length,
    practice: run.phase === "practice",
    onsetMs: run.stimulusOnsetMs,
    stimulus: { isiMs: run.currentIsiMs },
    ...result,
  };
  const trials = [...run.trials, trial];

  if (run.phase === "practice") {
    const practiced = trials.filter((t) => t.practice && t.onsetMs !== null).length;
    if (practiced >= run.config.practiceTrials) {
      return { ...run, trials, phase: "practice_done", stimulusOnsetMs: null };
    }
  }
  return scheduleNext({ ...run, trials }, now);
}
