// Shared trial vocabulary for reaction-time exercises.

export type InputMode = "keyboard" | "touch" | "mouse";

/** hit: correct response; error: wrong choice; lapse: correct but too slow (PVT); miss: no response. */
export type TrialOutcome = "hit" | "error" | "lapse" | "miss" | "false_start";

export type TrialResponse = { input: InputMode; choice?: string };

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
  /** Difficulty parameters in force for this trial, or null for exercises without difficulty. */
  difficulty: Record<string, unknown> | null;
};

export type Pause = { atMs: number; durationMs: number };
