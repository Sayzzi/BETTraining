// Training load: a step that rises every two weeks when BET sessions go well,
// one variable at a time; drops when fatigue builds up or after a break; and a
// light fourth week in each four-week cycle, when an assessment is proposed.
// Evaluated once a day from the user's BET sessions; all thresholds configurable.

import { addDays } from "./weekly-plan";

export type LoadParameters = {
  /** Share of the session given to the BET block. */
  betShare: number;
  /** Levels added to the saved BET level when a BET exercise starts. */
  betLevelOffset: number;
  /** Longest single BET exercise; a longer block is split into two exercises. */
  betExerciseMaxMin: number;
};

export type LoadVariable = keyof LoadParameters;

const LADDERS: Record<LoadVariable, number[]> = {
  betShare: [0.6, 0.65, 0.7],
  betLevelOffset: [0, 1, 2, 3, 4],
  betExerciseMaxMin: [20, 25, 30, 40],
};
const ROTATION: LoadVariable[] = ["betShare", "betLevelOffset", "betExerciseMaxMin"];

export const MAX_LOAD_STEP = ROTATION.reduce((sum, variable) => sum + LADDERS[variable].length - 1, 0);

/** Rung reached on each variable after `step` steps, skipping variables already at the top. */
function rungs(step: number): { rungs: Record<LoadVariable, number>; changed: LoadVariable | null } {
  const reached: Record<LoadVariable, number> = { betShare: 0, betLevelOffset: 0, betExerciseMaxMin: 0 };
  let changed: LoadVariable | null = null;
  let turn = 0;
  for (let s = 0; s < Math.min(step, MAX_LOAD_STEP); s++) {
    let variable = ROTATION[turn % ROTATION.length];
    while (reached[variable] >= LADDERS[variable].length - 1) variable = ROTATION[++turn % ROTATION.length];
    reached[variable]++;
    changed = variable;
    turn++;
  }
  return { rungs: reached, changed };
}

export function loadParameters(step: number): LoadParameters {
  const { rungs: reached } = rungs(Math.max(0, step));
  return {
    betShare: LADDERS.betShare[reached.betShare],
    betLevelOffset: LADDERS.betLevelOffset[reached.betLevelOffset],
    betExerciseMaxMin: LADDERS.betExerciseMaxMin[reached.betExerciseMaxMin],
  };
}

/** The variable the given step (1 and above) changes. */
export function variableChangedAt(step: number): LoadVariable | null {
  return rungs(step).changed;
}

export const LOAD_RULES = {
  stepIntervalDays: 14,
  minSessionsToStep: 2,
  cycleDays: 28,
  /** First day of the light week within the cycle (the fourth week). */
  deloadStartDay: 21,
  deloadSteps: 2,
  inactivityDays: 7,
  inactivityDropSteps: 2,
  /** Sessions looked at for fatigue signs. */
  fatigueSessions: 3,
  highFatigueLapseDelta: 4,
  highFatigueRtDeltaMs: 60,
  degradingRtRiseMs: 20,
  lighterAdviceLapses: 3,
  postponeDays: 2,
  maxPostponeDays: 6,
};

export type LoadRules = typeof LOAD_RULES;

export type LoadChange = {
  kind: "up" | "fatigue" | "inactivity";
  /** Variable a step up changed; null for drops. */
  variable: LoadVariable | null;
  date: string;
};

export type LoadState = {
  step: number;
  lastStepAt: string;
  cycleStartedAt: string;
  assessmentPostponedUntil: string | null;
  lastChange: LoadChange | null;
};

/** A completed BET session with its two fatigue checks (PVT-B). */
export type BetSessionRecord = {
  date: string;
  openLapses: number;
  closeLapses: number;
  openMeanRtMs: number | null;
  closeMeanRtMs: number | null;
};

export type LoadEvaluation = {
  state: LoadState;
  /** Fourth week of the cycle: the load is lowered and an assessment is proposed. */
  deload: boolean;
  assessmentDue: boolean;
  cycleDay: number;
  /** Parameters for today's BET session, light week included. */
  parameters: LoadParameters;
};

export function initialLoadState(today: string): LoadState {
  return { step: 0, lastStepAt: today, cycleStartedAt: today, assessmentPostponedUntil: null, lastChange: null };
}

export function evaluateLoad(
  current: LoadState,
  input: {
    today: string;
    /** Completed BET sessions, oldest first. */
    betSessions: BetSessionRecord[];
    /** Last BET or light session; defaults to the last BET session. */
    lastSessionDate?: string | null;
    lastAssessmentDate: string | null;
  },
  rules: LoadRules = LOAD_RULES,
): LoadEvaluation {
  const { today, betSessions, lastAssessmentDate } = input;
  let state = { ...current };

  // A new cycle every four weeks.
  while (daysBetween(state.cycleStartedAt, today) >= rules.cycleDays) {
    state = { ...state, cycleStartedAt: addDays(state.cycleStartedAt, rules.cycleDays), assessmentPostponedUntil: null };
  }
  const cycleDay = daysBetween(state.cycleStartedAt, today);
  const deload = cycleDay >= rules.deloadStartDay;

  const lastSession = input.lastSessionDate ?? betSessions.at(-1)?.date ?? null;
  const change = (kind: LoadChange["kind"], step: number, variable: LoadVariable | null = null) => {
    state = { ...state, step, lastStepAt: today, lastChange: { kind, variable, date: today } };
  };

  const inactive =
    lastSession !== null &&
    daysBetween(lastSession, today) > rules.inactivityDays &&
    !(state.lastChange?.kind === "inactivity" && state.lastChange.date > lastSession);
  if (inactive) {
    change("inactivity", Math.max(0, state.step - rules.inactivityDropSteps));
  } else if (fatigueBuildingUp(betSessions, state, rules)) {
    change("fatigue", Math.max(0, state.step - 1));
  } else if (!deload && daysBetween(state.lastStepAt, today) >= rules.stepIntervalDays) {
    const recent = betSessions.filter((session) => session.date >= state.lastStepAt);
    if (recent.length >= rules.minSessionsToStep && state.step < MAX_LOAD_STEP) {
      change("up", state.step + 1, variableChangedAt(state.step + 1));
    }
  }

  const deloadStart = addDays(state.cycleStartedAt, rules.deloadStartDay);
  const assessedThisDeload = lastAssessmentDate !== null && lastAssessmentDate >= deloadStart;
  const postponed = state.assessmentPostponedUntil !== null && today < state.assessmentPostponedUntil;
  return {
    state,
    deload,
    assessmentDue: deload && !assessedThisDeload && !postponed,
    cycleDay,
    parameters: loadParameters(Math.max(0, state.step - (deload ? rules.deloadSteps : 0))),
  };
}

/**
 * Fatigue signs over the last sessions not yet acted upon: a large gap between the two
 * fatigue checks every time, or an opening check getting slower session after session.
 */
function fatigueBuildingUp(sessions: BetSessionRecord[], state: LoadState, rules: LoadRules) {
  const last = sessions.slice(-rules.fatigueSessions);
  if (last.length < rules.fatigueSessions) return false;
  if (state.lastChange?.kind === "fatigue" && state.lastChange.date > last.at(-1)!.date) return false;

  const highGap = last.every(
    (s) =>
      s.closeLapses - s.openLapses >= rules.highFatigueLapseDelta ||
      (s.openMeanRtMs !== null && s.closeMeanRtMs !== null && s.closeMeanRtMs - s.openMeanRtMs >= rules.highFatigueRtDeltaMs),
  );
  const openings = last.map((s) => s.openMeanRtMs);
  const degrading =
    openings.every((rt) => rt !== null) &&
    openings.every((rt, i) => i === 0 || rt! > openings[i - 1]!) &&
    openings.at(-1)! - openings[0]! >= rules.degradingRtRiseMs;
  return highGap || degrading;
}

/** Pushes the proposed assessment back a couple of days, within the light week's limit; null when no longer possible. */
export function postponeAssessment(state: LoadState, today: string, rules: LoadRules = LOAD_RULES): LoadState | null {
  const until = addDays(today, rules.postponeDays);
  const limit = addDays(state.cycleStartedAt, rules.deloadStartDay + rules.maxPostponeDays);
  if (until > limit) return null;
  return { ...state, assessmentPostponedUntil: until };
}

/** Above this many lapses at the opening check, the app offers a lighter session or rest. */
export function adviseLighterSession(openLapses: number, rules: LoadRules = LOAD_RULES) {
  return openLapses > rules.lighterAdviceLapses;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
