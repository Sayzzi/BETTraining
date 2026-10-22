import { describe, expect, it } from "vitest";
import { PVT_B, pvtStandard, type PvtConfig } from "./pvt";
import { beginMain, frame, pause, respond, resume, startPvt, type PvtRun } from "./pvt";

const SHORT: PvtConfig = { ...pvtStandard(20_000), practiceTrials: 0 };

/** Advances frame by frame until a stimulus is on screen; returns the run and the onset time. */
function waitForStimulus(run: PvtRun, from: number): [PvtRun, number] {
  let at = from;
  let current = run;
  while (current.stimulusOnsetMs === null) {
    at += 16;
    current = frame(current, at);
    if (current.phase === "done") throw new Error("run ended before a stimulus");
  }
  return [current, at];
}

describe("PVT configurations", () => {
  it("PVT-B lasts 3 minutes, uses 1-4 s intervals and a 355 ms lapse threshold", () => {
    expect(PVT_B).toMatchObject({
      durationMs: 180_000,
      isiMinMs: 1_000,
      isiMaxMs: 4_000,
      lapseThresholdMs: 355,
      anticipationThresholdMs: 100,
      practiceTrials: 0,
    });
  });

  it("standard PVT uses 2-10 s intervals and a 500 ms lapse threshold", () => {
    expect(pvtStandard(300_000)).toMatchObject({
      durationMs: 300_000,
      isiMinMs: 2_000,
      isiMaxMs: 10_000,
      lapseThresholdMs: 500,
    });
  });
});

describe("PVT run", () => {
  it("shows the first stimulus after an interval within the configured bounds", () => {
    const run = startPvt(SHORT, 123, 1_000);
    const [, onsetAt] = waitForStimulus(run, 1_000);
    const isi = onsetAt - 1_000;
    expect(isi).toBeGreaterThanOrEqual(SHORT.isiMinMs);
    expect(isi).toBeLessThanOrEqual(SHORT.isiMaxMs + 16);
  });

  it("replays the same stimulus timing for the same seed", () => {
    const [, a] = waitForStimulus(startPvt(SHORT, 5, 0), 0);
    const [, b] = waitForStimulus(startPvt(SHORT, 5, 0), 0);
    expect(a).toBe(b);
  });

  it("records a hit with the reaction time measured from stimulus onset", () => {
    const [shown, onsetAt] = waitForStimulus(startPvt(SHORT, 1, 0), 0);
    const run = respond(shown, onsetAt + 250, { input: "keyboard" });

    expect(run.trials).toHaveLength(1);
    expect(run.trials[0]).toMatchObject({
      index: 0,
      practice: false,
      outcome: "hit",
      correct: true,
      rtMs: 250,
      response: { input: "keyboard" },
    });
    expect(run.stimulusOnsetMs).toBeNull();
  });

  it("classifies a slow response at or above the threshold as a lapse", () => {
    const [shown, onsetAt] = waitForStimulus(startPvt(PVT_B, 1, 0), 0);
    const run = respond(shown, onsetAt + 355, { input: "touch" });
    expect(run.trials[0]).toMatchObject({ outcome: "lapse", correct: true, rtMs: 355 });
  });

  it("classifies a response under 100 ms after onset as a false start", () => {
    const [shown, onsetAt] = waitForStimulus(startPvt(SHORT, 1, 0), 0);
    const run = respond(shown, onsetAt + 60, { input: "keyboard" });
    expect(run.trials[0]).toMatchObject({ outcome: "false_start", correct: false });
  });

  it("records a response with no stimulus on screen as a false start without ending the wait", () => {
    const run = respond(startPvt(SHORT, 1, 0), 500, { input: "keyboard" });
    expect(run.trials[0]).toMatchObject({ outcome: "false_start", correct: false, onsetMs: null, rtMs: null });
    expect(run.stimulusOnsetMs).toBeNull();
    expect(run.nextStimulusDueMs).toBe(startPvt(SHORT, 1, 0).nextStimulusDueMs);
  });

  it("records a miss when nobody responds before the timeout", () => {
    const [shown, onsetAt] = waitForStimulus(startPvt(SHORT, 1, 0), 0);
    const run = frame(shown, onsetAt + SHORT.timeoutMs);
    expect(run.trials[0]).toMatchObject({ outcome: "miss", correct: false, rtMs: null });
    expect(run.stimulusOnsetMs).toBeNull();
  });

  it("flags practice trials and waits for the user before the counted run", () => {
    const config: PvtConfig = { ...SHORT, practiceTrials: 2 };
    let run = startPvt(config, 1, 0);
    let at = 0;
    for (let i = 0; i < 2; i++) {
      [run, at] = waitForStimulus(run, at);
      at += 300;
      run = respond(run, at, { input: "keyboard" });
    }
    expect(run.phase).toBe("practice_done");
    expect(run.trials.every((trial) => trial.practice)).toBe(true);

    // No stimulus while waiting for the user, however long they take.
    run = frame(run, at + 60_000);
    expect(run.stimulusOnsetMs).toBeNull();

    run = beginMain(run, at + 60_000);
    [run, at] = waitForStimulus(run, at + 60_000);
    run = respond(run, at + 280, { input: "keyboard" });
    expect(run.trials.at(-1)).toMatchObject({ practice: false, index: 2 });
    expect(run.trials.at(-1)!.onsetMs).toBeLessThanOrEqual(SHORT.isiMaxMs + 16);
  });

  it("ends once the duration has elapsed and no stimulus is pending a response", () => {
    let run = startPvt(SHORT, 3, 0);
    let at = 0;
    while (run.phase !== "done") {
      at += 16;
      run = frame(run, at);
      if (run.stimulusOnsetMs !== null) run = respond(run, at + 300, { input: "keyboard" });
    }
    expect(at).toBeGreaterThanOrEqual(SHORT.durationMs);
    expect(run.trials.length).toBeGreaterThan(0);
    for (const trial of run.trials) expect(trial.onsetMs!).toBeLessThan(SHORT.durationMs);
  });

  it("excludes paused time and drops a stimulus interrupted by a pause", () => {
    const [shown, onsetAt] = waitForStimulus(startPvt(SHORT, 1, 0), 0);
    let run = pause(shown, onsetAt + 100);
    expect(run.pausedAt).toBe(onsetAt + 100);
    expect(frame(run, onsetAt + 50_000)).toBe(run);

    run = resume(run, onsetAt + 10_100);
    expect(run.stimulusOnsetMs).toBeNull();
    expect(run.pauses).toEqual([{ atMs: onsetAt + 100, durationMs: 10_000 }]);

    const [again, secondOnsetAt] = waitForStimulus(run, onsetAt + 10_100);
    run = respond(again, secondOnsetAt + 240, { input: "keyboard" });
    expect(run.trials).toHaveLength(1);
    // Onset is in active time: the 10 s pause is not counted.
    expect(run.trials[0].onsetMs).toBe(secondOnsetAt - 10_000);
  });

  it("ignores responses while paused", () => {
    const run = pause(startPvt(SHORT, 1, 0), 500);
    expect(respond(run, 600, { input: "keyboard" })).toBe(run);
  });
});
