import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { CalcBreakdown } from "@/components/CalcBreakdown";
import { QtyInput } from "@/components/QtyInput";
import { Stat } from "@/components/Stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveJob, type JobArea, type JobDraft } from "@/lib/db";
import { useAgreements, useJobDraft, useRateBundle, useRateTables } from "@/lib/queries";
import { getErrorMessage, selectValue } from "@/lib/utils";
import {
  ANY_VALUE,
  boardingDimensions,
  boardingSqFt,
  defaultBoardingValue,
  calculateJobTotal,
  HEIGHT_CATEGORIES,
  heightLabel,
  labelFor,
  money,
  premiumNeedsQuantity,
  PROJECT_TYPES,
  selectRateTableForDate,
  type BoardingDimensions,
  type CalculationResult,
  type EngineContext,
} from "@/lib/rate-engine";

export const Route = createFileRoute("/jobs/new")({
  validateSearch: (search: Record<string, unknown>): { job?: string; copy?: string } => ({
    ...(typeof search["job"] === "string" ? { job: search["job"] } : {}),
    ...(typeof search["copy"] === "string" ? { copy: search["copy"] } : {}),
  }),
  component: JobBuilderPage,
});

const STEPS = ["Project", "Boarding", "Extras", "Premiums", "Review"] as const;

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2)}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Sheet dimensions multiply straight into the priced square footage, so a
 * negative or unparseable entry has to become 0 rather than reach the engine. */
const positive = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function emptyDraft(): JobDraft {
  return {
    name: "",
    address: "",
    contractor: "",
    project_type: "low_rise",
    project_subtype: "",
    agreement_id: null,
    rate_table_id: null,
    job_date: today(),
    notes: "",
    areas: [],
    boarding: [],
    extras: [],
    premiums: [],
  };
}

function JobBuilderPage() {
  return (
    <AppLayout>
      <JobBuilder />
    </AppLayout>
  );
}

function JobBuilder() {
  const { job: editId, copy: copyId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<JobDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [tableOverridden, setTableOverridden] = useState(false);

  const agreements = useAgreements();
  const rateTables = useRateTables();
  const loaded = useJobDraft(editId ?? copyId ?? null);

  // Hydrate from an existing job (edit) or clone it (duplicate). This runs once
  // per source job: react-query hands back a fresh object on every background
  // refetch (window focus, reconnect), and re-seeding the form from it would
  // throw away everything the user had typed since.
  const hydratedFrom = useRef<string | null>(null);
  useEffect(() => {
    const source = loaded.data;
    const sourceId = editId ?? copyId ?? null;
    if (!source || !sourceId || hydratedFrom.current === sourceId) return;
    hydratedFrom.current = sourceId;

    if (editId) {
      setDraft({ ...source });
      return;
    }
    // A duplicate starts as a brand new job: drop the id so it saves as its own
    // row, and re-key the areas together with every line that points at one, so
    // nothing in the copy still references the original job's rows.
    const { id: _originalId, ...rest } = source;
    const areaIds = new Map(source.areas.map((a) => [a.id, makeId()]));
    const remap = (areaId: string | null) => (areaId ? (areaIds.get(areaId) ?? null) : null);
    setDraft({
      ...rest,
      name: `${source.name} (copy)`,
      job_date: today(),
      areas: source.areas.map((a) => ({ ...a, id: areaIds.get(a.id) ?? makeId() })),
      boarding: source.boarding.map((b) => ({ ...b, id: makeId(), area_id: remap(b.area_id) })),
      extras: source.extras.map((e) => ({ ...e, id: makeId(), area_id: remap(e.area_id) })),
      premiums: source.premiums.map((p) => ({ ...p, id: makeId() })),
    });
    setTableOverridden(false);
  }, [loaded.data, editId, copyId]);

  const agreementTables = useMemo(
    () => (rateTables.data ?? []).filter((t) => t.agreement_id === draft.agreement_id),
    [rateTables.data, draft.agreement_id],
  );

  // The agreement in force on the job date is applied automatically. A user can
  // still override it, and the override survives further edits.
  useEffect(() => {
    if (tableOverridden || !draft.agreement_id) return;
    const picked = selectRateTableForDate(agreementTables, draft.job_date);
    setDraft((d) =>
      d.rate_table_id === (picked?.id ?? null) ? d : { ...d, rate_table_id: picked?.id ?? null },
    );
  }, [agreementTables, draft.job_date, draft.agreement_id, tableOverridden]);

  // Default to the only agreement when there is just one.
  useEffect(() => {
    const list = agreements.data ?? [];
    const only = list.filter((a) => a.active);
    if (!draft.agreement_id && only.length === 1 && only[0]) {
      setDraft((d) => ({ ...d, agreement_id: only[0]!.id }));
    }
  }, [agreements.data, draft.agreement_id]);

  const bundle = useRateBundle(draft.rate_table_id);

  const ctx: EngineContext = useMemo(
    () => ({
      rateTable: bundle.data?.table ?? null,
      items: bundle.data?.items ?? [],
      tiers: bundle.data?.tiers ?? [],
    }),
    [bundle.data],
  );

  const result: CalculationResult = useMemo(
    () =>
      calculateJobTotal(
        {
          project_type: draft.project_type,
          boarding: draft.boarding,
          extras: draft.extras,
          premiums: draft.premiums,
        },
        ctx,
      ),
    [draft.project_type, draft.boarding, draft.extras, draft.premiums, ctx],
  );

  // The boarding form offers exactly the dimensions the rate table prices on.
  // Local 675 prices boarding by ceiling height alone, so the material and
  // thickness pickers disappear rather than offering choices that change nothing.
  const boardingOptions = useMemo(() => {
    const dims = boardingDimensions(ctx.items, draft.project_type);
    // Before any boarding rate exists, fall back to the standard ladder so the
    // form is still usable — every line will read RATE NOT CONFIGURED.
    return dims.heights.length ? dims : { ...dims, heights: HEIGHT_CATEGORIES.map((h) => h.value) };
  }, [ctx.items, draft.project_type]);

  const extraItems = ctx.items.filter(
    (i) => i.category === "extra" && i.project_type === draft.project_type && i.active !== false,
  );
  const premiumItems = ctx.items.filter(
    (i) => i.category === "premium" && i.project_type === draft.project_type && i.active !== false,
  );

  const patch = (p: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...p }));

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Give the job a name first.");
      setStep(0);
      return;
    }
    if (!draft.rate_table_id) {
      toast.error("No rate table applies to this job date. Pick an agreement in step 1.");
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const id = await saveJob(draft, result);
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job saved.");
      void navigate({ to: "/jobs/$id", params: { id } });
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not save the job."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-40">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            {editId ? "Edit job" : copyId ? "Duplicate job" : "New job"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {draft.name || "Untitled"} · {STEPS[step]}
          </p>
        </div>
        {result.metrics.missing_rates > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <TriangleAlert className="size-3.5" />
            {result.metrics.missing_rates} rate(s) not configured
          </Badge>
        ) : null}
      </div>

      <ol className="no-print mb-6 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`w-full rounded-md border px-1 py-2 text-[11px] font-medium transition-colors md:text-xs ${
                i === step
                  ? "border-primary bg-primary/15 text-primary"
                  : i < step
                    ? "border-border bg-secondary text-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <ProjectStep
          draft={draft}
          patch={patch}
          agreements={(agreements.data ?? []).filter((a) => a.active)}
          tables={agreementTables}
          onOverrideTable={(id) => {
            setTableOverridden(true);
            patch({ rate_table_id: id });
          }}
          rateTableLabel={ctx.rateTable?.version ?? null}
        />
      ) : null}

      {step === 1 ? <BoardingStep draft={draft} patch={patch} options={boardingOptions} /> : null}

      {step === 2 ? (
        <ExtrasStep
          draft={draft}
          patch={patch}
          items={extraItems.map((i) => ({ code: i.item_code, name: i.item_name, unit: i.unit }))}
        />
      ) : null}

      {step === 3 ? (
        <PremiumsStep
          draft={draft}
          patch={patch}
          items={premiumItems.map((i) => ({
            code: i.item_code,
            name: i.item_name,
            unit: i.unit,
            calculation_type: i.calculation_type,
          }))}
        />
      ) : null}

      {step === 4 ? <ReviewStep draft={draft} result={result} /> : null}

      {/* Running total, always visible. */}
      <div className="no-print fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] tracking-wider text-muted-foreground uppercase">
              Running total
            </div>
            <div className="numeric truncate text-xl font-bold text-primary">
              {money(result.grand_total)}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="lg" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                <span className="hidden sm:inline">Next</span>
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save job
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- step: project */

function ProjectStep({
  draft,
  patch,
  agreements,
  tables,
  onOverrideTable,
  rateTableLabel,
}: {
  draft: JobDraft;
  patch: (p: Partial<JobDraft>) => void;
  agreements: { id: string; name: string }[];
  tables: { id: string; version: string; effective_from: string; effective_to: string | null }[];
  onOverrideTable: (id: string) => void;
  rateTableLabel: string | null;
}) {
  const projectType = PROJECT_TYPES.find((p) => p.value === draft.project_type);

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-4">
        <h2 className="font-display text-sm font-semibold tracking-widest uppercase">
          Project information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="job-name">Job name</Label>
            <Input
              id="job-name"
              className="h-12"
              placeholder="e.g. Maple Ridge Block C"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-date">Job date</Label>
            <Input
              id="job-date"
              type="date"
              className="h-12"
              value={draft.job_date}
              onChange={(e) => patch({ job_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-address">Address</Label>
            <Input
              id="job-address"
              className="h-12"
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-contractor">Contractor</Label>
            <Input
              id="job-contractor"
              className="h-12"
              value={draft.contractor}
              onChange={(e) => patch({ contractor: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="font-display text-sm font-semibold tracking-widest uppercase">
          Project type
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PROJECT_TYPES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => patch({ project_type: p.value, project_subtype: "" })}
              className={`rounded-lg border p-3 text-left transition-colors ${
                draft.project_type === p.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-secondary/60"
              }`}
            >
              <div className="font-display text-sm font-semibold">{p.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {p.subtypes.join(" · ")}
              </div>
            </button>
          ))}
        </div>
        {projectType ? (
          <div className="space-y-1.5">
            <Label>Subtype</Label>
            <Select
              {...selectValue(draft.project_subtype)}
              onValueChange={(v) => patch({ project_subtype: v })}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select a subtype" />
              </SelectTrigger>
              <SelectContent>
                {projectType.subtypes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      <section className="panel space-y-4 p-4">
        <h2 className="font-display text-sm font-semibold tracking-widest uppercase">
          Agreement &amp; rate table
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Agreement</Label>
            <Select
              {...selectValue(draft.agreement_id)}
              onValueChange={(v) => patch({ agreement_id: v })}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select an agreement" />
              </SelectTrigger>
              <SelectContent>
                {agreements.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rate table (auto-applied for the job date)</Label>
            <Select {...selectValue(draft.rate_table_id)} onValueChange={onOverrideTable}>
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="No table in force on this date" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.version} — from {t.effective_from}
                    {t.effective_to ? ` to ${t.effective_to}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {agreements.length === 0 ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            No agreements exist yet. Create one in <strong>Rates</strong> before calculating a job.
          </p>
        ) : !draft.rate_table_id ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            No rate table is in force on {draft.job_date} for this agreement. Rates will show as NOT
            CONFIGURED until one is added.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Applying rate table <strong className="text-foreground">{rateTableLabel}</strong> for{" "}
            {draft.job_date}.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="job-notes">Notes</Label>
          <Textarea
            id="job-notes"
            rows={3}
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </div>
      </section>

      <AreasEditor draft={draft} patch={patch} />
    </div>
  );
}

function AreasEditor({ draft, patch }: { draft: JobDraft; patch: (p: Partial<JobDraft>) => void }) {
  const highRise = draft.project_type === "high_rise";
  const commercial = draft.project_type === "commercial";

  const addArea = () =>
    patch({
      areas: [
        ...draft.areas,
        {
          id: makeId(),
          name: `Area ${draft.areas.length + 1}`,
          floor: null,
          unit: null,
          room: null,
          zone: null,
          ceiling_height: null,
          sort_order: draft.areas.length,
        },
      ],
    });

  const update = (id: string, p: Partial<JobArea>) =>
    patch({ areas: draft.areas.map((a) => (a.id === id ? { ...a, ...p } : a)) });

  const remove = (id: string) =>
    patch({
      areas: draft.areas.filter((a) => a.id !== id),
      boarding: draft.boarding.map((b) => (b.area_id === id ? { ...b, area_id: null } : b)),
      extras: draft.extras.map((e) => (e.area_id === id ? { ...e, area_id: null } : e)),
    });

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold tracking-widest uppercase">Areas</h2>
        <Button type="button" variant="secondary" onClick={addArea}>
          <Plus className="size-4" />
          Add area
        </Button>
      </div>
      {draft.areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Optional. Add areas (Unit 101, Corridor, Floor 12…) to break the job down; boarding and
          extras can each be assigned to one.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.areas.map((a) => (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-11"
                    value={a.name}
                    onChange={(e) => update(a.id, { name: e.target.value })}
                  />
                </div>
                {(highRise || commercial) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Floor</Label>
                    <Input
                      className="h-11"
                      value={a.floor ?? ""}
                      onChange={(e) => update(a.id, { floor: e.target.value || null })}
                    />
                  </div>
                )}
                {highRise && (
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      className="h-11"
                      value={a.unit ?? ""}
                      onChange={(e) => update(a.id, { unit: e.target.value || null })}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Room</Label>
                  <Input
                    className="h-11"
                    value={a.room ?? ""}
                    onChange={(e) => update(a.id, { room: e.target.value || null })}
                  />
                </div>
                {commercial && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Zone</Label>
                      <Input
                        className="h-11"
                        value={a.zone ?? ""}
                        onChange={(e) => update(a.id, { zone: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ceiling height (ft)</Label>
                      <Input
                        className="numeric h-11"
                        type="number"
                        inputMode="decimal"
                        value={a.ceiling_height ?? ""}
                        onChange={(e) =>
                          update(a.id, {
                            ceiling_height: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(a.id)}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ step: boarding */

function BoardingStep({
  draft,
  patch,
  options,
}: {
  draft: JobDraft;
  patch: (p: Partial<JobDraft>) => void;
  options: BoardingDimensions;
}) {
  const add = () => {
    // Blank ("wildcard") when the table offers one, otherwise the first named
    // value — a table that requires a material on every row has no wildcard,
    // so defaulting to blank would leave the picker showing nothing selected.
    const material = defaultBoardingValue(options.materials);
    const thickness = defaultBoardingValue(options.thicknesses) || null;
    patch({
      boarding: [
        ...draft.boarding,
        {
          id: makeId(),
          area_id: draft.areas[0]?.id ?? null,
          location: "",
          material,
          thickness,
          height_category: options.heights[0] ?? null,
          sheet_width: 4,
          sheet_height: 8,
          quantity: 0,
          entry_mode: "sheets",
        },
      ],
    });
  };

  const update = (id: string, p: Partial<JobDraft["boarding"][number]>) =>
    patch({ boarding: draft.boarding.map((b) => (b.id === id ? { ...b, ...p } : b)) });

  const remove = (id: string) => patch({ boarding: draft.boarding.filter((b) => b.id !== id) });

  const totalSqFt = draft.boarding.reduce((s, b) => s + boardingSqFt(b), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Boarding</h2>
          <p className="numeric text-sm text-muted-foreground">
            {Math.round(totalSqFt).toLocaleString()} sq ft across {draft.boarding.length} line(s)
          </p>
        </div>
        <Button type="button" onClick={add}>
          <Plus className="size-4" />
          Add board
        </Button>
      </div>

      {draft.boarding.length === 0 ? (
        <EmptyHint text="No boarding entered. Add a line for each material / thickness / height combination." />
      ) : null}

      <ul className="space-y-4">
        {draft.boarding.map((b) => (
          <li key={b.id} className="panel space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <LabeledSelect
                label="Ceiling height"
                value={b.height_category ?? ""}
                onChange={(v) => update(b.id, { height_category: v })}
                options={options.heights.map((h) => ({
                  value: h,
                  label: heightLabel(h),
                }))}
              />
              {options.materials.length > 0 ? (
                <LabeledSelect
                  label="Material"
                  value={b.material || ANY_VALUE}
                  onChange={(v) => update(b.id, { material: v === ANY_VALUE ? "" : v })}
                  options={options.materials}
                />
              ) : null}
              {options.thicknesses.length > 0 ? (
                <LabeledSelect
                  label="Thickness"
                  value={b.thickness || ANY_VALUE}
                  onChange={(v) => update(b.id, { thickness: v === ANY_VALUE ? null : v })}
                  options={options.thicknesses}
                />
              ) : null}
              {draft.areas.length > 0 ? (
                <LabeledSelect
                  label="Area"
                  value={b.area_id ?? "none"}
                  onChange={(v) => update(b.id, { area_id: v === "none" ? null : v })}
                  options={[
                    { value: "none", label: "— No area —" },
                    ...draft.areas.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">Location note</Label>
                <Input
                  className="h-11"
                  placeholder="Ceiling, walls…"
                  value={b.location ?? ""}
                  onChange={(e) => update(b.id, { location: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Entry</Label>
                <div className="flex overflow-hidden rounded-md border border-border">
                  {(["sheets", "sqft"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update(b.id, { entry_mode: mode })}
                      className={`h-11 px-4 text-sm font-medium ${
                        b.entry_mode === mode
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground"
                      }`}
                    >
                      {mode === "sheets" ? "Sheets" : "Sq ft"}
                    </button>
                  ))}
                </div>
              </div>

              {b.entry_mode === "sheets" ? (
                <>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Width ft</Label>
                    <Input
                      className="numeric h-11"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={b.sheet_width}
                      onChange={(e) => update(b.id, { sheet_width: positive(e.target.value) })}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Height ft</Label>
                    <Input
                      className="numeric h-11"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={b.sheet_height}
                      onChange={(e) => update(b.id, { sheet_height: positive(e.target.value) })}
                    />
                  </div>
                </>
              ) : null}

              <QtyInput
                className="w-48"
                label={b.entry_mode === "sheets" ? "Sheets" : "Square feet"}
                value={b.quantity}
                step={b.entry_mode === "sheets" ? 1 : 10}
                onChange={(v) => update(b.id, { quantity: v })}
              />

              <div className="ml-auto text-right">
                <div className="text-[11px] tracking-wider text-muted-foreground uppercase">
                  Square feet
                </div>
                <div className="numeric text-lg font-semibold">
                  {boardingSqFt(b).toLocaleString()}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Remove board line"
                onClick={() => remove(b.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- step: extras */

function ExtrasStep({
  draft,
  patch,
  items,
}: {
  draft: JobDraft;
  patch: (p: Partial<JobDraft>) => void;
  items: { code: string; name: string; unit: string }[];
}) {
  const add = () =>
    patch({
      extras: [
        ...draft.extras,
        { id: makeId(), area_id: draft.areas[0]?.id ?? null, item_code: "", quantity: 0 },
      ],
    });

  const update = (id: string, p: Partial<JobDraft["extras"][number]>) =>
    patch({ extras: draft.extras.map((e) => (e.id === id ? { ...e, ...p } : e)) });

  const remove = (id: string) => patch({ extras: draft.extras.filter((e) => e.id !== id) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Extras</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} extra(s) configured on this rate table
          </p>
        </div>
        <Button type="button" onClick={add} disabled={items.length === 0}>
          <Plus className="size-4" />
          Add extra
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyHint text="This rate table has no extras for this project type. Add them in Rates." />
      ) : null}

      <ul className="space-y-3">
        {draft.extras.map((e) => {
          const item = items.find((i) => i.code === e.item_code);
          return (
            <li key={e.id} className="panel flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-52 flex-1 space-y-1">
                <Label className="text-xs">Item</Label>
                <Select
                  {...selectValue(e.item_code)}
                  onValueChange={(v) => update(e.id, { item_code: v })}
                >
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue placeholder="Select an extra" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.code} value={i.code}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.areas.length > 0 ? (
                <LabeledSelect
                  label="Area"
                  value={e.area_id ?? "none"}
                  onChange={(v) => update(e.id, { area_id: v === "none" ? null : v })}
                  options={[
                    { value: "none", label: "— No area —" },
                    ...draft.areas.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              ) : null}

              <QtyInput
                className="w-48"
                label={item ? `Quantity (${item.unit})` : "Quantity"}
                value={e.quantity}
                onChange={(v) => update(e.id, { quantity: v })}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Remove extra"
                onClick={() => remove(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ step: premiums */

function PremiumsStep({
  draft,
  patch,
  items,
}: {
  draft: JobDraft;
  patch: (p: Partial<JobDraft>) => void;
  items: { code: string; name: string; unit: string; calculation_type: string }[];
}) {
  const toggle = (code: string, on: boolean) =>
    patch({
      premiums: on
        ? [...draft.premiums, { id: makeId(), item_code: code, quantity: 1 }]
        : draft.premiums.filter((p) => p.item_code !== code),
    });

  const setQty = (code: string, qty: number) =>
    patch({
      premiums: draft.premiums.map((p) => (p.item_code === code ? { ...p, quantity: qty } : p)),
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Premiums</h2>
        <p className="text-sm text-muted-foreground">
          Applied on top of boarding. Percentage premiums are calculated on the boarding total.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyHint text="This rate table has no premiums for this project type. Add them in Rates." />
      ) : null}

      <ul className="space-y-2">
        {items.map((i) => {
          const selected = draft.premiums.find((p) => p.item_code === i.code);
          // Anything the engine does not derive from the job totals is priced
          // as rate × quantity, so it needs a quantity control — a per_item or
          // per_linear_ft premium was previously stuck at 1.
          const needsQty = premiumNeedsQuantity(i.calculation_type);
          return (
            <li key={i.code} className="panel flex flex-wrap items-center gap-3 p-4">
              <Checkbox
                id={`prem-${i.code}`}
                className="size-6"
                checked={Boolean(selected)}
                onCheckedChange={(c) => toggle(i.code, c === true)}
              />
              <Label htmlFor={`prem-${i.code}`} className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">{i.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {i.calculation_type} · {i.unit}
                </span>
              </Label>
              {selected && needsQty ? (
                <QtyInput
                  className="w-40"
                  value={selected.quantity ?? 1}
                  min={1}
                  onChange={(v) => setQty(i.code, v)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- step: review */

function ReviewStep({ draft, result }: { draft: JobDraft; result: CalculationResult }) {
  return (
    <div className="space-y-6">
      <section className="panel p-4">
        <h2 className="font-display mb-3 text-sm font-semibold tracking-widest uppercase">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Boarding" value={money(result.base_total)} />
          <Stat label="Extras" value={money(result.extras_total)} />
          <Stat label="Premiums" value={money(result.premiums_total)} />
          <Stat label="Grand total" value={money(result.grand_total)} highlight />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Rate table {result.rate_table_used?.version ?? "—"} · effective{" "}
          {result.effective_date ?? "—"} · job date {draft.job_date}
        </p>
      </section>

      {result.metrics.missing_rates > 0 ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {result.metrics.missing_rates} line(s) have no configured rate and contribute $0. Add the
          rates in <strong>Rates</strong> and recalculate before using this number.
        </p>
      ) : null}

      <div className="panel p-4">
        <CalcBreakdown result={result} />
      </div>

      <section className="panel p-4">
        <h2 className="font-display mb-3 text-sm font-semibold tracking-widest uppercase">
          Price analysis
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Board sq ft" value={result.metrics.total_sq_ft.toLocaleString()} />
          <Stat label="Total sheets" value={result.metrics.total_sheets.toLocaleString()} />
          <Stat label="Avg $/sheet" value={money(result.metrics.avg_per_sheet)} />
          <Stat label="$/sq ft" value={money(result.metrics.per_sq_ft)} />
          <Stat label="$/1000 sq ft" value={money(result.metrics.per_1000_sq_ft)} />
          <Stat label="Extras %" value={`${result.metrics.extras_pct}%`} />
        </dl>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select {...selectValue(value)} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
