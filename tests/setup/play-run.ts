// Plays a run with its real engine, as a perfect (or deliberately sloppy) user would.
// Shared by integration tests that need realistic trials.

import * as choice from "../../src/engine/choice-task";
import { CHOICE_RT_SPEC } from "../../src/engine/choice-rt";
import type { ExerciseConfig, ExerciseId } from "../../src/engine/exercises";
import { FLANKER_SPEC } from "../../src/engine/flanker";
import * as nback from "../../src/engine/nback";
import * as pvt from "../../src/engine/pvt";
import { STROOP_SPEC } from "../../src/engine/stroop";
import { symbolDigitKey, symbolDigitSpec } from "../../src/engine/symbol-digit";
import type { Trial } from "../../src/engine/trial";

type Playable = { exercise: ExerciseId; config: ExerciseConfig; seed: number; level: number | null };

/**
 * Answers every stimulus after `reaction` ms (a number, or a function of the answer's index for
 * varied reaction times); `correct` decides whether each answer is right.
 */
export function playRun(
  run: Playable,
  reaction: number | ((index: number) => number),
  correct: (index: number) => boolean = () => true,
): Trial[] {
  let at = 0;
  let answered = 0;
  let timed = 0;
  const nextRt = () => (typeof reaction === "number" ? reaction : reaction(timed++));

  if (run.exercise === "pvt" || run.exercise === "pvt_b") {
    let state = pvt.startPvt(run.config as pvt.PvtConfig, run.seed, 0);
    while (state.phase !== "done") {
      at += 10;
      state = state.phase === "practice_done" ? pvt.beginMain(state, at) : pvt.frame(state, at);
      if (state.stimulusOnsetMs !== null) state = pvt.respond(state, at + nextRt(), { input: "keyboard" });
    }
    return state.trials;
  }

  if (run.exercise === "nback") {
    let state = nback.startNBack(run.config as nback.NBackConfig, run.seed, 0, run.level ?? 1);
    while (state.phase !== "done") {
      at += 10;
      state = state.phase === "practice_done" ? nback.beginMain(state, at) : nback.frame(state, at);
      const current = state.current;
      if (current?.scored && !current.answer) {
        const right = current.isTarget ? "match" : "different";
        const choiceMade = correct(answered++) ? right : right === "match" ? "different" : "match";
        state = nback.respond(state, at + nextRt(), { choice: choiceMade, input: "keyboard" });
      }
    }
    return state.trials;
  }

  const spec = (
    {
      stroop: STROOP_SPEC,
      flanker: FLANKER_SPEC,
      choice_rt: CHOICE_RT_SPEC,
      symbol_digit: symbolDigitSpec(symbolDigitKey(run.seed)),
    } as Record<string, choice.ChoiceTaskSpec<unknown>>
  )[run.exercise];
  let state = choice.startChoiceTask(run.config as choice.ChoiceTaskConfig, spec, run.seed, 0, run.level ?? 1);
  while (state.phase !== "done") {
    at += 10;
    state = state.phase === "practice_done" ? choice.beginMain(state, at) : choice.frame(state, at);
    if (state.current) {
      const right = spec.correctChoice(state.current.stimulus);
      state = choice.respond(state, at + nextRt(), correct(answered++) ? right : `not-${right}`, "keyboard");
    }
  }
  return state.trials;
}
