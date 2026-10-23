import { describe, expect, it } from "vitest";
import {
  adviseLighterSession,
  evaluateLoad,
  initialLoadState,
  LOAD_RULES,
  loadParameters,
  MAX_LOAD_STEP,
  postponeAssessment,
  variableChangedAt,
  type BetSessionRecord,
  type LoadState,
} from "./load";
import { addDays } from "./weekly-plan";

const START = "2026-10-05"; // a Monday

/** A calm BET session: small gap between the opening and closing fatigue checks. */
function calm(date: string, openMeanRtMs = 280): BetSessionRecord {
  return { date, openLapses: 1, closeLapses: 2, openMeanRtMs, closeMeanRtMs: openMeanRtMs + 20 };
}

/** Runs the daily evaluation from START for `days` days, with BET sessions on the given day offsets. */
function simulate(days: number, sessionDays: (day: number) => BetSessionRecord | null, rules = LOAD_RULES) {
  let state = initialLoadState(START);
  const sessions: BetSessionRecord[] = [];
  const log: { day: number; step: number; deload: boolean; assessmentDue: boolean }[] = [];
  for (let day = 0; day < days; day++) {
    const today = addDays(START, day);
    const result = evaluateLoad(state, { today, betSessions: sessions, lastAssessmentDate: null }, rules);
    state = result.state;
    log.push({ day, step: state.step, deload: result.deload, assessmentDue: result.assessmentDue });
    const session = sessionDays(day);
    if (session) sessions.push(session);
  }
  return { state, log };
}

const everyOtherDay = (day: number) => (day % 2 === 0 ? calm(addDays(START, day)) : null);

describe("load parameters", () => {
  it("starts light and changes exactly one variable per step", () => {
    expect(loadParameters(0)).toEqual({ betShare: 0.6, betLevelOffset: 0, betExerciseMaxMin: 20 });
    for (let step = 1; step <= MAX_LOAD_STEP; step++) {
      const before = loadParameters(step - 1);
      const after = loadParameters(step);
      const changed = (Object.keys(after) as (keyof typeof after)[]).filter((key) => after[key] !== before[key]);
      expect(changed).toEqual([variableChangedAt(step)]);
    }
  });

  it("rotates the variables, carrying on with the others once one is maxed", () => {
    expect([1, 2, 3, 4].map(variableChangedAt)).toEqual(["betShare", "betLevelOffset", "betExerciseMaxMin", "betShare"]);
    expect(loadParameters(MAX_LOAD_STEP)).toEqual({ betShare: 0.7, betLevelOffset: 4, betExerciseMaxMin: 40 });
    expect(loadParameters(MAX_LOAD_STEP + 5)).toEqual(loadParameters(MAX_LOAD_STEP));
  });
});

describe("load progression", () => {
  it("steps up every two weeks when sessions go well", () => {
    const { log } = simulate(42, everyOtherDay);
    expect(log.find((entry) => entry.day === 13)!.step).toBe(0);
    expect(log.find((entry) => entry.day === 14)!.step).toBe(1);
    // The fourth week of each cycle is a light week, which holds the steps.
    expect(log.find((entry) => entry.day === 41)!.step).toBe(2);
  });

  it("holds the step without enough BET sessions", () => {
    const { log } = simulate(20, (day) => (day === 0 ? calm(START) : null));
    expect(log.at(-1)!.step).toBe(0);
  });

  it("records which variable each step changed", () => {
    const { state } = simulate(15, everyOtherDay);
    expect(state.lastChange).toMatchObject({ kind: "up", variable: "betShare", date: addDays(START, 14) });
  });

  it("lightens the fourth week of every cycle and proposes an assessment there", () => {
    const { log } = simulate(56, everyOtherDay);
    expect(log.filter((e) => e.deload).map((e) => e.day)).toEqual([21, 22, 23, 24, 25, 26, 27, 49, 50, 51, 52, 53, 54, 55]);
    expect(log.filter((e) => e.assessmentDue).map((e) => e.day)).toEqual(log.filter((e) => e.deload).map((e) => e.day));
  });

  it("no longer proposes the assessment once it is taken during the light week", () => {
    let state = initialLoadState(START);
    const day22 = addDays(START, 22);
    state = evaluateLoad(state, { today: day22, betSessions: [], lastAssessmentDate: addDays(START, 21) }, LOAD_RULES).state;
    expect(evaluateLoad(state, { today: day22, betSessions: [], lastAssessmentDate: addDays(START, 21) }, LOAD_RULES).assessmentDue).toBe(false);
  });

  it("lets the user postpone the assessment a few days, within a limit", () => {
    const day21 = addDays(START, 21);
    let state: LoadState = evaluateLoad(initialLoadState(START), { today: day21, betSessions: [], lastAssessmentDate: null }, LOAD_RULES).state;
    state = postponeAssessment(state, day21, LOAD_RULES)!;
    expect(state.assessmentPostponedUntil).toBe(addDays(START, 23));
    expect(evaluateLoad(state, { today: addDays(START, 22), betSessions: [], lastAssessmentDate: null }, LOAD_RULES).assessmentDue).toBe(false);
    expect(evaluateLoad(state, { today: addDays(START, 23), betSessions: [], lastAssessmentDate: null }, LOAD_RULES).assessmentDue).toBe(true);
    // Up to 6 days: two more postponements, then no more.
    state = postponeAssessment(state, addDays(START, 23), LOAD_RULES)!;
    state = postponeAssessment(state, addDays(START, 25), LOAD_RULES)!;
    expect(state.assessmentPostponedUntil).toBe(addDays(START, 27));
    expect(postponeAssessment(state, addDays(START, 27), LOAD_RULES)).toBeNull();
  });

  it("drops two steps after more than seven days without a session, then climbs again", () => {
    // Good sessions for four weeks (step 2), then nothing for ten days, then sessions again.
    const { log } = simulate(70, (day) => (day < 28 || day >= 38 ? everyOtherDay(day) : null));
    // Last session on day 26: day 34 is the eighth day without one.
    expect(log.find((e) => e.day === 28)!.step).toBe(2);
    expect(log.find((e) => e.day === 33)!.step).toBe(2);
    expect(log.find((e) => e.day === 34)!.step).toBe(0);
    // Two weeks later, sessions having resumed, the climb starts again.
    expect(log.find((e) => e.day === 47)!.step).toBe(0);
    expect(log.find((e) => e.day === 48)!.step).toBe(1);
  });

  it("drops a step when the gap between the fatigue checks stays high", () => {
    const tiring = (day: number) =>
      day % 2 === 0 ? { date: addDays(START, day), openLapses: 1, closeLapses: 7, openMeanRtMs: 280, closeMeanRtMs: 300 } : null;
    const { log, state } = simulate(30, (day) => (day < 16 ? everyOtherDay(day) : tiring(day)));
    expect(log.find((e) => e.day === 16)!.step).toBe(1);
    // Three tiring sessions (days 16, 18, 20): one step down the next day.
    expect(log.find((e) => e.day === 21)!.step).toBe(0);
    expect(state.lastChange).toMatchObject({ kind: "fatigue" });
  });

  it("drops a step when the opening check gets worse three sessions in a row", () => {
    const degrading = (day: number) => (day % 2 === 0 ? calm(addDays(START, day), 280 + (day - 16) * 10) : null);
    const { log } = simulate(24, (day) => (day < 16 ? everyOtherDay(day) : degrading(day)));
    expect(log.find((e) => e.day === 20)!.step).toBe(1);
    expect(log.find((e) => e.day === 21)!.step).toBe(0);
  });

  it("uses configurable thresholds", () => {
    const rules = { ...LOAD_RULES, stepIntervalDays: 7, inactivityDays: 3 };
    const { log } = simulate(15, everyOtherDay, rules);
    expect(log.find((e) => e.day === 7)!.step).toBe(1);
    expect(log.find((e) => e.day === 14)!.step).toBe(2);
  });
});

describe("lighter session advice", () => {
  it("advises a lighter session above three lapses at the opening check", () => {
    expect(adviseLighterSession(3)).toBe(false);
    expect(adviseLighterSession(4)).toBe(true);
    expect(adviseLighterSession(4, { ...LOAD_RULES, lighterAdviceLapses: 5 })).toBe(false);
  });
});
