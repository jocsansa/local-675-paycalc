export function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd
        className={`numeric text-lg font-semibold ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}
