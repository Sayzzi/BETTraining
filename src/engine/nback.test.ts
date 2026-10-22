import { describe, expect, it } from "vitest";
import { beginMain, frame, isVisible, nBackParameters, pause, respond, resume, startNBack, type NBackConfig, type NBackRun } from "./nback";

const CONFIG: NBackConfig = {
  durationMs: 60_000,
  stimulusMs: 500,
  blockScoredTrials: 10,
  targetRate: 1 / 3,
  practiceScoredTrials: 0,
  minLevel: 1,
  maxLevel: 15,
  target: 0.8,
};

/** Advances to the next stimulus onset. */
function nextStimulus(run: NBackRun, from: number): [NBackRun, number] {
  let at = from;
  let current = run;
  const startIndex = current.sequenceIndex;
  while (current.current === null || current.sequenceIndex === startIndex) {
    at += 10;
    current = frame(current, at);
    if (current.phase === "practice_done") return [current, at];
    if (current.phase === "done") throw new Error("run ended");
  }
  return [current, at];
}

function answerCorrectly(run: NBackRun, at: number) {
  return respond(run, at, { choice: run.current!.isTarget ? "match" : "different", input: "keyboard" });
}

describe("n-back parameters", () => {
  it("maps levels to N and pace: three speeds per N, then the next N", () => {
    expect(nBackParameters(1)).toEqual({ n: 1, soaMs: 3000 });
    expect(nBackParameters(2.9)).toEqual({ n: 1, soaMs: 2500 });
    expect(nBackParameters(3)).toEqual({ n: 1, soaMs: 2000 });
    expect(nBackParameters(4)).toEqual({ n: 2, soaMs: 3000 });
    expect(nBackParameters(15)).toEqual({ n: 5, soaMs: 2000 });
  });
});

describe("n-back run", () => {
  it("builds blocks where targets repeat the letter N positions back and others never do", () => {
    const run = startNBack(CONFIG, 7, 0, 5); // 2-back
    const { letters, targets, n } = run.block;
    expect(n).toBe(2);
    expect(letters).toHaveLength(2 + CONFIG.blockScoredTrials);
    for (let i = n; i < letters.length; i++) {
      expect(letters[i] === letters[i - n]).toBe(targets[i]);
    }
    expect(targets.slice(0, n).every((t) => !t)).toBe(true);
  });

  it("replays the same letters for the same seed", () => {
    expect(startNBack(CONFIG, 3, 0, 4).block.letters).toEqual(startNBack(CONFIG, 3, 0, 4).block.letters);
  });

  it("shows each letter for the stimulus duration, then a blank until the next onset", () => {
    const [run, onset] = nextStimulus(startNBack(CONFIG, 1, 0, 1), 0);
    expect(isVisible(run, onset + 100)).toBe(true);
    expect(isVisible(run, onset + CONFIG.stimulusMs + 10)).toBe(false);
  });

  it("only scores letters that have a letter N positions back", () => {
    let run = startNBack(CONFIG, 1, 0, 1); // 1-back: the first letter is not scored
    let at = 0;
    [run, at] = nextStimulus(run, at);
    expect(run.current!.scored).toBe(false);
    run = respond(run, at + 300, { choice: "match", input: "keyboard" });
    [run, at] = nextStimulus(run, at);
    expect(run.trials).toHaveLength(0);
    expect(run.current!.scored).toBe(true);
  });

  it("records a correct choice as a hit with its reaction time and difficulty", () => {
    let run = startNBack(CONFIG, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    [run, at] = nextStimulus(run, at);
    run = answerCorrectly(run, at + 420);
    [run] = nextStimulus(run, at);

    expect(run.trials[0]).toMatchObject({
      index: 0,
      outcome: "hit",
      correct: true,
      rtMs: 420,
      response: { input: "keyboard" },
      difficulty: { level: 1, n: 1, soaMs: 3000 },
    });
    expect(run.trials[0].stimulus).toMatchObject({ n: 1, isTarget: expect.any(Boolean), letter: expect.any(String) });
  });

  it("records a wrong choice as an error and no answer as a miss", () => {
    let run = startNBack(CONFIG, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    [run, at] = nextStimulus(run, at);
    const wrong = run.current!.isTarget ? "different" : "match";
    run = respond(run, at + 300, { choice: wrong, input: "touch" });
    [run, at] = nextStimulus(run, at);
    [run, at] = nextStimulus(run, at);
    expect(run.trials.map((t) => t.outcome)).toEqual(["error", "miss"]);
  });

  it("keeps the first answer to a letter and ignores the rest", () => {
    let run = startNBack(CONFIG, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    [run, at] = nextStimulus(run, at);
    run = answerCorrectly(run, at + 300);
    const wrong = run.current!.isTarget ? "different" : "match";
    run = respond(run, at + 600, { choice: wrong, input: "keyboard" });
    [run] = nextStimulus(run, at);
    expect(run.trials[0]).toMatchObject({ outcome: "hit", rtMs: 300 });
  });

  it("raises the level after successes and applies it at the next block", () => {
    let run = startNBack(CONFIG, 2, 0, 1);
    let at = 0;
    while (run.blockNumber === 0) {
      [run, at] = nextStimulus(run, at);
      if (run.blockNumber === 0 && run.current?.scored) run = answerCorrectly(run, at + 300);
    }
    // 10 successes at +0.25 each: level 1 -> 3.5, i.e. 1-back at 2000 ms.
    expect(run.level).toBeCloseTo(3.5);
    expect(run.block).toMatchObject({ n: 1, soaMs: 2000 });
  });

  it("flags practice trials, then waits for the user before the counted run", () => {
    let run = startNBack({ ...CONFIG, practiceScoredTrials: 3 }, 1, 0, 1);
    let at = 0;
    while (run.phase === "practice") {
      [run, at] = nextStimulus(run, at);
      if (run.phase === "practice" && run.current?.scored) run = answerCorrectly(run, at + 300);
      at += 3000;
      run = frame(run, at);
    }
    expect(run.phase).toBe("practice_done");
    expect(run.trials).toHaveLength(3);
    expect(run.trials.every((t) => t.practice)).toBe(true);
    // Practice does not move the level.
    expect(run.level).toBe(1);

    run = beginMain(run, at + 5000);
    [run, at] = nextStimulus(run, at + 5000);
    expect(run.phase).toBe("main");
    expect(run.current!.scored).toBe(false);
  });

  it("ends once the duration has elapsed, at a letter boundary", () => {
    let run = startNBack({ ...CONFIG, durationMs: 20_000 }, 4, 0, 1);
    let at = 0;
    while (run.phase !== "done") {
      at += 10;
      run = frame(run, at);
    }
    expect(at).toBeGreaterThanOrEqual(20_000);
    expect(at).toBeLessThan(20_000 + 3_100);
  });

  it("drops the letter interrupted by a pause and excludes paused time", () => {
    let run = startNBack(CONFIG, 1, 0, 1);
    let at = 0;
    [run, at] = nextStimulus(run, at);
    [run, at] = nextStimulus(run, at);
    run = pause(run, at + 100);
    expect(respond(run, at + 200, { choice: "match", input: "keyboard" })).toBe(run);
    run = resume(run, at + 30_100);
    expect(run.current).toBeNull();
    expect(run.pauses).toEqual([{ atMs: at + 100, durationMs: 30_000 }]);
    // The block restarts so the next letters can be compared again.
    [run] = nextStimulus(run, at + 30_100);
    expect(run.current!.scored).toBe(false);
    expect(run.trials).toHaveLength(0);
  });
});
