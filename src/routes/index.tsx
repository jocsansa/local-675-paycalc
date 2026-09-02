import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, Table2, TriangleAlert, Zap } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgreements, useJobs, useRateTables } from "@/lib/queries";
import { labelFor, money, PROJECT_TYPES, selectRateTableForDate } from "@/lib/rate-engine";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}

function Dashboard() {
  const jobs = useJobs();
  const agreements = useAgreements();
  const rateTables = useRateTables();

  const list = jobs.data ?? [];
  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonth = list.filter((j) => j.job_date.startsWith(monthKey));
  const monthTotal = thisMonth.reduce((s, j) => s + (j.grand_total ?? 0), 0);
  const calculated = thisMonth.filter((j) => j.grand_total !== null);
  const average = calculated.length ? monthTotal / calculated.length : 0;

  const today = new Date().toISOString().slice(0, 10);
  const activeTable = selectRateTableForDate(rateTables.data ?? [], today);
  const noRates = !rateTables.isLoading && (rateTables.data ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wide">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {activeTable
            ? `Rate table ${activeTable.version} in force today.`
            : "No rate table is in force today."}
        </p>
      </div>

      {noRates ? (
        <div className="panel border-warning/50 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium">No rates are configured yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Until an agreement and a rate table exist, every calculated line will read RATE NOT
                CONFIGURED and total $0. Set them up first.
              </p>
              <Button className="mt-3" asChild>
                <Link to="/rates">
                  <Table2 className="size-4" />
                  Open Rate Manager
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="panel p-5">
        <h2 className="font-display mb-4 text-sm font-semibold tracking-widest uppercase">
          This month
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Jobs" value={String(thisMonth.length)} />
          <Stat label="Total calculated" value={money(monthTotal)} highlight />
          <Stat label="Average job" value={money(average)} />
          <Stat label="All jobs" value={String(list.length)} />
        </dl>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          to="/jobs/new"
          icon={<Calculator className="size-5" />}
          title="New job"
          body="Full flow: project, boarding, extras, premiums, report."
        />
        <ActionCard
          to="/quick"
          icon={<Zap className="size-5" />}
          title="Quick calculator"
          body="Fast on-site estimate without saving a job."
        />
        <ActionCard
          to="/rates"
          icon={<Table2 className="size-5" />}
          title="Rate manager"
          body={`${(agreements.data ?? []).length} agreement(s), ${(rateTables.data ?? []).length} table(s).`}
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold tracking-widest uppercase">
            Recent jobs
          </h2>
          <Link to="/jobs" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No jobs yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.slice(0, 6).map((j) => (
              <li key={j.id}>
                <Link
                  to="/jobs/$id"
                  params={{ id: j.id }}
                  className="panel flex items-center gap-3 p-3 transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{j.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {labelFor(PROJECT_TYPES, j.project_type)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{j.job_date}</span>
                    </div>
                  </div>
                  <span className="numeric text-sm font-semibold text-primary">
                    {j.grand_total === null ? "—" : money(j.grand_total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  body,
}: {
  to: "/jobs/new" | "/quick" | "/rates";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="panel block p-4 transition-colors hover:border-primary/60 hover:bg-surface-2"
    >
      <span className="text-primary">{icon}</span>
      <div className="font-display mt-2 text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </Link>
  );
}
