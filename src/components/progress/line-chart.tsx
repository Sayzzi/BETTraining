/**
 * A small line chart in SVG: the line in slate, the latest point in the signal yellow,
 * an optional dashed reference line. Scales are fixed by the caller so charts compare.
 */
export function LineChart({
  points,
  yMin,
  yMax,
  reference,
  label,
  formatY,
  formatX,
}: {
  points: { x: string; y: number }[];
  yMin: number;
  yMax: number;
  /** Value drawn as a dashed line, such as 100 % resistance. */
  reference?: number;
  label: string;
  formatY: (value: number) => string;
  formatX: (value: string) => string;
}) {
  const width = 320;
  const height = 120;
  const pad = { top: 10, right: 10, bottom: 10, left: 10 };
  const x = (i: number) =>
    points.length === 1 ? width / 2 : pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + (1 - (Math.min(yMax, Math.max(yMin, value)) - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  const last = points.at(-1);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label={label}>
        <line x1={0} x2={width} y1={height - pad.bottom} y2={height - pad.bottom} className="stroke-trait" />
        {reference !== undefined ? (
          <line
            x1={0}
            x2={width}
            y1={y(reference)}
            y2={y(reference)}
            strokeDasharray="4 4"
            className="stroke-schiste"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {points.length > 1 ? (
          <polyline
            points={points.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}
            fill="none"
            strokeWidth={2.5}
            strokeLinejoin="round"
            className="stroke-ardoise"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {last ? (
          <circle cx={x(points.length - 1)} cy={y(last.y)} r={5} className="fill-chrono stroke-ardoise" strokeWidth={2} />
        ) : null}
      </svg>
      {points.length > 0 ? (
        <figcaption className="mt-1 flex justify-between text-xs text-schiste tabular-nums">
          <span>{formatX(points[0].x)}</span>
          {points.length > 1 ? <span>{formatX(last!.x)}</span> : null}
        </figcaption>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.x}>
              <th scope="row">{formatX(p.x)}</th>
              <td>{formatY(p.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
