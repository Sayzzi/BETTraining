import { describe, expect, it } from "vitest";
import {
  beginMain,
  frame,
  interpolate,
  pause,
  respond,
  resume,
  startChoiceTask,
  type ChoiceTaskConfig,
  type ChoiceTaskRun,
  type ChoiceTaskSpec,
} from "./choice-task";
import { nextInt } from "./random";

type Stim = { side: "left" | "right"; congruent: boolean };

// A minimal task: answer the side shown.
const SPEC: ChoiceTaskSpec<Stim> = {
  parameters: (level) => ({
    incongruentRate: interpolate(level, 1, 15, 0.25, 0.75),
    responseWindowMs: Math.round(interpolate(level, 1, 15, 2000, 600)),
    itiMs: Math.round(interpolate(level, 1, 15, 1000, 400)),
  }),
  makeStimulus: (rng, incongruent) => {
    const [side, next] = nextInt(rng, 0, 1);
    return [{ side: side === 0 ? "left" : "right", congruent: !incongruent }, next];
  },
  correctChoice: (stimulus) => stimulus.side,
};

const CONFIG: ChoiceTaskConfig = { durationMs: 30_000, practiceTrials: 0, minLevel: 1, maxLevel: 15, target: 0.8 };

function nextStimulus(run: ChoiceTaskRun<Stim>, from: number): [ChoiceTaskRun<Stim>, number] {
  let at = from;
  let current = run;
  while (current.current === null) {
    at += 10;
    current = frame(current, at);
    if (current.phase !== "practice" && current.phase !== "main") return [current, at];
  }
  return [current, at];
}

describe("interpolate", () => {
  it("maps the level range linearly onto a parameter range", () => {
    expect(interpolate(1, 1, 15, 0.25, 0.75)).toBe(0.25);
    expect(interpolate(8, 1, 15, 0.25, 0.75)).toBeCloseTo(0.5);
    expect(interpolate(15, 1, 15, 2000, 600)).toBe(600);
  });
});

describe("choice task run", () => {
  it("replays the same stimuli for the same seed", () => {
    const play = () => {
      let run = startChoiceTask(CONFIG, SPEC, 9, 0, 5);
      const seen: Stim[] = [];
      let at = 0;
      for (let i = 0; i < 10; i++) {
        [run, at] = nextStimulus(run, at);
        seen.push(run.current!.stimulus);
        run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
      }
      return seen;
    };
    expect(play()).toEqual(play());
  });

  it("records the right choice as a hit and the wrong one as an error, with difficulty", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    const right = run.current!.stimulus.side;
    run = respond(run, at + 450, right, "keyboard");
    [run, at] = nextStimulus(run, at + 450);
    const wrong = run.current!.stimulus.side === "left" ? "right" : "left";
    run = respond(run, at + 500, wrong, "touch");

    expect(run.trials.map((t) => [t.outcome, t.correct, t.rtMs])).toEqual([
      ["hit", true, 450],
      ["error", false, 500],
    ]);
    expect(run.trials[0].response).toEqual({ input: "keyboard", choice: right });
    expect(run.trials[0].difficulty).toEqual({ level: 1, incongruentRate: 0.25, responseWindowMs: 2000, itiMs: 1000 });
    expect(run.trials[0].stimulus).toMatchObject({ side: right, congruent: expect.any(Boolean) });
  });

  it("closes the trial as soon as the user answers, then waits the inter-trial interval", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
    expect(run.current).toBeNull();
    const [, nextOnset] = nextStimulus(run, at + 300);
    expect(nextOnset - (at + 300)).toBeGreaterThanOrEqual(1000);
    expect(nextOnset - (at + 300)).toBeLessThan(1020);
  });

  it("records a miss when the response window closes", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    run = frame(run, at + 2000);
    expect(run.trials[0]).toMatchObject({ outcome: "miss", correct: false, rtMs: null });
  });

  it("treats an answer under 100 ms as a false start", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    run = respond(run, at + 40, run.current!.stimulus.side, "keyboard");
    expect(run.trials[0]).toMatchObject({ outcome: "false_start", correct: false });
  });

  it("ignores answers between trials", () => {
    const run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    expect(respond(run, 200, "left", "keyboard")).toBe(run);
  });

  it("applies the new level from the very next trial", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    for (let i = 0; i < 4; i++) {
      [run, at] = nextStimulus(run, at);
      run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
    }
    expect(run.level).toBe(2);
    [run, at] = nextStimulus(run, at);
    run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
    expect(run.trials.at(-1)!.difficulty).toMatchObject({ level: 2 });
  });

  it("draws incongruent stimuli at the rate set by the level", () => {
    const count = (level: number) => {
      let run = startChoiceTask({ ...CONFIG, durationMs: 10_000_000 }, SPEC, 3, 0, level);
      let at = 0;
      let incongruent = 0;
      for (let i = 0; i < 2000; i++) {
        [run, at] = nextStimulus(run, at);
        if (!run.current!.stimulus.congruent) incongruent++;
        run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
      }
      return incongruent / 2000;
    };
    // Starting at the top and always succeeding keeps the level at the maximum.
    expect(count(15)).toBeCloseTo(0.75, 1);
  });

  it("flags practice trials without moving the level, then waits for the user", () => {
    let run = startChoiceTask({ ...CONFIG, practiceTrials: 3 }, SPEC, 1, 0, 4);
    let at = 0;
    while (run.phase === "practice") {
      [run, at] = nextStimulus(run, at);
      if (run.current) run = respond(run, at + 300, run.current.stimulus.side, "keyboard");
    }
    expect(run.phase).toBe("practice_done");
    expect(run.trials).toHaveLength(3);
    expect(run.trials.every((t) => t.practice)).toBe(true);
    expect(run.level).toBe(4);
    run = beginMain(run, at + 1000);
    expect(run.phase).toBe("main");
  });

  it("ends at a trial boundary once the duration has elapsed", () => {
    let run = startChoiceTask(CONFIG, SPEC, 2, 0, 1);
    let at = 0;
    while (run.phase !== "done") {
      at += 10;
      run = frame(run, at);
    }
    expect(at).toBeGreaterThanOrEqual(CONFIG.durationMs);
    expect(at).toBeLessThan(CONFIG.durationMs + 2100);
  });

  it("drops the trial interrupted by a pause and excludes paused time", () => {
    let run = startChoiceTask(CONFIG, SPEC, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    run = pause(run, at + 100);
    expect(respond(run, at + 200, "left", "keyboard")).toBe(run);
    run = resume(run, at + 20_100);
    expect(run.current).toBeNull();
    expect(run.trials).toHaveLength(0);
    expect(run.pauses).toEqual([{ atMs: at + 100, durationMs: 20_000 }]);
    [run, at] = nextStimulus(run, at + 20_100);
    run = respond(run, at + 300, run.current!.stimulus.side, "keyboard");
    expect(run.trials[0].onsetMs).toBe(at - 20_000);
  });
});
