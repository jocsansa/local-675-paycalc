import { HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  heightLabel,
  MATERIALS,
  labelFor,
  money,
  RATE_NOT_CONFIGURED,
  type CalcLine,
} from "@/lib/rate-engine";

/**
 * "Why?" — every calculated line can show the exact rate row it came from,
 * including the table version and effective date, so a number can always be
 * traced back to the agreement.
 */
export function WhyPopover({ line }: { line: CalcLine }) {
  const s = line.source;
  return (
    <Popover>
      <PopoverTrigger
        className="no-print inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-secondary"
        aria-label="Why this amount?"
      >
        <HelpCircle className="size-3.5" />
        Why?
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="font-display text-sm font-semibold tracking-wide">{line.label}</p>
        <p className="mt-0.5 mb-3 font-mono text-xs text-muted-foreground">{line.formula}</p>
        <dl className="space-y-1.5 text-xs">
          <Row label="Agreement" value={s.agreement ?? "—"} />
          <Row label="Rate table" value={s.rate_table_version} />
          <Row label="Effective date" value={s.effective_date} />
          <Row label="Category" value={s.category} />
          <Row label="Item" value={`${s.item_name} (${s.item_code})`} />
          {s.material ? <Row label="Material" value={labelFor(MATERIALS, s.material)} /> : null}
          {s.thickness ? <Row label="Thickness" value={s.thickness} /> : null}
          {s.height_category ? <Row label="Height" value={heightLabel(s.height_category)} /> : null}
          <Row label="Unit" value={s.unit} />
          <Row label="Calculation" value={s.calculation_type} />
          <Row
            label="Rate"
            value={s.rate === null ? RATE_NOT_CONFIGURED : `$${s.rate.toFixed(4)}`}
            emphasis
          />
          <Row label="Subtotal" value={money(line.subtotal)} emphasis />
        </dl>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={emphasis ? "numeric font-semibold text-foreground" : "text-right"}>{value}</dd>
    </div>
  );
}
