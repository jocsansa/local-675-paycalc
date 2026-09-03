import { createFileRoute, Link } from "@tanstack/react-router";
import { CopyPlus, Pencil, Printer } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { CalcBreakdown } from "@/components/CalcBreakdown";
import { Stat } from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { useAgreements, useJobDraft, useJobResult, useRateTables } from "@/lib/queries";
import {
  labelFor,
  money,
  PROJECT_TYPES,
  type CalculationResult,
  type CalcLine,
  type JobMetrics,
} from "@/lib/rate-engine";

export const Route = createFileRoute("/jobs/$id")({
  component: ReportPage,
});

function ReportPage() {
  return (
    <AppLayout>
      <Report />
    </AppLayout>
  );
}

function Report() {
  const { id } = Route.useParams();
  const job = useJobDraft(id);
  const stored = useJobResult(id);
  const agreements = useAgreements();
  const rateTables = useRateTables();

  if (job.isLoading || stored.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading report…</p>;
  }
  if (job.isError || !job.data) {
    return <p className="text-sm text-destructive">This job could not be loaded.</p>;
  }

  const d = job.data;
  const agreement = (agreements.data ?? []).find((a) => a.id === d.agreement_id);
  const table = (rateTables.data ?? []).find((t) => t.id === d.rate_table_id);

  if (!stored.data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">{d.name}</h1>
        <p className="text-sm text-muted-foreground">
          This job has no saved calculation yet. Open it in the builder and save to produce a
          report.
        </p>
        <Button asChild>
          <Link to="/jobs/new" search={{ job: id }}>
            Open in builder
          </Link>
        </Button>
      </div>
    );
  }

  // The report replays the stored breakdown rather than recalculating, so a
  // saved job always shows the numbers it was actually saved with.
  const result: CalculationResult = {
    lines: (stored.data.breakdown as unknown as CalcLine[]) ?? [],
    base_total: Number(stored.data.base_total),
    extras_total: Number(stored.data.extras_total),
    premiums_total: Number(stored.data.premiums_total),
    grand_total: Number(stored.data.grand_total),
    rate_table_used: table
      ? {
          id: table.id,
          version: table.version,
          effective_from: table.effective_from,
          effective_to: table.effective_to,
          agreement_name: agreement?.name ?? null,
        }
      : null,
    effective_date: stored.data.effective_date ?? table?.effective_from ?? null,
    metrics: (stored.data.metrics as unknown as JobMetrics) ?? emptyMetrics(),
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="secondary" asChild>
          <Link to="/jobs/new" search={{ job: id }}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/jobs/new" search={{ copy: id }}>
            <CopyPlus className="size-4" />
            Duplicate
          </Link>
        </Button>
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / PDF
        </Button>
      </div>

      <header className="panel p-5">
        <div className="hatch mb-4 h-1.5 w-28 rounded-full" />
        <h1 className="font-display text-xl font-bold tracking-wide sm:text-2xl">
          675 PIECEWORK CALCULATION REPORT
        </h1>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Job" value={d.name} />
          <Info label="Address" value={d.address || "—"} />
          <Info label="Contractor" value={d.contractor || "—"} />
          <Info
            label="Project type"
            value={`${labelFor(PROJECT_TYPES, d.project_type)}${
              d.project_subtype ? ` — ${d.project_subtype}` : ""
            }`}
          />
          <Info label="Agreement" value={agreement?.name ?? "—"} />
          <Info label="Rate table" value={table ? `${table.version}` : "—"} />
          {/* The date stored with the calculation, not the table's current one:
              a report has to keep showing the rates it was produced under. */}
          <Info label="Effective date" value={result.effective_date ?? "—"} />
          <Info label="Job date" value={d.job_date} />
          <Info label="Calculated" value={new Date(stored.data.created_at).toLocaleString()} />
        </dl>
      </header>

      <section className="panel p-5">
        <CalcBreakdown result={result} />

        <div className="mt-6 flex items-center justify-between border-t-2 border-primary pt-4">
          <span className="font-display text-lg font-bold tracking-widest uppercase">
            Final total
          </span>
          <span className="numeric text-2xl font-bold text-primary">
            {money(result.grand_total)}
          </span>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-display mb-3 text-sm font-semibold tracking-widest uppercase">
          Price analysis
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Board sq ft" value={result.metrics.total_sq_ft.toLocaleString()} />
          <Stat label="Total sheets" value={result.metrics.total_sheets.toLocaleString()} />
          <Stat label="Avg $/sheet" value={money(result.metrics.avg_per_sheet)} />
          <Stat label="$/sq ft" value={money(result.metrics.per_sq_ft)} />
          <Stat label="$/1000 sq ft" value={money(result.metrics.per_1000_sq_ft)} />
          <Stat label="Extras %" value={`${result.metrics.extras_pct}%`} />
        </dl>
      </section>

      <section className="panel p-5">
        <h2 className="font-display mb-3 text-sm font-semibold tracking-widest uppercase">
          Calculation notes
        </h2>
        <ul className="numeric space-y-1 text-xs text-muted-foreground">
          {result.lines.map((l, i) => (
            <li key={i}>
              <span className="text-foreground">{l.label}</span> — {l.formula} = {money(l.subtotal)}
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed">
        <strong>Disclaimer.</strong> This calculation was produced from the rate table shown above
        as recorded in this application. It is an estimate for reference only and must be verified
        against the current collective agreement in force for the jurisdiction and date of the work
        before being used for payment, invoicing or dispute resolution.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function emptyMetrics(): JobMetrics {
  return {
    total_sq_ft: 0,
    total_sheets: 0,
    avg_per_sheet: 0,
    per_sq_ft: 0,
    per_1000_sq_ft: 0,
    extras_pct: 0,
    premiums_pct: 0,
    line_count: 0,
    missing_rates: 0,
  };
}
