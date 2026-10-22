// N-back: letters appear one by one; for each letter the user says whether it
// matches the one N positions back. Difficulty (N and pace) follows a weighted
// staircase, updated every trial but applied at block boundaries so N never
// changes in the middle of a sequence. Pure state machine driven by timestamps.

import { staircaseFor, updateLevel, type Staircase } from "./difficulty";
import { nextInt, nextRandom, type RngState } from "./random";
import type { InputMode, Pause, Trial } from "./trial";

export type NBackConfig = {
  durationMs: number;
  stimulusMs: number;
  blockScoredTrials: number;
  targetRate: number;
  practiceScoredTrials: number;
  minLevel: number;
  maxLevel: number;
  /** Success rate the difficulty converges to. */
  target: number;
  /** False freezes the level (assessments must stay comparable). Defaults to true. */
  adaptive?: boolean;
};

export const NBACK_LEVELS = { min: 1, max: 15, initial: 2 } as const;

export function nBackConfig(durationMs: number, target = 0.8): NBackConfig {
  return {
    durationMs,
    stimulusMs: 500,
    blockScoredTrials: 20,
    targetRate: 1 / 3,
    practiceScoredTrials: 6,
    minLevel: NBACK_LEVELS.min,
    maxLevel: NBACK_LEVELS.max,
    target,
  };
}

const PACES_MS = [3000, 2500, 2000] as const;

/** Three paces per N: level 1-3 is 1-back, 4-6 is 2-back, and so on up to 5-back. */
export function nBackParameters(level: number): { n: number; soaMs: number } {
  const step = Math.max(1, Math.floor(level));
  return { n: 1 + Math.floor((step - 1) / 3), soaMs: PACES_MS[(step - 1) % 3] };
}

export type NBackChoice = "match" | "different";
export type NBackPhase = "practice" | "practice_done" | "main" | "done";

type Block = { n: number; soaMs: number; letters: string[]; targets: boolean[] };

type Current = {
  position: number;
  letter: string;
  isTarget: boolean;
  scored: boolean;
  onsetMs: number;
  answer: { choice: NBackChoice; input: InputMode; rtMs: number } | null;
};

export type NBackRun = {
  config: NBackConfig;
  staircase: Staircase;
  rng: RngState;
  phase: NBackPhase;
  phaseStartedAt: number;
  phasePausedMs: number;
  pausedAt: number | null;
  pauses: Pause[];
  level: number;
  blockNumber: number;
  block: Block;
  /** Number of letters shown so far, across blocks. */
  sequenceIndex: number;
  /** Position in the block of the next letter to show. */
  position: number;
  current: Current | null;
  nextOnsetMs: number;
  trials: Trial[];
};

const LETTERS = "BCDFGHJKLMNPQRSTVWXZ";
const FIRST_ONSET_MS = 1_000;

export function startNBack(config: NBackConfig, seed: number, at: number, level: number): NBackRun {
  const staircase = staircaseFor(config.target, { min: config.minLevel, max: config.maxLevel });
  const clamped = Math.min(config.maxLevel, Math.max(config.minLevel, level));
  const [block, rng] = makeBlock(seed >>> 0, clamped, config);
  return {
    config,
    staircase,
    rng,
    phase: config.practiceScoredTrials > 0 ? "practice" : "main",
    phaseStartedAt: at,
    phasePausedMs: 0,
    pausedAt: null,
    pauses: [],
    level: clamped,
    blockNumber: 0,
    block,
    sequenceIndex: 0,
    position: 0,
    current: null,
    nextOnsetMs: FIRST_ONSET_MS,
    trials: [],
  };
}

export function frame(run: NBackRun, at: number): NBackRun {
  if (!isRunning(run)) return run;
  const now = activeTime(run, at);
  let next = run;

  if (next.current && now >= next.current.onsetMs + next.block.soaMs) {
    next = closeCurrent(next);
    if (next.phase === "main" && now >= next.config.durationMs) return { ...next, phase: "done" };
    if (next.phase !== "practice" && next.phase !== "main") return next;
  }

  if (!next.current && now >= next.nextOnsetMs) {
    const position = next.position;
    const scored = position >= next.block.n;
    next = {
      ...next,
      sequenceIndex: next.sequenceIndex + 1,
      current: {
        position,
        letter: next.block.letters[position],
        isTarget: next.block.targets[position],
        scored,
        onsetMs: now,
        answer: null,
      },
    };
  }
  return next;
}

/** The first answer to a scored letter counts; anything else is ignored. */
export function respond(
  run: NBackRun,
  at: number,
  response: { choice: NBackChoice; input: InputMode },
): NBackRun {
  if (!isRunning(run) || !run.current?.scored || run.current.answer) return run;
  const rtMs = activeTime(run, at) - run.current.onsetMs;
  return { ...run, current: { ...run.current, answer: { ...response, rtMs } } };
}

export function isVisible(run: NBackRun, at: number) {
  return run.current !== null && activeTime(run, at) - run.current.onsetMs < run.config.stimulusMs;
}

export function beginMain(run: NBackRun, at: number): NBackRun {
  if (run.phase !== "practice_done") return run;
  return restartBlock({ ...run, phase: "main", phaseStartedAt: at, phasePausedMs: 0 }, FIRST_ONSET_MS);
}

export function pause(run: NBackRun, at: number): NBackRun {
  if (run.pausedAt !== null || run.phase === "done") return run;
  return { ...run, pausedAt: at };
}

/** The interrupted letter is dropped and a fresh block starts, so comparisons stay meaningful. */
export function resume(run: NBackRun, at: number): NBackRun {
  if (run.pausedAt === null) return run;
  const durationMs = at - run.pausedAt;
  const resumed: NBackRun = {
    ...run,
    pausedAt: null,
    phasePausedMs: run.phasePausedMs + durationMs,
    pauses: [...run.pauses, { atMs: run.pausedAt, durationMs }],
  };
  if (resumed.position === 0 && resumed.current === null) return resumed;
  return restartBlock(resumed, activeTime(resumed, at) + FIRST_ONSET_MS);
}

export function activeTime(run: NBackRun, at: number) {
  return at - run.phaseStartedAt - run.phasePausedMs;
}

function isRunning(run: NBackRun) {
  return run.pausedAt === null && (run.phase === "practice" || run.phase === "main");
}

function closeCurrent(run: NBackRun): NBackRun {
  const current = run.current!;
  let { trials, level, phase } = run;

  if (current.scored) {
    const answer = current.answer;
    const correct = answer !== null && (answer.choice === "match") === current.isTarget;
    trials = [
      ...trials,
      {
        index: trials.length,
        practice: phase === "practice",
        onsetMs: current.onsetMs,
        responseMs: answer ? current.onsetMs + answer.rtMs : null,
        rtMs: answer?.rtMs ?? null,
        outcome: answer === null ? "miss" : correct ? "hit" : "error",
        correct,
        stimulus: { letter: current.letter, isTarget: current.isTarget, n: run.block.n, position: current.position },
        response: answer ? { input: answer.input, choice: answer.choice } : null,
        difficulty: { level: run.level, n: run.block.n, soaMs: run.block.soaMs },
      },
    ];
    // Practice never moves the level.
    if (phase === "main" && run.config.adaptive !== false) level = updateLevel(level, correct, run.staircase);
  }

  const closed: NBackRun = {
    ...run,
    trials,
    level,
    current: null,
    position: run.position + 1,
    nextOnsetMs: current.onsetMs + run.block.soaMs,
  };

  if (phase === "practice") {
    const practiced = trials.filter((t) => t.practice).length;
    if (practiced >= run.config.practiceScoredTrials) phase = "practice_done";
  }
  if (closed.position >= run.block.letters.length) {
    const [block, rng] = makeBlock(closed.rng, closed.level, closed.config);
    return { ...closed, phase, block, rng, blockNumber: closed.blockNumber + 1, position: 0 };
  }
  return { ...closed, phase };
}

function restartBlock(run: NBackRun, nextOnsetMs: number): NBackRun {
  const [block, rng] = makeBlock(run.rng, run.level, run.config);
  return { ...run, block, rng, position: 0, current: null, nextOnsetMs };
}

function makeBlock(state: RngState, level: number, config: NBackConfig): [Block, RngState] {
  const { n, soaMs } = nBackParameters(level);
  const letters: string[] = [];
  const targets: boolean[] = [];
  let rng = state;
  const draw = () => {
    const [index, next] = nextInt(rng, 0, LETTERS.length - 1);
    rng = next;
    return LETTERS[index];
  };

  for (let i = 0; i < n + config.blockScoredTrials; i++) {
    if (i < n) {
      letters.push(draw());
      targets.push(false);
      continue;
    }
    const [roll, next] = nextRandom(rng);
    rng = next;
    const isTarget = roll < config.targetRate;
    let letter = letters[i - n];
    if (!isTarget) {
      do letter = draw();
      while (letter === letters[i - n]);
    }
    letters.push(letter);
    targets.push(isTarget);
  }
  return [{ n, soaMs, letters, targets }, rng];
}
