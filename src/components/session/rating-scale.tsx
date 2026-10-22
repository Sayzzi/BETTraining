"use client";

const VALUES = Array.from({ length: 11 }, (_, value) => value);

/** A 0-10 self-rating as one row of radio buttons, with its two anchors. */
export function RatingScale({
  name,
  label,
  low,
  high,
  value,
  onChange,
}: {
  name: string;
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="font-semibold">{label}</legend>
      <div className="mt-3 grid grid-cols-11 gap-1">
        {VALUES.map((option) => (
          <label
            key={option}
            className="flex h-11 cursor-pointer items-center justify-center rounded-md border border-trait text-sm font-semibold tabular-nums has-checked:border-ardoise has-checked:bg-ardoise has-checked:text-brume has-focus-visible:outline-3 has-focus-visible:outline-chrono"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-sm text-schiste">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
