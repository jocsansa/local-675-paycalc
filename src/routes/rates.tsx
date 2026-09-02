import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2, Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { csvToRateItems, downloadCsv, rateItemsToCsv, rateTemplateCsv } from "@/lib/csv";
import {
  createAgreement,
  createRateTable,
  insertRateItems,
  saveRateItem,
  seedLocal675,
  setRateItemActive,
  setRateTableActive,
  type RateItemDraft,
} from "@/lib/db";
import { useAgreements, useRateItems, useRateTables } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { selectValue } from "@/lib/utils";
import {
  HEIGHT_CATEGORIES,
  MATERIALS,
  PROJECT_TYPES,
  THICKNESSES,
  type RateItem,
} from "@/lib/rate-engine";

export const Route = createFileRoute("/rates")({
  component: RatesPage,
});

const CALC_TYPES = [
  "per_sq_ft",
  "per_sheet",
  "per_linear_ft",
  "per_item",
  "per_unit",
  "fixed",
  "percentage",
  "tiered",
  "conditional",
];

const CATEGORIES = ["boarding", "extra", "premium"];

function RatesPage() {
  return (
    <AppLayout>
      <RateManager />
    </AppLayout>
  );
}

function RateManager() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const agreements = useAgreements();
  const rateTables = useRateTables();

  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeAgreementId = agreementId ?? agreements.data?.[0]?.id ?? null;
  const tablesForAgreement = useMemo(
    () => (rateTables.data ?? []).filter((t) => t.agreement_id === activeAgreementId),
    [rateTables.data, activeAgreementId],
  );
  const activeTableId = tableId ?? tablesForAgreement[0]?.id ?? null;
  const items = useRateItems(activeTableId);

  const visibleItems = useMemo(() => {
    return (items.data ?? []).filter(
      (i) =>
        (showInactive || i.active !== false) &&
        (filterType === "all" || i.project_type === filterType) &&
        (filterCategory === "all" || i.category === filterCategory),
    );
  }, [items.data, filterType, filterCategory, showInactive]);

  const refreshRates = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rate_items", activeTableId] });
    await queryClient.invalidateQueries({ queryKey: ["rate_bundle", activeTableId] });
  };

  async function handleImport(file: File) {
    if (!activeTableId) return;
    const text = await file.text();
    const { rows, errors } = csvToRateItems(text, activeTableId);
    if (rows.length === 0) {
      toast.error(errors[0] ?? "Nothing to import.");
      return;
    }
    try {
      await insertRateItems(rows);
      await refreshRates();
      toast.success(
        `Imported ${rows.length} rate(s).${errors.length ? ` ${errors.length} row(s) skipped.` : ""}`,
      );
      if (errors.length) console.warn("CSV import issues:", errors);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Rate manager</h1>
          <p className="text-sm text-muted-foreground">
            Rates are versioned by effective date and never overwritten.
          </p>
        </div>
        {!isAdmin ? <Badge variant="outline">Read-only — admin role required to edit</Badge> : null}
      </div>

      {/* Agreement + table selection */}
      <section className="panel space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Agreement</Label>
            <div className="flex gap-2">
              <Select
                {...selectValue(activeAgreementId)}
                onValueChange={(v) => {
                  setAgreementId(v);
                  setTableId(null);
                }}
              >
                <SelectTrigger className="h-12 flex-1">
                  <SelectValue placeholder="No agreements yet" />
                </SelectTrigger>
                <SelectContent>
                  {(agreements.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.active ? "" : " (inactive)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewAgreementDialog
                disabled={!isAdmin}
                onCreated={async (id) => {
                  await queryClient.invalidateQueries({ queryKey: ["agreements"] });
                  setAgreementId(id);
                  setTableId(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rate table</Label>
            <div className="flex gap-2">
              <Select
                {...selectValue(activeTableId)}
                onValueChange={(v) => setTableId(v)}
                disabled={!activeAgreementId}
              >
                <SelectTrigger className="h-12 flex-1">
                  <SelectValue placeholder="No rate tables yet" />
                </SelectTrigger>
                <SelectContent>
                  {tablesForAgreement.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.version} — {t.effective_from}
                      {t.effective_to ? ` → ${t.effective_to}` : " → open"}
                      {t.active ? "" : " (inactive)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewRateTableDialog
                agreementId={activeAgreementId}
                disabled={!isAdmin || !activeAgreementId}
                onCreated={async (id) => {
                  await queryClient.invalidateQueries({ queryKey: ["rate_tables"] });
                  setTableId(id);
                }}
              />
            </div>
          </div>
        </div>

        {activeTableId ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              variant="secondary"
              onClick={() => downloadCsv("675-rate-template.csv", rateTemplateCsv())}
            >
              <FileUp className="size-4" />
              CSV template
            </Button>
            <Button
              variant="secondary"
              disabled={!items.data?.length}
              onClick={() =>
                downloadCsv(
                  `675-rates-${activeTableId.slice(0, 8)}.csv`,
                  rateItemsToCsv(items.data ?? []),
                )
              }
            >
              <Download className="size-4" />
              Export
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              disabled={!isAdmin}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              Import CSV
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="tbl-active" className="text-xs text-muted-foreground">
                Table active
              </Label>
              <Switch
                id="tbl-active"
                disabled={!isAdmin}
                checked={tablesForAgreement.find((t) => t.id === activeTableId)?.active ?? false}
                onCheckedChange={async (on) => {
                  await setRateTableActive(activeTableId, on);
                  await queryClient.invalidateQueries({ queryKey: ["rate_tables"] });
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {(agreements.data ?? []).length === 0 ? (
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-sm font-semibold tracking-widest uppercase">
            Start from the published Local 675 schedule
          </h2>
          <p className="text-sm text-muted-foreground">
            Loads the ISCA / Local 675 residential piecework rates for 2025–2028 as three rate
            tables, one per contract year, so each job is priced with the rates in force on its
            date. Boarding is priced per 1000 sq ft by ceiling height, exactly as the agreement
            states it.
          </p>
          <p className="text-xs text-muted-foreground">
            Transcribed from Article 6 of the agreement effective May 1, 2025 – April 30, 2028.
            Check it against your own copy before using a total for payment.
          </p>
          <Button
            disabled={!isAdmin || seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                const { tables, rates } = await seedLocal675();
                await queryClient.invalidateQueries({ queryKey: ["agreements"] });
                await queryClient.invalidateQueries({ queryKey: ["rate_tables"] });
                toast.success(`Loaded ${rates} rates across ${tables} contract years.`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not load the schedule.");
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Load Local 675 2025–2028
          </Button>
        </section>
      ) : null}

      {!activeTableId ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Create an agreement and a rate table, then download the CSV template, fill in the rates
          from the collective agreement and import it.
        </p>
      ) : (
        <>
          <section className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Project type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-11 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {PROJECT_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-11 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2.5">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-xs text-muted-foreground">
                Show superseded
              </Label>
            </div>
            <div className="ml-auto pb-1">
              <RateItemDialog
                rateTableId={activeTableId}
                disabled={!isAdmin}
                onSaved={refreshRates}
              />
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            {visibleItems.length} rate(s) shown{items.isLoading ? " — loading…" : ""}
          </p>

          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
                <tr>
                  <Th>Type</Th>
                  <Th>Category</Th>
                  <Th>Item</Th>
                  <Th>Material</Th>
                  <Th>Thick.</Th>
                  <Th>Height</Th>
                  <Th>Unit</Th>
                  <Th className="text-right">Rate</Th>
                  <Th>Calc</Th>
                  <Th className="text-right">Incl.</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleItems.map((i) => (
                  <tr key={i.id} className={i.active === false ? "opacity-50" : undefined}>
                    <Td>{i.project_type}</Td>
                    <Td>{i.category}</Td>
                    <Td>
                      <span className="font-medium">{i.item_name}</span>
                      <span className="block text-[11px] text-muted-foreground">{i.item_code}</span>
                    </Td>
                    <Td>{i.material ?? "—"}</Td>
                    <Td>{i.thickness ?? "—"}</Td>
                    <Td>{i.height_category ?? "—"}</Td>
                    <Td>{i.unit}</Td>
                    <Td className="numeric text-right font-semibold">
                      {Number(i.rate).toFixed(4)}
                    </Td>
                    <Td>{i.calculation_type}</Td>
                    <Td className="numeric text-right">{i.included_qty ?? 0}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <RateItemDialog
                        rateTableId={activeTableId}
                        existing={i}
                        disabled={!isAdmin}
                        onSaved={refreshRates}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isAdmin}
                        onClick={async () => {
                          await setRateItemActive(i.id, i.active === false);
                          await refreshRates();
                        }}
                      >
                        {i.active === false ? "Restore" : "Deactivate"}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleItems.length === 0 && !items.isLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No rates on this table yet.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-2 font-medium ${className ?? ""}`}>{children}</th>
);
const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 align-top ${className ?? ""}`}>{children}</td>
);

/* ------------------------------------------------------------------ dialogs */

function NewAgreementDialog({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [local, setLocal] = useState("675");
  const [jurisdiction, setJurisdiction] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-12" disabled={disabled} aria-label="New agreement">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New agreement</DialogTitle>
          <DialogDescription>
            An agreement groups the rate tables of one union or jurisdiction.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Local 675 Drywall Agreement"
            />
          </Field>
          <Field label="Local / union">
            <Input value={local} onChange={(e) => setLocal(e.target.value)} />
          </Field>
          <Field label="Jurisdiction">
            <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!name.trim()) {
                toast.error("Name is required.");
                return;
              }
              try {
                const id = await createAgreement({
                  name: name.trim(),
                  local_union: local,
                  jurisdiction,
                  notes,
                });
                await onCreated(id);
                setOpen(false);
                setName("");
                toast.success("Agreement created.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not create the agreement.");
              }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewRateTableDialog({
  agreementId,
  disabled,
  onCreated,
}: {
  agreementId: string | null;
  disabled: boolean;
  onCreated: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="h-12"
          disabled={disabled}
          aria-label="New rate table"
        >
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New rate table</DialogTitle>
          <DialogDescription>
            A new version takes effect on its start date. Older tables stay untouched so past jobs
            keep calculating with the rates that applied then.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Version">
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="2026-2029 Schedule A"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective from">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Effective to (optional)">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!agreementId) return;
              if (!version.trim()) {
                toast.error("Version is required.");
                return;
              }
              try {
                const id = await createRateTable({
                  agreement_id: agreementId,
                  version: version.trim(),
                  effective_from: from,
                  effective_to: to || null,
                  notes,
                });
                await onCreated(id);
                setOpen(false);
                setVersion("");
                toast.success("Rate table created.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not create the rate table.");
              }
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateItemDialog({
  rateTableId,
  existing,
  disabled,
  onSaved,
}: {
  rateTableId: string;
  existing?: RateItem;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RateItemDraft>(() => blank(rateTableId, existing));

  const set = (p: Partial<RateItemDraft>) => setForm((f) => ({ ...f, ...p }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank(rateTableId, existing));
      }}
    >
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="sm" disabled={disabled}>
            Edit
          </Button>
        ) : (
          <Button disabled={disabled}>
            <Plus className="size-4" />
            Add rate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit rate" : "Add rate"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Saving supersedes the current row: it is deactivated and a new one is inserted, so history is preserved."
              : "Add a single rate to this table."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project type">
            <Pick
              value={form.project_type}
              onChange={(v) => set({ project_type: v })}
              options={PROJECT_TYPES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
          <Field label="Category">
            <Pick
              value={form.category}
              onChange={(v) => set({ category: v })}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Item code">
            <Input value={form.item_code} onChange={(e) => set({ item_code: e.target.value })} />
          </Field>
          <Field label="Item name">
            <Input value={form.item_name} onChange={(e) => set({ item_name: e.target.value })} />
          </Field>
          {form.category === "boarding" ? (
            <>
              <Field label="Material">
                <Pick
                  value={form.material ?? ""}
                  onChange={(v) => set({ material: v })}
                  options={MATERIALS}
                />
              </Field>
              <Field label="Thickness">
                <Pick
                  value={form.thickness ?? ""}
                  onChange={(v) => set({ thickness: v })}
                  options={THICKNESSES.map((t) => ({ value: t, label: t }))}
                />
              </Field>
              <Field label="Height category">
                <Pick
                  value={form.height_category ?? ""}
                  onChange={(v) => set({ height_category: v })}
                  options={HEIGHT_CATEGORIES}
                />
              </Field>
            </>
          ) : null}
          <Field label="Unit">
            <Input value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
          </Field>
          <Field label="Rate">
            <Input
              className="numeric"
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={form.rate}
              onChange={(e) => set({ rate: Number(e.target.value) })}
            />
          </Field>
          <Field label="Calculation type">
            <Pick
              value={form.calculation_type}
              onChange={(v) => set({ calculation_type: v })}
              options={CALC_TYPES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Included quantity">
            <Input
              className="numeric"
              type="number"
              inputMode="decimal"
              value={form.included_qty ?? 0}
              onChange={(e) => set({ included_qty: Number(e.target.value) })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={async () => {
              if (!form.item_code.trim() || !form.unit.trim()) {
                toast.error("Item code and unit are required.");
                return;
              }
              try {
                await saveRateItem({ ...form, item_name: form.item_name || form.item_code });
                await onSaved();
                setOpen(false);
                toast.success("Rate saved.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save the rate.");
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blank(rateTableId: string, existing?: RateItem): RateItemDraft {
  if (existing) return { ...existing };
  return {
    rate_table_id: rateTableId,
    project_type: "low_rise",
    category: "boarding",
    item_code: "",
    item_name: "",
    material: "regular",
    thickness: '1/2"',
    height_category: "up_to_10",
    unit: "sq_ft",
    rate: 0,
    calculation_type: "per_sq_ft",
    included_qty: 0,
    active: true,
    notes: "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Pick({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select {...selectValue(value)} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
