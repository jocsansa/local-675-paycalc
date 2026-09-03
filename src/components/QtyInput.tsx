import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Quantity entry sized for gloves on a jobsite: big +/- targets and a numeric
 * keypad on mobile.
 */
export function QtyInput({
  value,
  onChange,
  step = 1,
  min = 0,
  label,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  label?: string;
  className?: string;
}) {
  // Everything that leaves this control is clamped to `min` and finite. A typed
  // "-5" or a value the browser cannot parse would otherwise flow straight into
  // the rate engine and produce a negative or NaN subtotal.
  const clamp = (n: number) => (Number.isFinite(n) ? Math.max(min, round4(n)) : min);
  const bump = (delta: number) => onChange(clamp(value + delta));

  return (
    <div className={className}>
      {label ? <div className="mb-1 text-xs text-muted-foreground">{label}</div> : null}
      <div className="flex items-stretch gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-12 shrink-0"
          aria-label="Decrease"
          onClick={() => bump(-step)}
        >
          <Minus className="size-5" />
        </Button>
        <Input
          className="numeric h-12 min-w-0 flex-1 text-center text-lg"
          type="number"
          inputMode="decimal"
          min={min}
          value={Number.isFinite(value) ? value : min}
          onChange={(e) => onChange(e.target.value === "" ? min : clamp(Number(e.target.value)))}
          onFocus={(e) => e.target.select()}
        />
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-12 shrink-0"
          aria-label="Increase"
          onClick={() => bump(step)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
