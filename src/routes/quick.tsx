import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { CalcBreakdown } from "@/components/CalcBreakdown";
import { QtyInput } from "@/components/QtyInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRateBundle, useRateTables } from "@/lib/queries";
import { selectValue } from "@/lib/utils";
import {
  ANY_VALUE,
  boardingDimensions,
  calculateJobTotal,
  heightLabel,
  money,
  PROJECT_TYPES,
  selectRateTableForDate,
  type EngineContext,
  type ExtraInput,
} from "@/lib/rate-engine";

export const Route = createFileRoute("/quick")({
  component: QuickPage,
});

function QuickPage() {
  return (
    <AppLayout>
      <QuickCalculator />
    </AppLayout>
  );
}

function QuickCalculator() {
  const rateTables = useRateTables();
  const today = new Date().toISOString().slice(0, 10);
  const table = useMemo(
    () => selectRateTableForDate(rateTables.data ?? [], today),
    [rateTables.data, today],
  );
  const bundle = useRateBundle(table?.id ?? null);

  const [projectType, setProjectType] = useState("low_rise");
  const [material, setMaterial] = useState("");
  const [thickness, setThickness] = useState("");
  const [height, setHeight] = useState("");
  const [sheets, setSheets] = useState(0);
  const [sqft, setSqft] = useState(0);
  const [extras, setExtras] = useState<Record<string, number>>({});

  const ctx: EngineContext = useMemo(
    () => ({
      rateTable: bundle.data?.table ?? null,
      items: bundle.data?.items ?? [],
      tiers: bundle.data?.tiers ?? [],
    }),
    [bundle.data],
  );

  // Same rule as the job builder: offer only the dimensions this rate table
  // actually prices boarding on.
  const boardingOptions = useMemo(
    () => boardingDimensions(ctx.items, projectType),
    [ctx.items, projectType],
  );

  // Keep the selections valid when the project type or rate table changes.
  // Material and thickness default to blank so the height band drives the rate.
  useEffect(() => {
    setHeight((h) =>
      boardingOptions.heights.includes(h) ? h : (boardingOptions.heights[0] ?? ""),
    );
    setMaterial((m) => (boardingOptions.materials.some((o) => o.value === m) ? m : ""));
    setThickness((t) => (boardingOptions.thicknesses.some((o) => o.value === t) ? t : ""));
  }, [boardingOptions]);

  const quickExtras = ctx.items
    .filter((i) => i.category === "extra" && i.project_type === projectType && i.active !== false)
    .slice(0, 6);

  const result = useMemo(() => {
    const extraInputs: ExtraInput[] = Object.entries(extras)
      .filter(([, qty]) => qty > 0)
      .map(([code, qty], i) => ({ id: `q-extra-${i}`, item_code: code, quantity: qty }));

    return calculateJobTotal(
      {
        project_type: projectType,
        boarding: [
          ...(sheets > 0
            ? [
                {
                  id: "q-sheets",
                  material,
                  thickness,
                  height_category: height,
                  sheet_width: 4,
                  sheet_height: 8,
                  quantity: sheets,
                  entry_mode: "sheets" as const,
                },
              ]
            : []),
          ...(sqft > 0
            ? [
                {
                  id: "q-sqft",
                  material,
                  thickness,
                  height_category: height,
                  sheet_width: 4,
                  sheet_height: 8,
                  quantity: sqft,
                  entry_mode: "sqft" as const,
                },
              ]
            : []),
        ],
        extras: extraInputs,
        premiums: [],
      },
      ctx,
    );
  }, [projectType, material, thickness, height, sheets, sqft, extras, ctx]);

  const reset = () => {
    setSheets(0);
    setSqft(0);
    setExtras({});
  };

  return (
    <div className="space-y-5 pb-40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Quick calculator</h1>
          <p className="text-sm text-muted-foreground">
            {table
              ? `Using ${table.version} (effective ${table.effective_from})`
              : "No rate table in force today"}
          </p>
        </div>
        <Button variant="secondary" onClick={reset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
      </div>

      {!table ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No rate table is in force today, so nothing can be priced.{" "}
          <Link to="/rates" className="text-accent underline">
            Set one up
          </Link>
          .
        </p>
      ) : null}

      <section className="panel space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {PROJECT_TYPES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProjectType(p.value)}
              className={`rounded-lg border px-2 py-3 text-xs font-semibold transition-colors ${
                projectType === p.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Ceiling height</Label>
            <Select {...selectValue(height)} onValueChange={setHeight}>
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="No boarding rates" />
              </SelectTrigger>
              <SelectContent>
                {boardingOptions.heights.map((h) => (
                  <SelectItem key={h} value={h}>
                    {heightLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {boardingOptions.materials.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Material</Label>
              <Select
                value={material || ANY_VALUE}
                onValueChange={(v) => setMaterial(v === ANY_VALUE ? "" : v)}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boardingOptions.materials.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {boardingOptions.thicknesses.length > 0 ? (
            <div className="space-y-1">
              <Label className="text-xs">Thickness</Label>
              <Select
                value={thickness || ANY_VALUE}
                onValueChange={(v) => setThickness(v === ANY_VALUE ? "" : v)}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boardingOptions.thicknesses.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <QtyInput label="Sheets (4×8)" value={sheets} onChange={setSheets} />
          <QtyInput label="Square feet" value={sqft} step={10} onChange={setSqft} />
        </div>
      </section>

      {quickExtras.length > 0 ? (
        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold tracking-widest uppercase">Extras</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickExtras.map((i) => (
              <QtyInput
                key={i.item_code}
                label={`${i.item_name} (${i.unit})`}
                value={extras[i.item_code] ?? 0}
                onChange={(v) => setExtras((e) => ({ ...e, [i.item_code]: v }))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {result.lines.length > 0 ? (
        <section className="panel p-4">
          <CalcBreakdown result={result} />
        </section>
      ) : null}

      <div className="no-print fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Total</div>
            <div className="numeric text-2xl font-bold text-primary">
              {money(result.grand_total)}
            </div>
          </div>
          <div className="numeric text-right text-xs text-muted-foreground">
            <div>{result.metrics.total_sq_ft.toLocaleString()} sq ft</div>
            <div>{money(result.metrics.per_sq_ft)} / sq ft</div>
          </div>
        </div>
      </div>
    </div>
  );
}
