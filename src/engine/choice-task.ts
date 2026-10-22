// Generic choice reaction task (Stroop, flanker, choice reaction time…): a
// stimulus appears, the user picks an answer within a response window, then a
// short interval before the next one. Each task supplies its stimuli, its
// correct answer and what a difficulty level changes. Difficulty follows the
// weighted staircase and applies from the next trial.

import { staircaseFor, updateLevel, type Staircase } from "./difficulty";
import { nextRandom, type RngState } from "./random";
import type { InputMode, Pause, Trial } from "./trial";

/** Speed levers every choice task has, plus task-specific ones (such as the incongruent share). */
export type ChoiceParameters = {
  responseWindowMs: number;
  /** Blank interval between an answer and the next stimulus. */
  itiMs: number;
} & Record<string, number>;

export type ChoiceTaskSpec<S> = {
  parameters(level: number): ChoiceParameters;
  makeStimulus(rng: RngState, parameters: ChoiceParameters): [S, RngState];
  correctChoice(stimulus: S): string;
};

/** Draws whether the next stimulus is incongruent, for conflict tasks. */
export function rollIncongruent(rng: RngState, parameters: ChoiceParameters): [boolean, RngState] {
  const [roll, next] = nextRandom(rng);
  return [roll < (parameters.incongruentRate ?? 0), next];
}

export type ChoiceTaskConfig = {
  durationMs: number;
  practiceTrials: number;
  minLevel: number;
  maxLevel: number;
  target: number;
};

export type ChoicePhase = "practice" | "practice_done" | "main" | "done";

export type ChoiceTaskRun<S> = {
  config: ChoiceTaskConfig;
  spec: ChoiceTaskSpec<S>;
  staircase: Staircase;
  rng: RngState;
  phase: ChoicePhase;
  phaseStartedAt: number;
  phasePausedMs: number;
  pausedAt: number | null;
  pauses: Pause[];
  level: number;
  current: { stimulus: S; onsetMs: number; parameters: ChoiceParameters } | null;
  nextOnsetMs: number;
  trials: Trial[];
};

const FIRST_ONSET_MS = 1_000;
const ANTICIPATION_MS = 100;

/** Linear map of a level onto a parameter range (from = easiest, to = hardest). */
export function interpolate(level: number, minLevel: number, maxLevel: number, from: number, to: number) {
  const ratio = (Math.min(maxLevel, Math.max(minLevel, level)) - minLevel) / (maxLevel - minLevel);
  return from + (to - from) * ratio;
}

export function startChoiceTask<S>(
  config: ChoiceTaskConfig,
  spec: ChoiceTaskSpec<S>,
  seed: number,
  at: number,
  level: number,
): ChoiceTaskRun<S> {
  return {
    config,
    spec,
    staircase: staircaseFor(config.target, { min: config.minLevel, max: config.maxLevel }),
    rng: seed >>> 0,
    phase: config.practiceTrials > 0 ? "practice" : "main",
    phaseStartedAt: at,
    phasePausedMs: 0,
    pausedAt: null,
    pauses: [],
    level: Math.min(config.maxLevel, Math.max(config.minLevel, level)),
    current: null,
    nextOnsetMs: FIRST_ONSET_MS,
    trials: [],
  };
}

export function frame<S>(run: ChoiceTaskRun<S>, at: number): ChoiceTaskRun<S> {
  if (!isRunning(run)) return run;
  const now = activeTime(run, at);

  if (run.current) {
    if (now < run.current.onsetMs + run.current.parameters.responseWindowMs) return run;
    return close(run, run.current.onsetMs + run.current.parameters.responseWindowMs, null);
  }

  if (run.phase === "main" && now >= run.config.durationMs) return { ...run, phase: "done" };
  if (now < run.nextOnsetMs) return run;

  const parameters = run.spec.parameters(run.level);
  const [stimulus, rng] = run.spec.makeStimulus(run.rng, parameters);
  return { ...run, rng, current: { stimulus, onsetMs: now, parameters } };
}

export function respond<S>(
  run: ChoiceTaskRun<S>,
  at: number,
  choice: string,
  input: InputMode,
): ChoiceTaskRun<S> {
  if (!isRunning(run) || !run.current) return run;
  return close(run, activeTime(run, at), { choice, input });
}

export function beginMain<S>(run: ChoiceTaskRun<S>, at: number): ChoiceTaskRun<S> {
  if (run.phase !== "practice_done") return run;
  return { ...run, phase: "main", phaseStartedAt: at, phasePausedMs: 0, current: null, nextOnsetMs: FIRST_ONSET_MS };
}

export function pause<S>(run: ChoiceTaskRun<S>, at: number): ChoiceTaskRun<S> {
  if (run.pausedAt !== null || run.phase === "done") return run;
  return { ...run, pausedAt: at };
}

/** The stimulus on screen when the pause started is dropped. */
export function resume<S>(run: ChoiceTaskRun<S>, at: number): ChoiceTaskRun<S> {
  if (run.pausedAt === null) return run;
  const durationMs = at - run.pausedAt;
  const resumed = {
    ...run,
    pausedAt: null,
    phasePausedMs: run.phasePausedMs + durationMs,
    pauses: [...run.pauses, { atMs: run.pausedAt, durationMs }],
  };
  if (!run.current) return resumed;
  return { ...resumed, current: null, nextOnsetMs: activeTime(resumed, at) + FIRST_ONSET_MS };
}

export function activeTime<S>(run: ChoiceTaskRun<S>, at: number) {
  return at - run.phaseStartedAt - run.phasePausedMs;
}

function isRunning<S>(run: ChoiceTaskRun<S>) {
  return run.pausedAt === null && (run.phase === "practice" || run.phase === "main");
}

function close<S>(
  run: ChoiceTaskRun<S>,
  closedAt: number,
  answer: { choice: string; input: InputMode } | null,
): ChoiceTaskRun<S> {
  const { stimulus, onsetMs, parameters } = run.current!;
  const rtMs = answer ? closedAt - onsetMs : null;
  const outcome =
    answer === null
      ? "miss"
      : rtMs! < ANTICIPATION_MS
        ? "false_start"
        : answer.choice === run.spec.correctChoice(stimulus)
          ? "hit"
          : "error";
  const correct = outcome === "hit";
  const practice = run.phase === "practice";

  const trials: Trial[] = [
    ...run.trials,
    {
      index: run.trials.length,
      practice,
      onsetMs,
      responseMs: answer ? closedAt : null,
      rtMs,
      outcome,
      correct,
      stimulus: { ...(stimulus as Record<string, unknown>) },
      response: answer,
      difficulty: { level: run.level, ...parameters },
    },
  ];

  const practiced = practice ? trials.filter((t) => t.practice).length : 0;
  return {
    ...run,
    trials,
    // Practice never moves the level.
    level: practice ? run.level : updateLevel(run.level, correct, run.staircase),
    current: null,
    nextOnsetMs: closedAt + parameters.itiMs,
    phase: practice && practiced >= run.config.practiceTrials ? "practice_done" : run.phase,
  };
}
