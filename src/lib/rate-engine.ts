/**
 * 675 Piecework Rate Engine
 * -------------------------------------------------------------
 * Pure, side-effect free calculation core. Every calculated line records the
 * rate, unit, quantity, formula, subtotal and the exact rate source used.
 * The engine NEVER invents a rate: when a rate is not configured the line is
 * flagged with `RATE_NOT_CONFIGURED` and contributes $0.
 */

export const RATE_NOT_CONFIGURED = "RATE NOT CONFIGURED";

export type CalculationType =
  | "per_unit"
  | "tiered"
  | "percentage"
  | "per_sq_ft"
  | "per_1000_sq_ft"
  | "per_linear_ft"
  | "per_1000_linear_ft"
  | "per_sheet"
  | "per_item"
  | "fixed"
  | "conditional";

/**
 * Calculation types whose rate is quoted per thousand units. Piecework
 * agreements (Local 675 among them) quote boarding "per 1000 square feet", so
 * the quantity has to be divided by 1000 before applying the rate.
 */
const PER_THOUSAND = new Set(["per_1000_sq_ft", "per_1000_linear_ft"]);

export const isPerThousand = (calculationType: string) => PER_THOUSAND.has(calculationType);

/** Applies a rate to a quantity, honouring per-thousand pricing. */
export function applyRate(quantity: number, rate: number, calculationType: string): number {
  return round2(isPerThousand(calculationType) ? (quantity / 1000) * rate : quantity * rate);
}

export type ProjectType = "low_rise" | "high_rise" | "commercial";

export interface RateItem {
  id: string;
  rate_table_id: string;
  project_type: string;
  category: string; // boarding | extra | premium
  item_code: string;
  item_name: string;
  material?: string | null;
  thickness?: string | null;
  height_category?: string | null;
  unit: string;
  rate: number;
  calculation_type: string;
  included_qty?: number | null;
  active?: boolean | null;
  notes?: string | null;
}

export interface RateTier {
  id?: string;
  rate_item_id: string;
  min_qty: number;
  max_qty: number | null;
  rate: number;
}

export interface RateTableInfo {
  id: string;
  version: string;
  effective_from: string;
  effective_to?: string | null;
  agreement_name?: string | null;
}

export interface BoardingInput {
  id: string;
  location?: string | null;
  area_id?: string | null;
  material: string;
  thickness?: string | null;
  height_category?: string | null;
  sheet_width: number;
  sheet_height: number;
  quantity: number;
  /** "sheets" => quantity is a sheet count, "sqft" => quantity is square feet */
  entry_mode: "sheets" | "sqft";
}

export interface ExtraInput {
  id: string;
  item_code: string;
  area_id?: string | null;
  quantity: number;
}

export interface PremiumInput {
  id: string;
  item_code: string;
  quantity?: number;
}

export interface JobInput {
  project_type: string;
  boarding: BoardingInput[];
  extras: ExtraInput[];
  premiums: PremiumInput[];
}

export interface RateSource {
  rate_table_id: string;
  rate_table_version: string;
  effective_date: string;
  agreement?: string | null | undefined;
  category: string;
  item_code: string;
  item_name: string;
  material?: string | null | undefined;
  thickness?: string | null | undefined;
  height_category?: string | null | undefined;
  unit: string;
  rate: number | null;
  calculation_type: string;
}

export interface CalcLine {
  section: "boarding" | "extras" | "premiums";
  label: string;
  detail?: string | undefined;
  quantity: number;
  unit: string;
  rate: number | null;
  formula: string;
  subtotal: number;
  missing: boolean;
  source: RateSource;
}

export interface JobMetrics {
  total_sq_ft: number;
  total_sheets: number;
  avg_per_sheet: number;
  per_sq_ft: number;
  per_1000_sq_ft: number;
  extras_pct: number;
  premiums_pct: number;
  line_count: number;
  missing_rates: number;
}

export interface CalculationResult {
  lines: CalcLine[];
  base_total: number;
  extras_total: number;
  premiums_total: number;
  grand_total: number;
  rate_table_used: RateTableInfo | null;
  effective_date: string | null;
  metrics: JobMetrics;
}

export interface EngineContext {
  rateTable: RateTableInfo | null;
  items: RateItem[];
  tiers: RateTier[];
}

/* ------------------------------------------------------------------ utils */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n || 0);

/**
 * Ceiling-height bands as written in the Local 675 / ISCA residential
 * agreement, which prices boarding by height. These are only the labels and
 * the fallback list: the job builder offers whichever bands the loaded rate
 * table actually defines, so a different agreement's ladder needs no code
 * change.
 */
export const HEIGHT_CATEGORIES = [
  { value: "up_to_8", label: "Up to and including 8 ft" },
  { value: "8_to_9", label: "Over 8 ft up to and including 9 ft" },
  { value: "9_to_10", label: "Over 9 ft up to and including 10 ft" },
  { value: "10_to_11", label: "Over 10 ft up to and including 11 ft" },
  { value: "11_to_12", label: "Over 11 ft up to and including 12 ft" },
  { value: "over_12", label: "Over 12 ft" },
];

export const MATERIALS = [
  { value: "regular", label: "Regular Board" },
  { value: "steel_framed", label: "Steel Framed House" },
  { value: "type_x", label: "Type X Fire Rated" },
  { value: "moisture", label: "Moisture Resistant" },
  { value: "abuse", label: "Abuse / Impact Resistant" },
  { value: "cement", label: "Cement Board" },
  { value: "sound", label: "Sound Board" },
  { value: "shaftwall", label: "Shaftwall Liner" },
];

export const THICKNESSES = ['1/2"', '5/8"', '3/4"', '1"'];

export const PROJECT_TYPES: {
  value: ProjectType;
  label: string;
  subtypes: string[];
}[] = [
  {
    value: "low_rise",
    label: "Low Rise Residential",
    subtypes: ["Standard", "Townhouse", "Stack", "Back-to-Back", "Steel Framed"],
  },
  {
    value: "high_rise",
    label: "High Rise",
    subtypes: ["Residential", "Apartment", "Condominium"],
  },
  {
    value: "commercial",
    label: "Commercial",
    subtypes: ["Office", "Retail", "Restaurant", "Industrial", "Institutional"],
  },
];

export function labelFor(list: { value: string; label: string }[], value?: string | null) {
  return list.find((l) => l.value === value)?.label ?? value ?? "—";
}

/** Width × Height × Quantity = square feet (or the raw sq ft when entered directly). */
export function boardingSqFt(b: BoardingInput): number {
  if (b.entry_mode === "sqft") return round2(b.quantity || 0);
  return round2((b.sheet_width || 0) * (b.sheet_height || 0) * (b.quantity || 0));
}

export function boardingSheets(b: BoardingInput): number {
  if (b.entry_mode === "sheets") return b.quantity || 0;
  const per = (b.sheet_width || 0) * (b.sheet_height || 0);
  return per > 0 ? round2((b.quantity || 0) / per) : 0;
}

function emptySource(
  ctx: EngineContext,
  category: string,
  item_code: string,
  item_name: string,
  extra: Partial<RateSource> = {},
): RateSource {
  return {
    rate_table_id: ctx.rateTable?.id ?? "",
    rate_table_version: ctx.rateTable?.version ?? "—",
    effective_date: ctx.rateTable?.effective_from ?? "—",
    agreement: ctx.rateTable?.agreement_name ?? null,
    category,
    item_code,
    item_name,
    unit: "—",
    rate: null,
    calculation_type: "—",
    ...extra,
  };
}

function sourceFrom(ctx: EngineContext, item: RateItem): RateSource {
  return {
    rate_table_id: item.rate_table_id,
    rate_table_version: ctx.rateTable?.version ?? "—",
    effective_date: ctx.rateTable?.effective_from ?? "—",
    agreement: ctx.rateTable?.agreement_name ?? null,
    category: item.category,
    item_code: item.item_code,
    item_name: item.item_name,
    material: item.material,
    thickness: item.thickness,
    height_category: item.height_category,
    unit: item.unit,
    rate: Number(item.rate),
    calculation_type: item.calculation_type,
  };
}

/* --------------------------------------------------------------- lookups */

/**
 * Finds the boarding rate for a line. A rate row that leaves material,
 * thickness or height blank is a wildcard matching any value — Local 675
 * prices boarding by ceiling height alone, while other agreements price by
 * material and thickness. When several rows match, the most specific one wins,
 * so an agreement can state a general rate plus narrower exceptions.
 */
export function findBoardingRate(
  ctx: EngineContext,
  projectType: string,
  b: BoardingInput,
): RateItem | undefined {
  const matchesOrWild = (rowValue: string | null | undefined, input: string | null | undefined) =>
    rowValue === null || rowValue === undefined || rowValue === "" || rowValue === (input ?? null);

  const candidates = ctx.items.filter(
    (i) =>
      i.active !== false &&
      i.category === "boarding" &&
      i.project_type === projectType &&
      matchesOrWild(i.material, b.material) &&
      matchesOrWild(i.thickness, b.thickness) &&
      matchesOrWild(i.height_category, b.height_category),
  );

  const specificity = (i: RateItem) =>
    (i.material ? 1 : 0) + (i.thickness ? 1 : 0) + (i.height_category ? 1 : 0);

  return [...candidates].sort((a, b2) => specificity(b2) - specificity(a))[0];
}

export function findItem(
  ctx: EngineContext,
  projectType: string,
  category: string,
  itemCode: string,
): RateItem | undefined {
  return ctx.items.find(
    (i) =>
      i.active !== false &&
      i.category === category &&
      i.item_code === itemCode &&
      i.project_type === projectType,
  );
}

/* ------------------------------------------------------------- tiered rate */

export interface TieredResult {
  amount: number;
  formula: string;
  effectiveQty: number;
}

/** Progressive tiered pricing: each band prices only the quantity inside it. */
export function calculateTieredRate(qty: number, tiers: RateTier[]): TieredResult {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let amount = 0;
  let billed = 0;
  const parts: string[] = [];
  for (const tier of sorted) {
    const upper = tier.max_qty ?? Infinity;
    const portion = Math.max(0, Math.min(qty, upper) - tier.min_qty);
    if (portion <= 0) continue;
    amount += portion * tier.rate;
    if (tier.rate === 0) {
      parts.push(`${portion} included (first ${tier.max_qty ?? "—"})`);
    } else {
      billed += portion;
      parts.push(`${portion} × $${tier.rate.toFixed(2)}`);
    }
  }
  return {
    amount: round2(amount),
    formula: parts.length ? parts.join(" + ") : `${qty} × $0.00`,
    effectiveQty: billed,
  };
}

/* --------------------------------------------------------------- boarding */

export function calculateBoarding(
  ctx: EngineContext,
  projectType: string,
  b: BoardingInput,
): CalcLine {
  const sqft = boardingSqFt(b);
  const item = findBoardingRate(ctx, projectType, b);
  // When the agreement does not price by material or thickness those fields are
  // blank, so fall back to the rate row's own name.
  const label =
    [b.material ? labelFor(MATERIALS, b.material) : "", b.thickness ?? ""]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    item?.item_name ||
    "Boarding";
  const detail = [b.location, labelFor(HEIGHT_CATEGORIES, b.height_category)]
    .filter(Boolean)
    .join(" · ");

  if (!item) {
    return {
      section: "boarding",
      label,
      detail,
      quantity: sqft,
      unit: "sq_ft",
      rate: null,
      formula: RATE_NOT_CONFIGURED,
      subtotal: 0,
      missing: true,
      source: emptySource(ctx, "boarding", `BOARD_${b.material.toUpperCase()}`, label, {
        material: b.material,
        thickness: b.thickness,
        height_category: b.height_category,
      }),
    };
  }

  const rate = Number(item.rate);
  const per1000 = isPerThousand(item.calculation_type);
  const priced = per1000
    ? `(${sqft} ÷ 1000) × $${rate.toFixed(2)} per 1000 sq ft`
    : `${sqft} sq ft × $${rate.toFixed(4)}`;
  const formula =
    b.entry_mode === "sheets"
      ? `${b.sheet_width} ft × ${b.sheet_height} ft × ${b.quantity} sheets = ${sqft} sq ft → ${priced}`
      : priced;

  return {
    section: "boarding",
    label,
    detail,
    quantity: sqft,
    unit: item.unit,
    rate,
    formula,
    subtotal: applyRate(sqft, rate, item.calculation_type),
    missing: false,
    source: sourceFrom(ctx, item),
  };
}

/* ----------------------------------------------------------------- extras */

export function calculateExtra(ctx: EngineContext, projectType: string, e: ExtraInput): CalcLine {
  const item = findItem(ctx, projectType, "extra", e.item_code);
  const qty = e.quantity || 0;

  if (!item) {
    return {
      section: "extras",
      label: e.item_code,
      quantity: qty,
      unit: "—",
      rate: null,
      formula: RATE_NOT_CONFIGURED,
      subtotal: 0,
      missing: true,
      source: emptySource(ctx, "extra", e.item_code, e.item_code),
    };
  }

  if (item.calculation_type === "tiered") {
    const tiers = ctx.tiers.filter((t) => t.rate_item_id === item.id);
    if (tiers.length === 0) {
      const included = Number(item.included_qty ?? 0);
      const billable = Math.max(0, qty - included);
      return {
        section: "extras",
        label: item.item_name,
        detail: included > 0 ? `First ${included} included` : undefined,
        quantity: qty,
        unit: item.unit,
        rate: Number(item.rate),
        formula: `(${qty} − ${included} included) × $${Number(item.rate).toFixed(2)}`,
        subtotal: round2(billable * Number(item.rate)),
        missing: false,
        source: sourceFrom(ctx, item),
      };
    }
    const tiered = calculateTieredRate(qty, tiers);
    return {
      section: "extras",
      label: item.item_name,
      detail: "Tiered rate",
      quantity: qty,
      unit: item.unit,
      rate: Number(item.rate),
      formula: tiered.formula,
      subtotal: tiered.amount,
      missing: false,
      source: sourceFrom(ctx, item),
    };
  }

  const included = Number(item.included_qty ?? 0);
  const billable = Math.max(0, qty - included);
  const rate = Number(item.rate);
  const per1000 = isPerThousand(item.calculation_type);
  const base = included > 0 ? `(${qty} − ${included} included)` : `${qty}`;
  return {
    section: "extras",
    label: item.item_name,
    detail: included > 0 ? `First ${included} included` : undefined,
    quantity: qty,
    unit: item.unit,
    rate,
    formula: per1000
      ? `${base} ÷ 1000 × $${rate.toFixed(2)} per 1000 ${item.unit}`
      : `${base} × $${rate.toFixed(2)}`,
    subtotal: applyRate(billable, rate, item.calculation_type),
    missing: false,
    source: sourceFrom(ctx, item),
  };
}

/* --------------------------------------------------------------- premiums */

export interface PremiumContext {
  baseTotal: number;
  extrasTotal: number;
  totalSqFt: number;
  totalSheets: number;
}

export function calculatePremium(
  ctx: EngineContext,
  projectType: string,
  p: PremiumInput,
  totals: PremiumContext,
): CalcLine {
  const item = findItem(ctx, projectType, "premium", p.item_code);
  if (!item) {
    return {
      section: "premiums",
      label: p.item_code,
      quantity: p.quantity ?? 1,
      unit: "—",
      rate: null,
      formula: RATE_NOT_CONFIGURED,
      subtotal: 0,
      missing: true,
      source: emptySource(ctx, "premium", p.item_code, p.item_code),
    };
  }

  const rate = Number(item.rate);
  const qty = p.quantity ?? 1;
  let subtotal = 0;
  let formula = "";
  let quantity = qty;
  const base = totals.baseTotal;

  switch (item.calculation_type) {
    case "percentage":
      quantity = base;
      subtotal = round2((base * rate) / 100);
      formula = `${money(base)} boarding × ${rate}%`;
      break;
    case "per_sq_ft":
      quantity = totals.totalSqFt;
      subtotal = round2(totals.totalSqFt * rate);
      formula = `${totals.totalSqFt} sq ft × $${rate.toFixed(4)}`;
      break;
    case "per_1000_sq_ft":
      quantity = totals.totalSqFt;
      subtotal = applyRate(totals.totalSqFt, rate, item.calculation_type);
      formula = `(${totals.totalSqFt} ÷ 1000) × $${rate.toFixed(2)} per 1000 sq ft`;
      break;
    case "per_sheet":
      quantity = totals.totalSheets;
      subtotal = round2(totals.totalSheets * rate);
      formula = `${totals.totalSheets} sheets × $${rate.toFixed(2)}`;
      break;
    case "fixed":
      quantity = qty;
      subtotal = round2(rate * qty);
      formula = `${qty} × $${rate.toFixed(2)} fixed`;
      break;
    default:
      quantity = qty;
      subtotal = round2(rate * qty);
      formula = `${qty} × $${rate.toFixed(2)}`;
  }

  return {
    section: "premiums",
    label: item.item_name,
    quantity,
    unit: item.unit,
    rate,
    formula,
    subtotal,
    missing: false,
    source: sourceFrom(ctx, item),
  };
}

/* ------------------------------------------------------------ job totals */

export function calculateJobTotal(job: JobInput, ctx: EngineContext): CalculationResult {
  const boardingLines = job.boarding.map((b) => calculateBoarding(ctx, job.project_type, b));
  const extraLines = job.extras
    .filter((e) => e.item_code)
    .map((e) => calculateExtra(ctx, job.project_type, e));

  const base_total = round2(boardingLines.reduce((s, l) => s + l.subtotal, 0));
  const extras_total = round2(extraLines.reduce((s, l) => s + l.subtotal, 0));
  const total_sq_ft = round2(job.boarding.reduce((s, b) => s + boardingSqFt(b), 0));
  const total_sheets = round2(job.boarding.reduce((s, b) => s + boardingSheets(b), 0));

  const premiumLines = job.premiums
    .filter((p) => p.item_code)
    .map((p) =>
      calculatePremium(ctx, job.project_type, p, {
        baseTotal: base_total,
        extrasTotal: extras_total,
        totalSqFt: total_sq_ft,
        totalSheets: total_sheets,
      }),
    );

  const premiums_total = round2(premiumLines.reduce((s, l) => s + l.subtotal, 0));
  const grand_total = round2(base_total + extras_total + premiums_total);
  const lines = [...boardingLines, ...extraLines, ...premiumLines];

  return {
    lines,
    base_total,
    extras_total,
    premiums_total,
    grand_total,
    rate_table_used: ctx.rateTable,
    effective_date: ctx.rateTable?.effective_from ?? null,
    metrics: {
      total_sq_ft,
      total_sheets,
      avg_per_sheet: total_sheets > 0 ? round2(grand_total / total_sheets) : 0,
      per_sq_ft: total_sq_ft > 0 ? round2(grand_total / total_sq_ft) : 0,
      per_1000_sq_ft: total_sq_ft > 0 ? round2((grand_total / total_sq_ft) * 1000) : 0,
      extras_pct: grand_total > 0 ? round2((extras_total / grand_total) * 100) : 0,
      premiums_pct: grand_total > 0 ? round2((premiums_total / grand_total) * 100) : 0,
      line_count: lines.length,
      missing_rates: lines.filter((l) => l.missing).length,
    },
  };
}

/** Picks the rate table in force on a given job date (never guesses a future one). */
export function selectRateTableForDate<
  T extends { effective_from: string; effective_to?: string | null; active?: boolean | null },
>(tables: T[], date: string): T | null {
  const eligible = tables
    .filter((t) => t.active !== false)
    .filter((t) => t.effective_from <= date && (!t.effective_to || t.effective_to >= date))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return eligible[0] ?? null;
}
