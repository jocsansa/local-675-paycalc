import { supabase } from "@/integrations/supabase/client";
import type {
  BoardingInput,
  ExtraInput,
  PremiumInput,
  RateItem,
  RateTableInfo,
  RateTier,
  CalculationResult,
} from "./rate-engine";

export interface Agreement {
  id: string;
  name: string;
  local_union: string | null;
  jurisdiction: string | null;
  active: boolean;
  notes: string | null;
}

export interface RateTableRow {
  id: string;
  agreement_id: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  notes: string | null;
}

export interface JobArea {
  id: string;
  job_id?: string;
  name: string;
  floor: string | null;
  unit: string | null;
  room: string | null;
  zone: string | null;
  ceiling_height: number | null;
  sort_order: number;
}

export interface JobRecord {
  id: string;
  name: string;
  address: string | null;
  contractor: string | null;
  project_type: string;
  project_subtype: string | null;
  agreement_id: string | null;
  rate_table_id: string | null;
  job_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface JobDraft {
  id?: string;
  name: string;
  address: string;
  contractor: string;
  project_type: string;
  project_subtype: string;
  agreement_id: string | null;
  rate_table_id: string | null;
  job_date: string;
  notes: string;
  areas: JobArea[];
  boarding: (BoardingInput & { area_id: string | null })[];
  extras: (ExtraInput & { area_id: string | null })[];
  premiums: PremiumInput[];
}

/* ------------------------------------------------------------- rate data */

export async function fetchAgreements(): Promise<Agreement[]> {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Agreement[];
}

export async function fetchRateTables(): Promise<RateTableRow[]> {
  const { data, error } = await supabase
    .from("rate_tables")
    .select("*")
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RateTableRow[];
}

export async function fetchRateItems(rateTableId: string): Promise<RateItem[]> {
  const { data, error } = await supabase
    .from("rate_items")
    .select("*")
    .eq("rate_table_id", rateTableId)
    .order("category")
    .order("item_name");
  if (error) throw error;
  return ((data ?? []) as unknown as RateItem[]).map((r) => ({ ...r, rate: Number(r.rate) }));
}

export async function fetchRateTiers(rateTableId: string): Promise<RateTier[]> {
  const { data, error } = await supabase
    .from("rate_tiers")
    .select("*, rate_items!inner(rate_table_id)")
    .eq("rate_items.rate_table_id", rateTableId);
  if (error) throw error;
  return ((data ?? []) as unknown as RateTier[]).map((t) => ({
    rate_item_id: t.rate_item_id,
    min_qty: Number(t.min_qty),
    max_qty: t.max_qty === null ? null : Number(t.max_qty),
    rate: Number(t.rate),
  }));
}

export interface RateBundle {
  table: RateTableInfo | null;
  items: RateItem[];
  tiers: RateTier[];
}

export async function fetchRateBundle(rateTableId: string | null): Promise<RateBundle> {
  if (!rateTableId) return { table: null, items: [], tiers: [] };
  const [tables, agreements, items, tiers] = await Promise.all([
    fetchRateTables(),
    fetchAgreements(),
    fetchRateItems(rateTableId),
    fetchRateTiers(rateTableId),
  ]);
  const row = tables.find((t) => t.id === rateTableId) ?? null;
  const agreement = row ? (agreements.find((a) => a.id === row.agreement_id) ?? null) : null;
  return {
    table: row
      ? {
          id: row.id,
          version: row.version,
          effective_from: row.effective_from,
          effective_to: row.effective_to,
          agreement_name: agreement?.name ?? null,
        }
      : null,
    items,
    tiers,
  };
}

/* ------------------------------------------------------------------ jobs */

export async function fetchJobs(): Promise<(JobRecord & { grand_total: number | null })[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, calculation_results(grand_total, created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as (JobRecord & {
    calculation_results: { grand_total: number; created_at: string }[];
  })[]).map((j) => {
    const latest = [...(j.calculation_results ?? [])].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    )[0];
    return { ...j, grand_total: latest ? Number(latest.grand_total) : null };
  });
}

export async function fetchJobDraft(jobId: string): Promise<JobDraft> {
  const [{ data: job, error: e1 }, areas, boarding, extras, premiums] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).single(),
    supabase.from("job_areas").select("*").eq("job_id", jobId).order("sort_order"),
    supabase.from("job_boarding_items").select("*").eq("job_id", jobId),
    supabase.from("job_extra_items").select("*").eq("job_id", jobId),
    supabase.from("job_premiums").select("*").eq("job_id", jobId),
  ]);
  if (e1) throw e1;
  const j = job as unknown as JobRecord;
  return {
    id: j.id,
    name: j.name,
    address: j.address ?? "",
    contractor: j.contractor ?? "",
    project_type: j.project_type,
    project_subtype: j.project_subtype ?? "",
    agreement_id: j.agreement_id,
    rate_table_id: j.rate_table_id,
    job_date: j.job_date,
    notes: j.notes ?? "",
    areas: ((areas.data ?? []) as unknown as JobArea[]).map((a) => ({
      ...a,
      ceiling_height: a.ceiling_height === null ? null : Number(a.ceiling_height),
    })),
    boarding: ((boarding.data ?? []) as unknown as Record<string, unknown>[]).map((b) => ({
      id: String(b['id']),
      area_id: (b['area_id'] as string | null) ?? null,
      location: (b['location'] as string | null) ?? "",
      material: String(b['material']),
      thickness: (b['thickness'] as string | null) ?? null,
      height_category: (b['height_category'] as string | null) ?? null,
      sheet_width: Number(b['sheet_width']),
      sheet_height: Number(b['sheet_height']),
      quantity: Number(b['quantity']),
      entry_mode: (b['entry_mode'] as "sheets" | "sqft") ?? "sheets",
    })),
    extras: ((extras.data ?? []) as unknown as Record<string, unknown>[]).map((e) => ({
      id: String(e['id']),
      area_id: (e['area_id'] as string | null) ?? null,
      item_code: String(e['item_code']),
      quantity: Number(e['quantity']),
    })),
    premiums: ((premiums.data ?? []) as unknown as Record<string, unknown>[]).map((p) => ({
      id: String(p['id']),
      item_code: String(p['item_code']),
      quantity: Number(p['quantity']),
    })),
  };
}

export async function fetchJobResult(jobId: string) {
  const { data, error } = await supabase
    .from("calculation_results")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as unknown as
    | { breakdown: unknown; metrics: unknown; grand_total: number; created_at: string }
    | undefined;
  return row ?? null;
}

export async function saveJob(
  draft: JobDraft,
  result: CalculationResult,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const payload = {
    user_id: userId,
    name: draft.name,
    address: draft.address || null,
    contractor: draft.contractor || null,
    project_type: draft.project_type,
    project_subtype: draft.project_subtype || null,
    agreement_id: draft.agreement_id,
    rate_table_id: draft.rate_table_id,
    job_date: draft.job_date,
    status: "calculated",
    notes: draft.notes || null,
  };

  let jobId = draft.id;
  if (jobId) {
    const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
    if (error) throw error;
    await Promise.all([
      supabase.from("job_boarding_items").delete().eq("job_id", jobId),
      supabase.from("job_extra_items").delete().eq("job_id", jobId),
      supabase.from("job_premiums").delete().eq("job_id", jobId),
    ]);
    await supabase.from("job_areas").delete().eq("job_id", jobId);
  } else {
    const { data, error } = await supabase.from("jobs").insert(payload).select("id").single();
    if (error) throw error;
    jobId = (data as unknown as { id: string }).id;
  }

  const idMap = new Map<string, string>();
  if (draft.areas.length) {
    const { data, error } = await supabase
      .from("job_areas")
      .insert(
        draft.areas.map((a, i) => ({
          job_id: jobId!,
          name: a.name,
          floor: a.floor,
          unit: a.unit,
          room: a.room,
          zone: a.zone,
          ceiling_height: a.ceiling_height,
          sort_order: i,
        })),
      )
      .select("id");
    if (error) throw error;
    (data as unknown as { id: string }[]).forEach((row, i) => {
      const local = draft.areas[i];
      if (local) idMap.set(local.id, row.id);
    });
  }

  if (draft.boarding.length) {
    const { error } = await supabase.from("job_boarding_items").insert(
      draft.boarding.map((b) => ({
        job_id: jobId!,
        area_id: b.area_id ? (idMap.get(b.area_id) ?? null) : null,
        location: b.location ?? null,
        material: b.material,
        thickness: b.thickness ?? null,
        height_category: b.height_category ?? null,
        sheet_width: b.sheet_width,
        sheet_height: b.sheet_height,
        quantity: b.quantity,
        sq_ft: b.entry_mode === "sqft" ? b.quantity : b.sheet_width * b.sheet_height * b.quantity,
        entry_mode: b.entry_mode,
      })),
    );
    if (error) throw error;
  }

  if (draft.extras.length) {
    const { error } = await supabase.from("job_extra_items").insert(
      draft.extras.map((e) => ({
        job_id: jobId!,
        area_id: e.area_id ? (idMap.get(e.area_id) ?? null) : null,
        item_code: e.item_code,
        quantity: e.quantity,
      })),
    );
    if (error) throw error;
  }

  if (draft.premiums.length) {
    const { error } = await supabase.from("job_premiums").insert(
      draft.premiums.map((p) => ({
        job_id: jobId!,
        item_code: p.item_code,
        quantity: p.quantity ?? 1,
      })),
    );
    if (error) throw error;
  }

  const { error: resErr } = await supabase.from("calculation_results").insert({
    job_id: jobId!,
    base_total: result.base_total,
    extras_total: result.extras_total,
    premiums_total: result.premiums_total,
    grand_total: result.grand_total,
    rate_table_id: draft.rate_table_id,
    effective_date: result.effective_date,
    breakdown: result.lines as unknown as never,
    metrics: result.metrics as unknown as never,
  });
  if (resErr) throw resErr;

  return jobId!;
}

export async function deleteJob(jobId: string) {
  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) throw error;
}
