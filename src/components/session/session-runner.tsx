"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { detectDevice, detectInputMode } from "@/components/player/device";
import { PRIMARY_BUTTON, ProtocolRunner } from "@/components/protocol/protocol-runner";
import { BET_DURATIONS_MIN, type BetDuration, type SessionBlock } from "@/engine/session-plan";
import type { SessionStepRun, StartedBetSession } from "@/server/bet-session";
import { RatingScale } from "./rating-scale";

type Context = "rest" | "before_sport" | "after_sport";
type Ratings = { postFatigue: number | null; perceivedEffort: number | null; motivation: number | null };

type State =
  | { kind: "setup"; interrupted: boolean }
  | { kind: "starting" }
  | { kind: "running"; plan: StartedBetSession }
  | { kind: "ratings"; plan: StartedBetSession; sending: boolean }
  | { kind: "error" };

const CONTEXTS: Context[] = ["after_sport", "before_sport", "rest"];
const BLOCKS: SessionBlock[] = ["fatigue_open", "targeted", "bet", "fatigue_close"];
const CHOICE =
  "cursor-pointer rounded-md border border-trait px-4 py-2.5 font-semibold has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono";

/** Opening choices and rating, the planned steps, the closing ratings, then the summary. */
export function SessionRunner() {
  const t = useTranslations("session");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "setup", interrupted: false });
  const [durationMin, setDurationMin] = useState<BetDuration>(30);
  const [context, setContext] = useState<Context>("after_sport");
  const [preFatigue, setPreFatigue] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Ratings>({ postFatigue: null, perceivedEffort: null, motivation: null });

  async function start() {
    setState({ kind: "starting" });
    try {
      const response = await fetch("/api/bet-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          durationMin,
          context,
          preFatigue,
          device: detectDevice(),
          inputMode: detectInputMode(),
          userAgent: navigator.userAgent.slice(0, 512),
        }),
      });
      if (!response.ok) throw new Error(`Start failed with status ${response.status}`);
      setState({ kind: "running", plan: await response.json() });
    } catch {
      setState({ kind: "error" });
    }
  }

  async function sendRatings(plan: StartedBetSession) {
    setState({ kind: "ratings", plan, sending: true });
    try {
      const response = await fetch(`/api/bet-session/${plan.sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ratings),
      });
      if (!response.ok) throw new Error(`Finish failed with status ${response.status}`);
      router.push(`/seance/resultats/${plan.sessionId}`);
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "setup" || state.kind === "starting") {
    return (
      <section className="max-w-[62ch]">
        <h1 className="type-wide text-4xl font-extrabold">{t("title")}</h1>
        {state.kind === "setup" && state.interrupted ? (
          <p role="status" className="mt-4 font-semibold text-alerte">
            {t("interrupted")}
          </p>
        ) : null}
        <p className="mt-6 text-lg">{t("intro")}</p>
        <ol className="mt-6 space-y-2 border-l-2 border-trait pl-6 text-schiste">
          {BLOCKS.map((block) => (
            <li key={block}>{t(`blocks.${block}.summary`)}</li>
          ))}
        </ol>

        <fieldset className="mt-10">
          <legend className="font-semibold">{t("durationLabel")}</legend>
          <div className="mt-3 flex gap-2">
            {BET_DURATIONS_MIN.map((minutes) => (
              <label key={minutes} className={CHOICE}>
                <input
                  type="radio"
                  name="duration"
                  checked={durationMin === minutes}
                  onChange={() => setDurationMin(minutes)}
                  className="sr-only"
                />
                {t("minutes", { minutes })}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-8">
          <legend className="font-semibold">{t("contextLabel")}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONTEXTS.map((option) => (
              <label key={option} className={CHOICE}>
                <input
                  type="radio"
                  name="context"
                  checked={context === option}
                  onChange={() => setContext(option)}
                  className="sr-only"
                />
                {t(`contexts.${option}`)}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-schiste">{t(`contextHints.${context}`)}</p>
        </fieldset>

        <div className="mt-8">
          <RatingScale
            name="preFatigue"
            label={t("preFatigueLabel")}
            low={t("fatigueLow")}
            high={t("fatigueHigh")}
            value={preFatigue}
            onChange={setPreFatigue}
          />
        </div>

        <button
          type="button"
          onClick={start}
          disabled={state.kind === "starting" || preFatigue === null}
          className={`mt-10 ${PRIMARY_BUTTON}`}
        >
          {state.kind === "starting" ? t("starting") : t("start")}
        </button>
        {preFatigue === null ? <p className="mt-2 text-sm text-schiste">{t("ratingRequired")}</p> : null}
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section role="alert" className="max-w-[60ch]">
        <h1 className="type-wide text-3xl font-extrabold">{t("errorTitle")}</h1>
        <p className="mt-4 text-lg text-schiste">{t("errorBody")}</p>
        <button type="button" onClick={() => setState({ kind: "setup", interrupted: false })} className={`mt-8 ${PRIMARY_BUTTON}`}>
          {t("backToSetup")}
        </button>
      </section>
    );
  }

  if (state.kind === "ratings") {
    const complete = Object.values(ratings).every((value) => value !== null);
    return (
      <section className="max-w-[62ch]">
        <h1 className="type-wide text-4xl font-extrabold">{t("ratingsTitle")}</h1>
        <p className="mt-4 text-lg text-schiste">{t("ratingsIntro")}</p>
        <div className="mt-8 space-y-8">
          <RatingScale
            name="postFatigue"
            label={t("postFatigueLabel")}
            low={t("fatigueLow")}
            high={t("fatigueHigh")}
            value={ratings.postFatigue}
            onChange={(value) => setRatings({ ...ratings, postFatigue: value })}
          />
          <RatingScale
            name="perceivedEffort"
            label={t("effortLabel")}
            low={t("effortLow")}
            high={t("effortHigh")}
            value={ratings.perceivedEffort}
            onChange={(value) => setRatings({ ...ratings, perceivedEffort: value })}
          />
          <RatingScale
            name="motivation"
            label={t("motivationLabel")}
            low={t("motivationLow")}
            high={t("motivationHigh")}
            value={ratings.motivation}
            onChange={(value) => setRatings({ ...ratings, motivation: value })}
          />
        </div>
        <button
          type="button"
          onClick={() => void sendRatings(state.plan)}
          disabled={!complete || state.sending}
          className={`mt-10 ${PRIMARY_BUTTON}`}
        >
          {state.sending ? t("sending") : t("seeSummary")}
        </button>
      </section>
    );
  }

  const { plan } = state;
  return (
    <ProtocolRunner<SessionStepRun>
      steps={plan.steps}
      briefing={(step) => ({
        eyebrow: t("blockOf", { block: BLOCKS.indexOf(step.block as SessionBlock) + 1 }),
        title: t(`blocks.${step.block as SessionBlock}.title`),
        body: t(`blocks.${step.block as SessionBlock}.briefing`),
        action: t("continue"),
      })}
      stepLabel={(step) => {
        const inBlock = plan.steps.filter((s) => s.block === step.block);
        return t("stepLabel", {
          block: t(`blocks.${step.block as SessionBlock}.title`),
          index: inBlock.indexOf(step) + 1,
          total: inBlock.length,
        });
      }}
      onFinished={() => setState({ kind: "ratings", plan, sending: false })}
      onStopped={() => setState({ kind: "setup", interrupted: true })}
    />
  );
}
