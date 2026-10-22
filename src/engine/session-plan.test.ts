import { describe, expect, it } from "vitest";
import type { ChoiceTaskConfig } from "./choice-task";
import { EXERCISES } from "./exercises";
import type { NBackConfig } from "./nback";
import type { RtResults } from "./results";
import {
  BET_DURATIONS_MIN,
  fatigueCheckChange,
  planBetSession,
  sessionLoad,
  type BetHistory,
  type PlannedStep,
} from "./session-plan";

const FIRST: BetHistory = { betSessionCount: 0, previousBetExercises: [], classification: {} };

const minutes = (steps: PlannedStep[], block: PlannedStep["block"]) =>
  steps.filter((s) => s.block === block).reduce((sum, s) => sum + s.config.durationMs, 0) / 60_000;

describe("BET session plan", () => {
  it.each(BET_DURATIONS_MIN)("orders the blocks: fatigue check, targeted, BET, fatigue check (%i min)", (duration) => {
    const blocks = planBetSession(duration, FIRST).steps.map((s) => s.block);
    expect(blocks[0]).toBe("fatigue_open");
    expect(blocks.at(-1)).toBe("fatigue_close");
    const middle = blocks.slice(1, -1);
    expect(middle.lastIndexOf("targeted")).toBeLessThan(middle.indexOf("bet"));
  });

  it.each(BET_DURATIONS_MIN)("fills the chosen %i minutes, 60 to 70 %% of it in the BET block", (duration) => {
    const { steps } = planBetSession(duration, FIRST);
    const total = steps.reduce((sum, s) => sum + s.config.durationMs, 0) / 60_000;
    expect(total).toBeCloseTo(duration, 5);
    const share = minutes(steps, "bet") / duration;
    expect(share).toBeGreaterThanOrEqual(0.6);
    expect(share).toBeLessThanOrEqual(0.7);
  });

  it("opens and closes with a 3-minute PVT-B", () => {
    const { steps } = planBetSession(45, FIRST);
    for (const step of [steps[0], steps.at(-1)!]) {
      expect(step.exercise).toBe("pvt_b");
      expect(step.config.durationMs).toBe(180_000);
    }
  });

  it.each(BET_DURATIONS_MIN)("splits the targeted block into exercises of about 3 minutes (%i min)", (duration) => {
    for (const step of planBetSession(duration, FIRST).steps.filter((s) => s.block === "targeted")) {
      expect(step.config.durationMs / 60_000).toBeGreaterThanOrEqual(2.5);
      expect(step.config.durationMs / 60_000).toBeLessThanOrEqual(4);
    }
  });

  it("uses one long BET exercise in 30 minutes and two in 45 or 60", () => {
    expect(planBetSession(30, FIRST).steps.filter((s) => s.block === "bet")).toHaveLength(1);
    expect(planBetSession(45, FIRST).steps.filter((s) => s.block === "bet")).toHaveLength(2);
    expect(planBetSession(60, FIRST).steps.filter((s) => s.block === "bet")).toHaveLength(2);
  });

  it("only uses BET-eligible exercises in the BET block, never those of the previous session", () => {
    let history = FIRST;
    for (let session = 0; session < 8; session++) {
      const bet = planBetSession(45, history).steps.filter((s) => s.block === "bet").map((s) => s.exercise);
      for (const exercise of bet) {
        expect(["stroop", "flanker", "nback", "pvt"]).toContain(exercise);
        expect(EXERCISES[exercise].betEligible).toBe(true);
        expect(history.previousBetExercises).not.toContain(exercise);
      }
      expect(new Set(bet).size).toBe(bet.length);
      history = { ...history, betSessionCount: session + 1, previousBetExercises: bet };
    }
  });

  it("spreads the targeted block evenly across the four domains over sessions", () => {
    const counts = new Map<string, number>();
    let history = FIRST;
    for (let session = 0; session < 8; session++) {
      const { steps } = planBetSession(30, history);
      for (const step of steps.filter((s) => s.block === "targeted")) {
        counts.set(step.domain!, (counts.get(step.domain!) ?? 0) + 1);
      }
      history = { ...history, betSessionCount: session + 1, previousBetExercises: [] };
    }
    expect([...counts.keys()].sort()).toEqual(["inhibition", "processing_speed", "sustained_attention", "working_memory"]);
    expect(new Set(counts.values()).size).toBe(1);
  });

  it("targets 95 % success in the BET block with the conflict share pinned, 80 % in the targeted block", () => {
    const { steps } = planBetSession(60, { ...FIRST, previousBetExercises: ["nback", "pvt"] });
    const bet = steps.filter((s) => s.block === "bet");
    expect(bet.map((s) => s.exercise).sort()).toEqual(["flanker", "stroop"]);
    for (const step of bet) {
      const config = step.config as ChoiceTaskConfig;
      expect(config.target).toBe(0.95);
      expect(config.fixedIncongruentRate).toBeDefined();
      expect(step.difficultyKey).toBe(`${step.exercise}:bet`);
    }
    expect((bet.find((s) => s.exercise === "stroop")!.config as ChoiceTaskConfig).fixedIncongruentRate).toBe(1);
    for (const step of steps.filter((s) => s.block === "targeted" && "target" in s.config)) {
      expect((step.config as NBackConfig).target).toBe(0.8);
      expect(step.difficultyKey).toBe(step.exercise);
    }
  });

  it("skips practice trials: the user already knows the exercises", () => {
    for (const step of planBetSession(60, FIRST).steps) {
      const config = step.config as Record<string, unknown>;
      expect(config.practiceTrials ?? config.practiceScoredTrials ?? 0).toBe(0);
    }
  });

  it("shrinks every duration with the time scale used by automated tests", () => {
    const quick = planBetSession(30, FIRST, 0.01).steps;
    planBetSession(30, FIRST).steps.forEach((step, i) => {
      expect(quick[i].config.durationMs).toBe(Math.round(step.config.durationMs * 0.01));
    });
  });
});

/** Targeted slots per domain over many 45-minute sessions (three slots each). */
function targetedShares(classification: BetHistory["classification"], options?: { weaknessWeight?: number }) {
  const counts: Record<string, number> = {};
  let history: BetHistory = { ...FIRST, classification };
  for (let session = 0; session < 40; session++) {
    for (const step of planBetSession(45, history, 1, options).steps.filter((s) => s.block === "targeted")) {
      counts[step.domain!] = (counts[step.domain!] ?? 0) + 1;
    }
    history = { ...history, betSessionCount: session + 1 };
  }
  return counts;
}

describe("personalised targeted block", () => {
  const ALL_STRONG = {
    sustained_attention: "strength",
    working_memory: "strength",
    inhibition: "strength",
    processing_speed: "strength",
  } as const;
  const ALL_WEAK = {
    sustained_attention: "weakness",
    working_memory: "weakness",
    inhibition: "weakness",
    processing_speed: "weakness",
  } as const;

  it.each([
    ["no ranking yet", {}],
    ["no weakness", ALL_STRONG],
    ["only weaknesses", ALL_WEAK],
  ])("shares the targeted block evenly with %s", (_label, classification) => {
    expect(new Set(Object.values(targetedShares(classification))).size).toBe(1);
  });

  it("gives a weakness twice the slots of a strength", () => {
    const counts = targetedShares({ ...ALL_STRONG, working_memory: "weakness" });
    expect(counts.working_memory).toBe(2 * counts.inhibition);
    expect(counts.inhibition).toBe(counts.sustained_attention);
    expect(counts.inhibition).toBe(counts.processing_speed);
  });

  it("keeps the 2:1 ratio with several weaknesses", () => {
    const counts = targetedShares({ ...ALL_WEAK, sustained_attention: "strength", inhibition: "strength" });
    expect(counts.working_memory).toBe(counts.processing_speed);
    expect(counts.working_memory).toBe(2 * counts.inhibition);
  });

  it("uses a configurable ratio", () => {
    const counts = targetedShares({ ...ALL_STRONG, inhibition: "weakness" }, { weaknessWeight: 3 });
    expect(counts.inhibition).toBe(3 * counts.working_memory);
  });

  it("never schedules the same domain twice in a row within a session", () => {
    const { steps } = planBetSession(60, { ...FIRST, classification: { ...ALL_STRONG, working_memory: "weakness" } });
    const domains = steps.filter((s) => s.block === "targeted").map((s) => s.domain);
    domains.slice(1).forEach((domain, i) => expect(domain).not.toBe(domains[i]));
  });
});

describe("plan explanation", () => {
  it("names the weaknesses, the targeted domains and the BET rotation, all visible to the user", () => {
    const { steps, explanation } = planBetSession(45, {
      betSessionCount: 3,
      previousBetExercises: ["stroop"],
      classification: { working_memory: "weakness", inhibition: "strength" },
    });
    expect(explanation).toEqual({
      rankingAvailable: true,
      weaknesses: ["working_memory"],
      targetedDomains: steps.filter((s) => s.block === "targeted").map((s) => s.domain),
      betExercises: steps.filter((s) => s.block === "bet").map((s) => s.exercise),
      replacedBetExercises: ["stroop"],
    });
  });

  it("says when there is no ranking yet", () => {
    expect(planBetSession(30, FIRST).explanation).toMatchObject({ rankingAvailable: false, weaknesses: [] });
  });
});

describe("session measures", () => {
  it("computes the completed load as perceived effort times duration", () => {
    expect(sessionLoad(7, 45)).toBe(315);
  });

  it("compares the closing fatigue check with the opening one", () => {
    const open = { meanRtMs: 280, lapses: 1 } as RtResults;
    const close = { meanRtMs: 310, lapses: 4 } as RtResults;
    expect(fatigueCheckChange(open, close)).toEqual({ meanRtChangeMs: 30, lapsesChange: 3 });
    expect(fatigueCheckChange(null, close)).toBeNull();
  });
});
