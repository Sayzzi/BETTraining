"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { detectDevice, detectInputMode } from "@/components/player/device";
import { PRIMARY_BUTTON, ProtocolRunner } from "@/components/protocol/protocol-runner";
import { BET_DURATIONS_MIN, type BetDuration, type PlanExplanation, type SessionBlock } from "@/engine/session-plan";
import type { SessionStepRun, StartedBetSession } from "@/server/bet-session";
import { PlanExplanationText } from "./plan-explanation";
import { RatingScale } from "./rating-scale";

type Context = "rest" | "before_sport" | "after_sport";
type Ratings = { postFatigue: number | null; perceivedEffort: number | null; motivation: number | null };

type State =
  | { kind: "setup"; interrupted: boolean }
  | { kind: "starting" }
  // A BET session first plays its opening fatigue check alone, then the rest after the advice.
  | { kind: "running"; plan: StartedBetSession; part: "opening" | "rest" | "all" }
  | { kind: "advice"; plan: StartedBetSession; lapses: number; sending: boolean }
  | { kind: "rested" }
  | { kind: "ratings"; plan: StartedBetSession; sending: boolean }
  | { kind: "error" };

const CONTEXTS: Context[] = ["after_sport", "before_sport", "rest"];
const BLOCKS: SessionBlock[] = ["fatigue_open", "targeted", "bet", "fatigue_close"];
const CHOICE =
  "cursor-pointer rounded-md border border-trait px-4 py-2.5 font-semibold has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono";

export type SessionMode =
  | { kind: "bet"; previews: Record<BetDuration, PlanExplanation>; defaultDurationMin: BetDuration }
  | { kind: "light"; preview: PlanExplanation };

/** Opening choices and rating, the planned steps, the closing ratings, then the summary. */
export function SessionRunner({ mode }: { mode: SessionMode }) {
  const t = useTranslations("session");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "setup", interrupted: false });
  const [durationMin, setDurationMin] = useState<BetDuration>(mode.kind === "bet" ? mode.defaultDurationMin : 30);
  const [context, setContext] = useState<Context>("after_sport");
  const [keySport, setKeySport] = useState(false);
  const [preFatigue, setPreFatigue] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Ratings>({ postFatigue: null, perceivedEffort: null, motivation: null });

  async function start() {
    setState({ kind: "starting" });
    try {
      const response = await fetch(mode.kind === "bet" ? "/api/bet-session" : "/api/light-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(mode.kind === "bet" ? { durationMin } : {}),
          context,
          preFatigue,
          device: detectDevice(),
          inputMode: detectInputMode(),
          userAgent: navigator.userAgent.slice(0, 512),
        }),
      });
      if (!response.ok) throw new Error(`Start failed with status ${response.status}`);
      setState({ kind: "running", plan: await response.json(), part: mode.kind === "bet" ? "opening" : "all" });
    } catch {
      setState({ kind: "error" });
    }
  }

  /** After the opening check: offer a lighter session or rest when fatigue is already high. */
  async function checkFatigue(plan: StartedBetSession) {
    try {
      const response = await fetch(`/api/bet-session/${plan.sessionId}/fatigue-advice`);
      if (!response.ok) throw new Error(`Advice failed with status ${response.status}`);
      const advice: { advised: boolean; lapses: number } = await response.json();
      setState(
        advice.advised
          ? { kind: "advice", plan, lapses: advice.lapses, sending: false }
          : { kind: "running", plan, part: "rest" },
      );
    } catch {
      setState({ kind: "error" });
    }
  }

  async function answerAdvice(plan: StartedBetSession, lapses: number, choice: "lighten" | "continue" | "rest") {
    setState({ kind: "advice", plan, lapses, sending: true });
    try {
      const response = await fetch(`/api/bet-session/${plan.sessionId}/fatigue-advice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (!response.ok) throw new Error(`Advice choice failed with status ${response.status}`);
      const { steps }: { steps: StartedBetSession["steps"] | null } = await response.json();
      setState(steps ? { kind: "running", plan: { ...plan, steps }, part: "rest" } : { kind: "rested" });
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
        <h1 className="type-wide text-4xl font-extrabold">
          {mode.kind === "light" ? t("lightTitle") : context === "rest" ? t("cognitiveTitle") : t("title")}
        </h1>
        {state.kind === "setup" && state.interrupted ? (
          <p role="status" className="mt-4 font-semibold text-alerte">
            {t("interrupted")}
          </p>
        ) : null}
        {mode.kind === "light" ? (
          <p className="mt-6 text-lg">{t("lightIntro")}</p>
        ) : (
          <>
            <p className="mt-6 text-lg">{t("intro")}</p>
            <ol className="mt-6 space-y-2 border-l-2 border-trait pl-6 text-schiste">
              {BLOCKS.map((block) => (
                <li key={block}>{t(`blocks.${block}.summary`)}</li>
              ))}
            </ol>
          </>
        )}

        {mode.kind === "bet" ? (
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
        ) : null}

        <div className="mt-6 border-l-2 border-chrono pl-5">
          <h2 className="font-semibold">{t("planTitle")}</h2>
          <div className="mt-1 text-schiste">
            <PlanExplanationText explanation={mode.kind === "bet" ? mode.previews[durationMin] : mode.preview} />
          </div>
        </div>

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
          {context === "before_sport" ? (
            <label className="mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={keySport}
                onChange={(event) => setKeySport(event.target.checked)}
                className="size-5 accent-ardoise"
              />
              {t("keySportLabel")}
            </label>
          ) : null}
          {context === "before_sport" && keySport ? (
            <p role="alert" className="mt-3 border-l-2 border-alerte pl-4 font-semibold text-alerte">
              {t("keySportWarning")}
            </p>
          ) : null}
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

  if (state.kind === "rested") {
    return (
      <section role="status" className="max-w-[60ch]">
        <h1 className="type-wide text-3xl font-extrabold">{t("restedTitle")}</h1>
        <p className="mt-4 text-lg text-schiste">{t("restedBody")}</p>
        <button type="button" onClick={() => router.push("/")} className={`mt-8 ${PRIMARY_BUTTON}`}>
          {t("backHome")}
        </button>
      </section>
    );
  }

  if (state.kind === "advice") {
    const { plan, lapses, sending } = state;
    return (
      <section className="max-w-[60ch]">
        <h1 className="type-wide text-3xl font-extrabold">{t("adviceTitle")}</h1>
        <p className="mt-4 text-lg">{t("adviceBody", { lapses })}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            disabled={sending}
            onClick={() => void answerAdvice(plan, lapses, "lighten")}
            className={PRIMARY_BUTTON}
          >
            {t("adviceLighten")}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void answerAdvice(plan, lapses, "rest")}
            className="font-semibold underline underline-offset-4"
          >
            {t("adviceRest")}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void answerAdvice(plan, lapses, "continue")}
            className="font-semibold underline underline-offset-4"
          >
            {t("adviceContinue")}
          </button>
        </div>
      </section>
    );
  }

  const { plan, part } = state;
  const steps =
    part === "opening" ? plan.steps.slice(0, 1) : part === "rest" ? plan.steps.slice(1) : plan.steps;
  return (
    <ProtocolRunner<SessionStepRun>
      key={part}
      steps={steps}
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
      onFinished={() =>
        part === "opening" ? void checkFatigue(plan) : setState({ kind: "ratings", plan, sending: false })
      }
      onStopped={() => setState({ kind: "setup", interrupted: true })}
    />
  );
}
