"use client";

import { useEffect, useRef } from "react";

const FOREPERIOD_MS = 1400;

// Replays a PVT stimulus once: a pause, then a live millisecond count that
// stops at the reaction time. Writes to the DOM directly to avoid a render per frame.
export function ChronoCounter({ reactionMs }: { reactionMs: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    node.textContent = "000";
    const timeout = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(Math.round(now - start), reactionMs);
        node.textContent = String(elapsed).padStart(3, "0");
        if (elapsed < reactionMs) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, FOREPERIOD_MS);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [reactionMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {String(reactionMs).padStart(3, "0")}
    </span>
  );
}
