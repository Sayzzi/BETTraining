import { describe, expect, it, vi } from "vitest";
import type { Trial } from "@/engine/trial";
import { resendLeftoverTrials, TrialUploader, type UploaderDeps } from "./trial-uploader";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function trial(index: number): Trial {
  return {
    index,
    practice: false,
    onsetMs: index * 3000,
    responseMs: index * 3000 + 250,
    rtMs: 250,
    outcome: "hit",
    correct: true,
    stimulus: { isiMs: 3000 },
    response: { input: "keyboard" },
    difficulty: null,
  };
}

/** A server that can be switched offline and records what it received. */
function fakeServer() {
  const received: Trial[] = [];
  let online = true;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    if (!online) throw new TypeError("network down");
    received.push(...(JSON.parse(init.body as string).trials as Trial[]));
    return new Response(null, { status: 204 });
  });
  return {
    received,
    fetch: fetch as unknown as typeof globalThis.fetch,
    calls: fetch,
    setOnline: (value: boolean) => (online = value),
  };
}

function setup() {
  const server = fakeServer();
  const storage = memoryStorage();
  const timers: (() => void)[] = [];
  const deps: UploaderDeps = { fetch: server.fetch, storage, setTimeout: (cb) => timers.push(cb) };
  return { server, storage, timers, deps };
}

describe("TrialUploader", () => {
  it("sends a batch once five trials are queued", async () => {
    const { server, deps } = setup();
    const uploader = new TrialUploader("run-1", deps);
    for (let i = 0; i < 4; i++) uploader.add(trial(i));
    expect(server.calls).not.toHaveBeenCalled();

    uploader.add(trial(4));
    await uploader.flush();

    expect(server.received.map((t) => t.index)).toEqual([0, 1, 2, 3, 4]);
    expect(uploader.pendingCount).toBe(0);
  });

  it("keeps trials during a network outage and delivers them all once back online", async () => {
    const { server, deps, timers } = setup();
    const uploader = new TrialUploader("run-1", deps);
    server.setOnline(false);
    for (let i = 0; i < 7; i++) uploader.add(trial(i));
    expect(await uploader.flush()).toBe(false);
    expect(uploader.pendingCount).toBe(7);

    server.setOnline(true);
    timers.shift()!();
    expect(await uploader.flush()).toBe(true);

    expect(new Set(server.received.map((t) => t.index))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
  });

  it("mirrors pending trials in storage and clears them once delivered", async () => {
    const { server, storage, deps } = setup();
    const uploader = new TrialUploader("run-1", deps);
    server.setOnline(false);
    uploader.add(trial(0));
    expect(JSON.parse(storage.map.get("bet:pending-trials:run-1")!)).toHaveLength(1);

    server.setOnline(true);
    await uploader.flush();
    expect(storage.map.has("bet:pending-trials:run-1")).toBe(false);
  });

  it("resends trials left in storage by a previous visit", async () => {
    const { server, storage, deps } = setup();
    storage.setItem("bet:pending-trials:run-9", JSON.stringify([trial(3), trial(4)]));
    storage.setItem("unrelated", "x");

    await resendLeftoverTrials(deps);

    expect(server.calls.mock.calls[0][0]).toBe("/api/training/runs/run-9/trials");
    expect(server.received.map((t) => t.index)).toEqual([3, 4]);
    expect(storage.map.has("bet:pending-trials:run-9")).toBe(false);
    expect(storage.map.has("unrelated")).toBe(true);
  });
});
