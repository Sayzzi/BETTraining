import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, ...input }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className="h-12 rounded-md border border-trait bg-white px-3 text-base text-ardoise outline-none focus-visible:border-ardoise"
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-schiste">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
