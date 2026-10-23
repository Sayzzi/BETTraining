import type { MinuteResult } from "@/engine/results";

type Labels = { minute: string; lapses: string; change: string; reference: string };

/**
 * Mean reaction time per minute as bars from zero, with the gap from the first minute
 * spelled out (bars alone hide a 50 ms drift) and lapses flagged: shows when attention drifts.
 */
export function MinuteChart({ minutes, labels }: { minutes: MinuteResult[]; labels: Labels }) {
  const max = Math.max(...minutes.map((m) => m.meanRtMs ?? 0), 1);
  const first = minutes.find((m) => m.meanRtMs !== null)?.meanRtMs ?? null;
  return (
    <table className="mt-6 w-full border-collapse">
      <caption className="sr-only">{labels.minute}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{labels.minute}</th>
          <th scope="col">ms</th>
          <th scope="col">{labels.change}</th>
          <th scope="col">{labels.lapses}</th>
        </tr>
      </thead>
      <tbody>
        {minutes.map((m) => (
          <tr key={m.minute} className="border-b border-trait last:border-b-0">
            <th scope="row" className="w-16 py-2 pr-3 text-left text-sm font-semibold tabular-nums">
              {m.minute + 1}
            </th>
            <td className="py-2">
              <div className="flex items-center gap-3">
                {/* The track takes the free width, so the bar's percentage is measured against it. */}
                <div className="flex-1">
                  <div
                    className="h-4 rounded-sm bg-ardoise"
                    style={{ width: `${((m.meanRtMs ?? 0) / max) * 100}%`, minWidth: m.meanRtMs ? 4 : 0 }}
                  />
                </div>
                <span className="w-16 shrink-0 text-sm whitespace-nowrap tabular-nums">
                  {m.meanRtMs === null ? "—" : `${Math.round(m.meanRtMs)} ms`}
                </span>
              </div>
            </td>
            <td className="w-20 py-2 text-right text-sm whitespace-nowrap text-schiste tabular-nums">
              {m.meanRtMs === null || first === null
                ? ""
                : m.meanRtMs === first
                  ? labels.reference
                  : `${m.meanRtMs > first ? "+" : "−"}${Math.abs(Math.round(m.meanRtMs - first))} ms`}
            </td>
            <td className="w-24 py-2 text-right text-sm whitespace-nowrap tabular-nums">
              {m.lapses > 0 ? (
                <span className="rounded-sm bg-chrono px-1.5 py-0.5 font-semibold text-ardoise">
                  {m.lapses} {labels.lapses}
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
