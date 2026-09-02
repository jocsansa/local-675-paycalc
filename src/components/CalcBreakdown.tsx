import { AlertTriangle } from "lucide-react";

import { WhyPopover } from "@/components/WhyPopover";
import { Badge } from "@/components/ui/badge";
import {
  money,
  RATE_NOT_CONFIGURED,
  type CalculationResult,
  type CalcLine,
} from "@/lib/rate-engine";

const SECTIONS = [
  { key: "boarding", title: "Boarding" },
  { key: "extras", title: "Extras" },
  { key: "premiums", title: "Premiums" },
] as const;

export function CalcBreakdown({ result }: { result: CalculationResult }) {
  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const lines = result.lines.filter((l) => l.section === section.key);
        if (!lines.length) return null;
        const total =
          section.key === "boarding"
            ? result.base_total
            : section.key === "extras"
              ? result.extras_total
              : result.premiums_total;
        return (
          <section key={section.key}>
            <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1.5">
              <h3 className="font-display text-sm font-semibold tracking-widest uppercase">
                {section.title}
              </h3>
              <span className="numeric text-sm font-semibold">{money(total)}</span>
            </div>
            <ul className="divide-y divide-border/60">
              {lines.map((line, i) => (
                <LineRow key={`${section.key}-${i}`} line={line} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LineRow({ line }: { line: CalcLine }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{line.label}</span>
          {line.missing ? (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="size-3" />
              {RATE_NOT_CONFIGURED}
            </Badge>
          ) : (
            <WhyPopover line={line} />
          )}
        </div>
        {line.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p> : null}
        <p className="numeric mt-0.5 text-xs text-muted-foreground">{line.formula}</p>
      </div>
      <div className="text-right">
        <div className="numeric text-sm font-semibold">{money(line.subtotal)}</div>
        <div className="numeric text-[11px] text-muted-foreground">
          {line.quantity} {line.unit}
        </div>
      </div>
    </li>
  );
}
