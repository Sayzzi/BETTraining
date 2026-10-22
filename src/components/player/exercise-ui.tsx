"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { FREE_PRACTICE_DURATIONS_MIN } from "@/engine/exercises";

const PRIMARY = "h-12 rounded-md bg-ardoise px-6 font-semibold text-brume hover:bg-ardoise/90 disabled:cursor-wait disabled:opacity-70";
const SIGNAL = "h-12 rounded-md bg-chrono px-6 font-semibold text-ardoise";

/** Setup screen shared by every exercise: what it trains, how to answer, how long. */
export function ExerciseIntro({
  title,
  domain,
  instructions,
  starting,
  onStart,
  fixed,
}: {
  title: string;
  domain: string;
  instructions: ReactNode;
  starting: boolean;
  onStart: (durationMin: number) => void;
  /** Protocol step: shows its place and fixed duration instead of the duration picker. */
  fixed?: { label: string; durationMs: number };
}) {
  const t = useTranslations("player");
  const [durationMin, setDurationMin] = useState<number>(FREE_PRACTICE_DURATIONS_MIN[0]);
  return (
    <section className="max-w-[60ch]">
      {fixed ? <p className="mb-3 text-sm font-semibold text-schiste">{fixed.label}</p> : null}
      <h1 className="type-wide text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 text-lg text-schiste">{domain}</p>
      <div className="mt-8 space-y-4 text-lg">{instructions}</div>
      {fixed ? (
        <>
          <p className="mt-8 font-semibold">{t("fixedDuration", { seconds: Math.round(fixed.durationMs / 1000) })}</p>
          <button type="button" onClick={() => onStart(0)} disabled={starting} className={`mt-8 ${PRIMARY}`}>
            {starting ? t("starting") : t("startTest")}
          </button>
        </>
      ) : (
        <FreePracticeStart durationMin={durationMin} onDurationChange={setDurationMin} starting={starting} onStart={onStart} />
      )}
    </section>
  );
}

function FreePracticeStart({
  durationMin,
  onDurationChange: setDurationMin,
  starting,
  onStart,
}: {
  durationMin: number;
  onDurationChange: (minutes: number) => void;
  starting: boolean;
  onStart: (durationMin: number) => void;
}) {
  const t = useTranslations("player");
  return (
    <>
      <fieldset className="mt-8">
        <legend className="text-sm font-semibold">{t("durationLabel")}</legend>
        <div className="mt-3 flex gap-2">
          {FREE_PRACTICE_DURATIONS_MIN.map((minutes) => (
            <label
              key={minutes}
              className="cursor-pointer rounded-md border border-trait px-4 py-2.5 font-semibold has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono"
            >
              <input
                type="radio"
                name="duration"
                value={minutes}
                checked={durationMin === minutes}
                onChange={() => setDurationMin(minutes)}
                className="sr-only"
              />
              {t("minutes", { minutes })}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-6 text-sm text-schiste">{t("practiceNote")}</p>
      <button type="button" onClick={() => onStart(durationMin)} disabled={starting} className={`mt-8 ${PRIMARY}`}>
        {starting ? t("starting") : t("start")}
      </button>
    </>
  );
}

/** The dark exercise surface with its top bar; the body changes with the run state. */
export function ExerciseStage({
  label,
  showPause,
  paused,
  onTogglePause,
  onPointerDown,
  children,
  footer,
}: {
  label: string;
  showPause: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTranslations("player");
  return (
    <section
      onPointerDown={onPointerDown}
      className="relative flex min-h-[70dvh] touch-none flex-col rounded-lg bg-ardoise text-brume select-none"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm text-trait">{label}</p>
        {showPause ? (
          <button type="button" onClick={onTogglePause} className="text-sm font-semibold underline underline-offset-4">
            {paused ? t("resume") : t("pause")}
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-center px-5 pb-10">{children}</div>
      {footer}
    </section>
  );
}

export function PausedPanel({ onResume, onStop }: { onResume: () => void; onStop: () => void }) {
  const t = useTranslations("player");
  return (
    <div className="text-center">
      <p className="type-wide text-3xl font-extrabold">{t("pausedTitle")}</p>
      <p className="mt-3 max-w-[40ch] text-trait">{t("pausedBody")}</p>
      <div className="mt-8 flex justify-center gap-6">
        <button type="button" onClick={onResume} className={SIGNAL}>
          {t("resume")}
        </button>
        <button type="button" onClick={onStop} className="font-semibold underline underline-offset-4">
          {t("stop")}
        </button>
      </div>
    </div>
  );
}

export function PracticeDonePanel({ body, onBegin }: { body: string; onBegin: () => void }) {
  const t = useTranslations("player");
  return (
    <div className="max-w-[40ch] text-center">
      <p className="type-wide text-3xl font-extrabold">{t("practiceDoneTitle")}</p>
      <p className="mt-3 text-trait">{body}</p>
      <button type="button" onClick={onBegin} className={`mt-8 ${SIGNAL}`}>
        {t("beginMain")}
      </button>
    </div>
  );
}

export function SavingPanel() {
  const t = useTranslations("player");
  return (
    <p className="text-lg text-trait" role="status">
      {t("saving")}
    </p>
  );
}

export function ErrorPanel({ onBack }: { onBack: () => void }) {
  const t = useTranslations("player");
  return (
    <section role="alert" className="max-w-[60ch]">
      <h1 className="type-wide text-3xl font-extrabold">{t("errorTitle")}</h1>
      <p className="mt-4 text-lg text-schiste">{t("errorBody")}</p>
      <button type="button" onClick={onBack} className={`mt-8 ${PRIMARY}`}>
        {t("backToList")}
      </button>
    </section>
  );
}
