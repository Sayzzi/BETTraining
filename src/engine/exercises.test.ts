import { describe, expect, it } from "vitest";
import { EXERCISES, exerciseConfig, finalLevel } from "./exercises";
import { frame, respond, startNBack, type NBackConfig } from "./nback";

describe("exercise catalogue", () => {
  it("declares the PVT in the shared format, without difficulty", () => {
    expect(EXERCISES.pvt).toEqual({
      id: "pvt",
      domains: ["sustained_attention"],
      betEligible: true,
      difficulty: null,
    });
  });

  it("declares the n-back as an adaptive working-memory exercise usable in the BET block", () => {
    expect(EXERCISES.nback).toMatchObject({
      domains: ["working_memory"],
      betEligible: true,
      difficulty: { min: 1, max: 15, initial: 2, levers: ["n", "pace"] },
    });
  });

  it("declares Stroop and flanker as adaptive inhibition exercises usable in the BET block, with speed levers", () => {
    for (const id of ["stroop", "flanker"] as const) {
      expect(EXERCISES[id].domains).toContain("inhibition");
      expect(EXERCISES[id].betEligible).toBe(true);
      expect(EXERCISES[id].difficulty!.levers).toEqual(["incongruentRate", "responseWindow", "interTrialInterval"]);
    }
    expect(EXERCISES.flanker.domains).toContain("sustained_attention");
  });

  it("keeps the PVT-B fatigue check out of the BET block", () => {
    expect(EXERCISES.pvt_b.betEligible).toBe(false);
  });

  it("replays the n-back level reached by a run from its stored trials", () => {
    const config = { ...(exerciseConfig("nback", 3) as NBackConfig), practiceScoredTrials: 0 };
    let run = startNBack(config, 11, 0, 4);
    let at = 0;
    while (run.phase !== "done") {
      at += 10;
      run = frame(run, at);
      if (run.current?.scored && !run.current.answer && run.current.position % 4 !== 0) {
        run = respond(run, at + 400, { choice: run.current.isTarget ? "match" : "different", input: "keyboard" });
      }
    }
    expect(finalLevel(config, 4, run.trials)).toBeCloseTo(run.level);
  });

  it("has no level for exercises without difficulty", () => {
    expect(finalLevel(exerciseConfig("pvt", 3), null, [])).toBeNull();
  });
});
