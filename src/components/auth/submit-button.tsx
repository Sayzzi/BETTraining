export function SubmitButton({ pending, label, pendingLabel }: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-md bg-ardoise px-5 text-base font-semibold text-brume transition-colors hover:bg-ardoise/90 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
