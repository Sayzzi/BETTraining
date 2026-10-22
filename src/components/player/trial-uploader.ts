// Sends trials to the server in batches without ever losing one: pending trials
// are mirrored in storage, failed batches are retried, and leftovers from a
// closed tab are resent on the next visit. The server ignores duplicates.

import type { Trial } from "@/engine/trial";

const STORAGE_PREFIX = "bet:pending-trials:";
const BATCH_SIZE = 5;
const MAX_RETRY_DELAY_MS = 30_000;

export type UploaderDeps = {
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length"> | null;
  setTimeout: (callback: () => void, ms: number) => unknown;
};

function browserDeps(): UploaderDeps {
  let storage: UploaderDeps["storage"] = null;
  try {
    storage = window.localStorage;
  } catch {
    // Storage can be unavailable (private mode); uploads still work, only recovery is lost.
  }
  return { fetch: window.fetch.bind(window), storage, setTimeout: (cb, ms) => window.setTimeout(cb, ms) };
}

function trialsUrl(runId: string) {
  return `/api/training/runs/${runId}/trials`;
}

async function post(deps: UploaderDeps, runId: string, trials: Trial[], keepalive = false) {
  const response = await deps.fetch(trialsUrl(runId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trials }),
    keepalive,
  });
  // 4xx other than 408/429 will never succeed on retry; drop the batch rather than loop forever.
  if (response.ok || (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status))) {
    return true;
  }
  throw new Error(`Upload failed with status ${response.status}`);
}

export class TrialUploader {
  private pending: Trial[] = [];
  private inFlight: Promise<void> | null = null;
  private retryDelayMs = 1_000;
  private retryScheduled = false;

  constructor(
    private readonly runId: string,
    private readonly deps: UploaderDeps = browserDeps(),
  ) {}

  add(trial: Trial) {
    this.pending.push(trial);
    this.persist();
    if (this.pending.length >= BATCH_SIZE) void this.flush();
  }

  /** Sends everything pending. Resolves true once the queue is empty. */
  async flush(): Promise<boolean> {
    while (this.inFlight) await this.inFlight;
    if (this.pending.length === 0) return true;

    const batch = this.pending.slice();
    this.inFlight = post(this.deps, this.runId, batch)
      .then(() => {
        this.pending = this.pending.slice(batch.length);
        this.retryDelayMs = 1_000;
        this.persist();
      })
      .catch(() => this.scheduleRetry())
      .finally(() => {
        this.inFlight = null;
      });
    await this.inFlight;
    return this.pending.length === 0;
  }

  /** Last-chance send when the page is being closed; storage keeps a copy regardless. */
  flushOnExit() {
    if (this.pending.length === 0) return;
    void post(this.deps, this.runId, this.pending, true).catch(() => {});
  }

  get pendingCount() {
    return this.pending.length;
  }

  private scheduleRetry() {
    if (this.retryScheduled) return;
    this.retryScheduled = true;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
    this.deps.setTimeout(() => {
      this.retryScheduled = false;
      void this.flush();
    }, delay);
  }

  private persist() {
    const key = STORAGE_PREFIX + this.runId;
    try {
      if (this.pending.length === 0) this.deps.storage?.removeItem(key);
      else this.deps.storage?.setItem(key, JSON.stringify(this.pending));
    } catch {
      // Quota or privacy errors: in-memory queue still holds the trials.
    }
  }
}

/** Resends trials left in storage by a tab that closed before uploading them. */
export async function resendLeftoverTrials(deps: UploaderDeps = browserDeps()) {
  const storage = deps.storage;
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  await Promise.all(
    keys.map(async (key) => {
      try {
        const trials = JSON.parse(storage.getItem(key) ?? "[]") as Trial[];
        if (await post(deps, key.slice(STORAGE_PREFIX.length), trials)) storage.removeItem(key);
      } catch {
        // Still offline: keep them for the next visit.
      }
    }),
  );
}
