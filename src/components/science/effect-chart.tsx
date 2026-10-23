import { getTranslations } from "next-intl/server";
import { EFFECT_GROUPS, EFFECTS, LARGE_EFFECT, type Effect } from "@/content/science";

// Effect-size axis: just below zero to past the widest interval.
const MIN = -0.25;
const MAX = 1.6;
const TICKS = [0, 0.5, 1, 1.5];

const number = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tick = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function x(value: number) {
  return `${((value - MIN) / (MAX - MIN)) * 100}%`;
}

function sourceLabel(effect: Effect) {
  const year = effect.source.slice(-4);
  const name = effect.source.slice(0, -4);
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`;
}

/** Forest plot of the pooled BET effects, one row per meta-analysis. */
export async function EffectChart() {
  const t = await getTranslations("science.chart");
  return (
    <figure>
      <div aria-hidden="true" className="flex flex-col gap-8">
        {EFFECT_GROUPS.map((group) => (
          <div key={group}>
            <p className="text-sm font-semibold">{t(`groups.${group}`)}</p>
            <div className="mt-2">
              {EFFECTS.filter((e) => e.group === group).map((effect) => (
                <div
                  key={effect.source}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] items-center gap-3 md:grid-cols-[7rem_minmax(0,1fr)_3.5rem]"
                >
                  <span className="text-sm text-schiste">{sourceLabel(effect)}</span>
                  <Track>
                    {effect.ci ? (
                      <span
                        className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ardoise"
                        style={{ left: x(effect.ci[0]), right: `calc(100% - ${x(effect.ci[1])})` }}
                      />
                    ) : null}
                    <span
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 bg-ardoise ring-2 ring-brume"
                      style={{ left: x(effect.value) }}
                    />
                  </Track>
                  <span className="type-wide text-right text-base font-bold tabular-nums">
                    {number.format(effect.value)}
                  </span>
                </div>
              ))}
            </div>
            {group === "fresh" ? (
              <p className="mt-2 max-w-[60ch] text-sm text-schiste">{t("freshNote")}</p>
            ) : null}
          </div>
        ))}
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] gap-3 md:grid-cols-[7rem_minmax(0,1fr)_3.5rem]">
          <span />
          <div className="relative h-10 border-t border-schiste text-xs text-schiste">
            {TICKS.map((value) => (
              <span
                key={value}
                className="absolute top-1 -translate-x-1/2 tabular-nums"
                style={{ left: x(value) }}
              >
                {tick.format(value)}
              </span>
            ))}
            <span className="absolute top-5 -translate-x-1/2 whitespace-nowrap" style={{ left: x(0) }}>
              {t("noEffect")}
            </span>
            <span className="absolute top-5 whitespace-nowrap" style={{ left: x(LARGE_EFFECT) }}>
              {t("large")}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-6 max-w-[60ch] text-sm text-schiste">{t("reading")}</figcaption>
      <table className="sr-only">
        <caption>{t("title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("source")}</th>
            <th scope="col">{t("value")}</th>
            <th scope="col">{t("interval")}</th>
          </tr>
        </thead>
        {EFFECT_GROUPS.map((group) => (
          <tbody key={group}>
            <tr>
              <th scope="rowgroup" colSpan={3}>
                {t(`groups.${group}`)}
              </th>
            </tr>
            {EFFECTS.filter((e) => e.group === group).map((effect) => (
              <tr key={effect.source}>
                <th scope="row">{sourceLabel(effect)}</th>
                <td>{number.format(effect.value)}</td>
                <td>
                  {effect.ci
                    ? t("range", { low: number.format(effect.ci[0]), high: number.format(effect.ci[1]) })
                    : t("notReported")}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </figure>
  );
}

/** One row's plotting area: the large-effect zone, then the zero line. */
function Track({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-9">
      <span
        className="absolute inset-y-0 right-0 bg-trait/50"
        style={{ left: x(LARGE_EFFECT) }}
      />
      <span className="absolute inset-y-0 w-px bg-schiste" style={{ left: x(0) }} />
      {children}
    </div>
  );
}
