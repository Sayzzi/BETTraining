"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BET_DURATIONS_MIN } from "@/engine/session-plan";
import type { UserPreferences } from "@/server/preferences";

const CHOICE =
  "cursor-pointer rounded-md border border-trait px-4 py-2.5 font-semibold tabular-nums has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono";

function Choices<T extends number>({
  name,
  legend,
  hint,
  options,
  value,
  format,
  onChange,
}: {
  name: string;
  legend: string;
  hint: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      <p className="mt-1 text-sm text-schiste">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className={CHOICE}>
            <input
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {format(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreferencesForm({ initial }: { initial: UserPreferences }) {
  const t = useTranslations("preferences");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const goals = [3, 4, 5, 6, 7].filter((goal) => goal >= values.betSessionsPerWeek);

  async function save() {
    setStatus("saving");
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The browser's time zone decides where each calendar day starts.
        body: JSON.stringify({ ...values, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (!response.ok) throw new Error(`Save failed with status ${response.status}`);
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-[62ch] space-y-10">
      <Choices
        name="bet"
        legend={t("betLabel")}
        hint={t("betHint")}
        options={[3, 4, 5] as const}
        value={values.betSessionsPerWeek}
        format={(n) => String(n)}
        onChange={(betSessionsPerWeek) =>
          setValues({ ...values, betSessionsPerWeek, weeklyGoal: Math.max(values.weeklyGoal, betSessionsPerWeek) })
        }
      />
      <Choices
        name="goal"
        legend={t("goalLabel")}
        hint={t("goalHint", { light: values.weeklyGoal - values.betSessionsPerWeek })}
        options={goals}
        value={values.weeklyGoal}
        format={(n) => String(n)}
        onChange={(weeklyGoal) => setValues({ ...values, weeklyGoal })}
      />
      <Choices
        name="duration"
        legend={t("durationLabel")}
        hint={t("durationHint")}
        options={BET_DURATIONS_MIN}
        value={values.defaultDurationMin}
        format={(n) => t("minutes", { minutes: n })}
        onChange={(defaultDurationMin) => setValues({ ...values, defaultDurationMin })}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="h-12 rounded-md bg-ardoise px-6 font-semibold text-brume hover:bg-ardoise/90 disabled:opacity-70"
        >
          {status === "saving" ? t("saving") : t("save")}
        </button>
        <p role="status" className={status === "error" ? "font-semibold text-alerte" : "text-schiste"}>
          {status === "saved" ? t("saved") : status === "error" ? t("error") : ""}
        </p>
      </div>
    </div>
  );
}
