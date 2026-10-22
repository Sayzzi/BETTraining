import type { InputMode } from "@/engine/trial";

export type Device = "desktop" | "tablet" | "mobile";

function hasCoarsePointer() {
  return window.matchMedia("(pointer: coarse)").matches;
}

export function detectDevice(): Device {
  if (!hasCoarsePointer()) return "desktop";
  return Math.min(window.screen.width, window.screen.height) < 600 ? "mobile" : "tablet";
}

/** Expected input at start; each trial still records the input actually used. */
export function detectInputMode(): InputMode {
  return hasCoarsePointer() ? "touch" : "keyboard";
}

export function pointerInput(pointerType: string): InputMode {
  return pointerType === "mouse" ? "mouse" : "touch";
}
