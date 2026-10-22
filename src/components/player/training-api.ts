import type { FreePracticeExercise } from "@/engine/exercises";
import type { StartedRun } from "@/server/training";
import type { Trial, Pause } from "@/engine/trial";

export async function startFreePracticeRequest(body: {
  exercise: FreePracticeExercise;
  durationMin: number;
  device: string;
  inputMode: string;
  userAgent: string;
}): Promise<StartedRun> {
  const response = await fetch("/api/training/free-practice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Start failed with status ${response.status}`);
  return response.json();
}

/** Completes the run, resending every trial once if the server reports gaps. */
export async function completeRunRequest(runId: string, trials: Trial[], pauses: Pause[]) {
  const complete = () =>
    fetch(`/api/training/runs/${runId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pauses, trialCount: trials.length }),
    });

  let response = await complete();
  if (response.status === 409) {
    await fetch(`/api/training/runs/${runId}/trials`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trials }),
    });
    response = await complete();
  }
  if (!response.ok) throw new Error(`Completion failed with status ${response.status}`);
}

export function abandonSessionRequest(sessionId: string, beacon = false) {
  const url = `/api/training/sessions/${sessionId}/abandon`;
  if (beacon && navigator.sendBeacon) navigator.sendBeacon(url);
  else void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
}
