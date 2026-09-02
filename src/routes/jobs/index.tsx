import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteJob } from "@/lib/db";
import { useAgreements, useJobs } from "@/lib/queries";
import { labelFor, money, PROJECT_TYPES } from "@/lib/rate-engine";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
});

function JobsPage() {
  return (
    <AppLayout>
      <JobsList />
    </AppLayout>
  );
}

function JobsList() {
  const jobs = useJobs();
  const agreements = useAgreements();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const agreementName = useCallback(
    (id: string | null) => (agreements.data ?? []).find((a) => a.id === id)?.name ?? "",
    [agreements.data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = jobs.data ?? [];
    if (!needle) return list;
    return list.filter((j) =>
      [
        j.name,
        j.address ?? "",
        j.contractor ?? "",
        j.project_type,
        j.project_subtype ?? "",
        j.job_date,
        agreementName(j.agreement_id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [jobs.data, q, agreementName]);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This removes the job and its saved calculation.`)) {
      return;
    }
    try {
      await deleteJob(id);
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job deleted.");
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not delete the job."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-wide">Jobs</h1>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="size-4" />
            New job
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-9"
          placeholder="Search name, address, contractor, type, agreement, date…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {jobs.isLoading ? <p className="text-sm text-muted-foreground">Loading jobs…</p> : null}

      {!jobs.isLoading && filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {q ? "No job matches that search." : "No jobs yet. Create the first one."}
        </p>
      ) : null}

      <ul className="space-y-3">
        {filtered.map((j) => (
          <li key={j.id} className="panel p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  to="/jobs/$id"
                  params={{ id: j.id }}
                  className="font-display text-base font-semibold hover:text-primary"
                >
                  {j.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[j.address, j.contractor].filter(Boolean).join(" · ") || "No address"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{labelFor(PROJECT_TYPES, j.project_type)}</Badge>
                  {j.project_subtype ? <Badge variant="outline">{j.project_subtype}</Badge> : null}
                  <Badge variant="outline">{j.job_date}</Badge>
                  {agreementName(j.agreement_id) ? (
                    <Badge variant="outline">{agreementName(j.agreement_id)}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="text-right">
                <div className="numeric text-lg font-bold text-primary">
                  {j.grand_total === null ? "—" : money(j.grand_total)}
                </div>
                <div className="mt-1 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild aria-label="Duplicate job">
                    <Link to="/jobs/new" search={{ copy: j.id }}>
                      <CopyPlus className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="Delete job"
                    onClick={() => void remove(j.id, j.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
