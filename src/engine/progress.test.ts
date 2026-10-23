import { describe, expect, it } from "vitest";
import * as choice from "./choice-task";
import { exerciseConfig } from "./exercises";
import { FLANKER_SPEC } from "./flanker";
import { domainLevelSeries, LEVEL_WINDOW, runEndLevel, type LevelRun } from "./progress";

/** A run whose trials raise or lower the level: `correct` answers right, others wrong. */
function run(date: string, exercise: LevelRun["exercise"], startLevel: number, correct: number, wrong = 0): LevelRun {
  const trials = [
    ...Array.from({ length: correct }, (_, i) => ({ correct: true, index: i })),
    ...Array.from({ length: wrong }, (_, i) => ({ correct: false, index: correct + i })),
  ].map(({ correct: ok, index }) => ({
    index,
    practice: false,
    onsetMs: index * 1000,
    responseMs: index * 1000 + 400,
    rtMs: 400,
    outcome: ok ? ("hit" as const) : ("error" as const),
    correct: ok,
    stimulus: null,
    response: null,
    difficulty: null,
  }));
  return { date, exercise, config: exerciseConfig(exercise, 3), startLevel, trials };
}

describe("run end level", () => {
  it("replays the staircase over the run's raw trials", () => {
    // 8 successes at +0.25 each.
    expect(runEndLevel(run("2026-10-01", "stroop", 3, 8))).toBe(5);
    // Then one error at -1.
    expect(runEndLevel(run("2026-10-01", "stroop", 3, 8, 1))).toBe(4);
  });

  it("matches the level the engine reached during a real run", () => {
    const config = { ...(exerciseConfig("flanker", 3) as choice.ChoiceTaskConfig), durationMs: 30_000, practiceTrials: 0 };
    let state = choice.startChoiceTask(config, FLANKER_SPEC, 7, 0, 4);
    let at = 0;
    let n = 0;
    while (state.phase !== "done") {
      at += 10;
      state = choice.frame(state, at);
      if (state.current) {
        const right = FLANKER_SPEC.correctChoice(state.current.stimulus);
        state = choice.respond(state, at + 400, n++ % 6 === 5 ? "wrong" : right, "keyboard");
      }
    }
    expect(runEndLevel({ date: "2026-10-01", exercise: "flanker", config, startLevel: 4, trials: state.trials })).toBeCloseTo(state.level);
  });
});

describe("level per domain over time", () => {
  it("averages each domain's last runs at every date", () => {
    const runs = [
      run("2026-10-01", "nback", 2, 4), // ends at 3
      run("2026-10-03", "nback", 3, 8), // ends at 5
      run("2026-10-03", "stroop", 3, 0), // ends at 3
    ];
    const series = domainLevelSeries(runs);
    expect(series.working_memory).toEqual([
      { date: "2026-10-01", level: 3 },
      { date: "2026-10-03", level: 4 },
    ]);
    expect(series.inhibition).toEqual([{ date: "2026-10-03", level: 3 }]);
    expect(series.processing_speed).toEqual([]);
  });

  it("counts a run for every domain its exercise trains", () => {
    const series = domainLevelSeries([run("2026-10-02", "flanker", 3, 4)]);
    expect(series.inhibition).toEqual([{ date: "2026-10-02", level: 4 }]);
    expect(series.sustained_attention).toEqual([{ date: "2026-10-02", level: 4 }]);
  });

  it("only keeps the last runs in the window", () => {
    const runs = Array.from({ length: LEVEL_WINDOW + 2 }, (_, i) =>
      run(`2026-10-${String(i + 1).padStart(2, "0")}`, "stroop", i < 2 ? 1 : 10, 0),
    );
    // The two early runs at level 1 have left the window by the last date.
    expect(domainLevelSeries(runs).inhibition.at(-1)).toEqual({ date: `2026-10-0${LEVEL_WINDOW + 2}`, level: 10 });
  });

  it("ignores exercises without difficulty", () => {
    const pvt = { ...run("2026-10-01", "stroop", 3, 4), exercise: "pvt" as const, config: exerciseConfig("pvt", 3) };
    expect(domainLevelSeries([pvt]).sustained_attention).toEqual([]);
  });
});
