// Shared trial vocabulary for reaction-time exercises.

export type InputMode = "keyboard" | "touch" | "mouse";

export type TrialOutcome = "hit" | "lapse" | "miss" | "false_start";

export type TrialResponse = { input: InputMode };

export type Trial = {
  /** Position in the exercise run, practice trials included. */
  index: number;
  practice: boolean;
  /** Times are active milliseconds (pauses excluded) since the start of the trial's phase. */
  onsetMs: number | null;
  responseMs: number | null;
  rtMs: number | null;
  outcome: TrialOutcome;
  correct: boolean;
  stimulus: Record<string, unknown> | null;
  response: TrialResponse | null;
};

export type Pause = { atMs: number; durationMs: number };
