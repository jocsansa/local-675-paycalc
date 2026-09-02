import { describe, expect, it } from "vitest";

import {
  boardingSheets,
  boardingSqFt,
  calculateBoarding,
  calculateExtra,
  calculateJobTotal,
  calculatePremium,
  calculateTieredRate,
  RATE_NOT_CONFIGURED,
  selectRateTableForDate,
  type EngineContext,
  type RateItem,
  type RateTier,
} from "./rate-engine";

/* ------------------------------------------------------------------ fixtures */

const TABLE = {
  id: "tbl-2026",
  version: "2026-2029 Schedule A",
  effective_from: "2026-05-01",
  effective_to: null,
  agreement_name: "Local 675 Drywall",
};

function item(over: Partial<RateItem> & Pick<RateItem, "item_code" | "category">): RateItem {
  return {
    id: `it-${over.item_code}-${over.project_type ?? "low_rise"}`,
    rate_table_id: TABLE.id,
    project_type: "low_rise",
    item_name: over.item_code,
    unit: "sq_ft",
    rate: 0,
    calculation_type: "per_sq_ft",
    ...over,
  };
}

const BOARD_REG = item({
  category: "boarding",
  item_code: "BOARD_REGULAR",
  item_name: 'Regular 1/2"',
  material: "regular",
  thickness: '1/2"',
  height_category: "up_to_10",
  rate: 0.42,
});

const BOARD_HIGH = item({
  category: "boarding",
  item_code: "BOARD_REGULAR_HR",
  item_name: 'Regular 1/2" high rise',
  project_type: "high_rise",
  material: "regular",
  thickness: '1/2"',
  height_category: "up_to_10",
  rate: 0.55,
});

const POT_LIGHT = item({
  category: "extra",
  item_code: "POT_LIGHT",
  item_name: "Pot Lights",
  unit: "item",
  calculation_type: "tiered",
  rate: 3,
  included_qty: 5,
});

const RC = item({
  category: "extra",
  item_code: "RC",
  item_name: "Resilient Channel",
  unit: "linear_ft",
  calculation_type: "per_linear_ft",
  rate: 0.35,
});

const TOWNHOUSE = item({
  category: "premium",
  item_code: "TOWNHOUSE",
  item_name: "Townhouse Premium",
  unit: "percent",
  calculation_type: "percentage",
  rate: 10,
});

const HEIGHT_PREM = item({
  category: "premium",
  item_code: "HEIGHT",
  item_name: "Height Premium",
  unit: "sq_ft",
  calculation_type: "per_sq_ft",
  rate: 0.05,
});

const POT_TIERS: RateTier[] = [
  { rate_item_id: POT_LIGHT.id, min_qty: 0, max_qty: 5, rate: 0 },
  { rate_item_id: POT_LIGHT.id, min_qty: 5, max_qty: 20, rate: 3 },
  { rate_item_id: POT_LIGHT.id, min_qty: 20, max_qty: null, rate: 2.5 },
];

const ctx: EngineContext = {
  rateTable: TABLE,
  items: [BOARD_REG, BOARD_HIGH, POT_LIGHT, RC, TOWNHOUSE, HEIGHT_PREM],
  tiers: POT_TIERS,
};

const board = (over: Partial<Parameters<typeof calculateBoarding>[2]> = {}) => ({
  id: "b1",
  material: "regular",
  thickness: '1/2"',
  height_category: "up_to_10",
  sheet_width: 4,
  sheet_height: 8,
  quantity: 100,
  entry_mode: "sheets" as const,
  ...over,
});

/* --------------------------------------------------------------------- tests */

describe("square footage", () => {
  it("multiplies width × height × quantity for sheet entry", () => {
    expect(boardingSqFt(board({ quantity: 100 }))).toBe(3200);
  });

  it("takes square feet as entered in sqft mode", () => {
    expect(boardingSqFt(board({ entry_mode: "sqft", quantity: 1234.5 }))).toBe(1234.5);
  });

  it("derives a sheet count from square feet", () => {
    expect(boardingSheets(board({ entry_mode: "sqft", quantity: 3200 }))).toBe(100);
  });
});

describe("boarding", () => {
  it("prices a configured board and records the rate source", () => {
    const line = calculateBoarding(ctx, "low_rise", board());
    expect(line.subtotal).toBe(1344); // 3200 sq ft × 0.42
    expect(line.missing).toBe(false);
    expect(line.source.rate_table_version).toBe(TABLE.version);
    expect(line.source.effective_date).toBe(TABLE.effective_from);
    expect(line.formula).toContain("3200 sq ft");
  });

  it("never invents a rate for an unconfigured combination", () => {
    const line = calculateBoarding(ctx, "low_rise", board({ material: "cement" }));
    expect(line.missing).toBe(true);
    expect(line.rate).toBeNull();
    expect(line.subtotal).toBe(0);
    expect(line.formula).toBe(RATE_NOT_CONFIGURED);
  });

  it("keeps project types separate", () => {
    expect(calculateBoarding(ctx, "high_rise", board()).subtotal).toBe(1760); // 3200 × 0.55
    expect(calculateBoarding(ctx, "commercial", board()).missing).toBe(true);
  });

  it("prices a different height category as not configured", () => {
    expect(calculateBoarding(ctx, "low_rise", board({ height_category: "over_16" })).missing).toBe(
      true,
    );
  });
});

describe("tiered rates", () => {
  it("charges only the quantity inside each band", () => {
    // 25 lights: first 5 free, next 15 at $3, last 5 at $2.50
    const r = calculateTieredRate(25, POT_TIERS);
    expect(r.amount).toBe(57.5);
    expect(r.effectiveQty).toBe(20);
  });

  it("costs nothing while inside the included band", () => {
    expect(calculateTieredRate(4, POT_TIERS).amount).toBe(0);
  });

  it("applies the tiers through calculateExtra", () => {
    const line = calculateExtra(ctx, "low_rise", {
      id: "e1",
      item_code: "POT_LIGHT",
      quantity: 25,
    });
    expect(line.subtotal).toBe(57.5);
    expect(line.detail).toBe("Tiered rate");
  });

  it("falls back to included_qty when no tier rows exist", () => {
    const noTiers: EngineContext = { ...ctx, tiers: [] };
    const line = calculateExtra(noTiers, "low_rise", {
      id: "e1",
      item_code: "POT_LIGHT",
      quantity: 8,
    });
    expect(line.subtotal).toBe(9); // (8 − 5) × 3
  });
});

describe("extras", () => {
  it("prices a per-unit extra", () => {
    const line = calculateExtra(ctx, "low_rise", { id: "e1", item_code: "RC", quantity: 200 });
    expect(line.subtotal).toBe(70);
  });

  it("flags an extra that is not on the table", () => {
    const line = calculateExtra(ctx, "low_rise", { id: "e1", item_code: "NOPE", quantity: 5 });
    expect(line.missing).toBe(true);
    expect(line.subtotal).toBe(0);
  });
});

describe("premiums", () => {
  const totals = { baseTotal: 1000, extrasTotal: 100, totalSqFt: 3200, totalSheets: 100 };

  it("applies a percentage premium to the boarding total only", () => {
    const line = calculatePremium(ctx, "low_rise", { id: "p1", item_code: "TOWNHOUSE" }, totals);
    expect(line.subtotal).toBe(100); // 10% of 1000, extras excluded
  });

  it("applies a per-sq-ft premium to the boarded area", () => {
    const line = calculatePremium(ctx, "low_rise", { id: "p1", item_code: "HEIGHT" }, totals);
    expect(line.subtotal).toBe(160); // 3200 × 0.05
  });

  it("flags an unconfigured premium", () => {
    expect(
      calculatePremium(ctx, "low_rise", { id: "p1", item_code: "MISSING" }, totals).missing,
    ).toBe(true);
  });
});

describe("job totals", () => {
  const job = {
    project_type: "low_rise",
    boarding: [board({ id: "b1", quantity: 100 }), board({ id: "b2", quantity: 50 })],
    extras: [
      { id: "e1", item_code: "RC", quantity: 200 },
      { id: "e2", item_code: "POT_LIGHT", quantity: 25 },
    ],
    premiums: [{ id: "p1", item_code: "TOWNHOUSE" }],
  };

  it("sums each section and the grand total", () => {
    const r = calculateJobTotal(job, ctx);
    expect(r.base_total).toBe(2016); // (3200 + 1600) × 0.42
    expect(r.extras_total).toBe(127.5); // 70 + 57.5
    expect(r.premiums_total).toBe(201.6); // 10% of boarding
    expect(r.grand_total).toBe(2345.1);
  });

  it("reports metrics for price analysis", () => {
    const r = calculateJobTotal(job, ctx);
    expect(r.metrics.total_sq_ft).toBe(4800);
    expect(r.metrics.total_sheets).toBe(150);
    expect(r.metrics.missing_rates).toBe(0);
    expect(r.metrics.per_1000_sq_ft).toBeCloseTo(488.56, 1);
  });

  it("counts missing rates without inflating the total", () => {
    const r = calculateJobTotal(
      { ...job, boarding: [...job.boarding, board({ id: "b3", material: "cement" })] },
      ctx,
    );
    expect(r.metrics.missing_rates).toBe(1);
    expect(r.base_total).toBe(2016);
  });

  it("records which rate table produced the number", () => {
    const r = calculateJobTotal(job, ctx);
    expect(r.rate_table_used?.version).toBe(TABLE.version);
    expect(r.effective_date).toBe(TABLE.effective_from);
  });

  it("produces the same total for a duplicated job", () => {
    const a = calculateJobTotal(job, ctx);
    const b = calculateJobTotal(JSON.parse(JSON.stringify(job)) as typeof job, ctx);
    expect(b.grand_total).toBe(a.grand_total);
  });
});

describe("rate table selection by date", () => {
  const tables = [
    { id: "old", effective_from: "2023-05-01", effective_to: "2026-04-30", active: true },
    { id: "current", effective_from: "2026-05-01", effective_to: null, active: true },
    { id: "future", effective_from: "2029-05-01", effective_to: null, active: true },
    { id: "draft", effective_from: "2026-05-01", effective_to: null, active: false },
  ];

  it("picks the table in force on the job date", () => {
    expect(selectRateTableForDate(tables, "2026-09-02")?.id).toBe("current");
  });

  it("uses the historical table for an old job", () => {
    expect(selectRateTableForDate(tables, "2024-01-15")?.id).toBe("old");
  });

  it("never reaches forward to a future table", () => {
    expect(selectRateTableForDate(tables, "2027-01-01")?.id).toBe("current");
  });

  it("ignores inactive tables", () => {
    expect(selectRateTableForDate([tables[3]!], "2026-09-02")).toBeNull();
  });

  it("returns null when nothing applies", () => {
    expect(selectRateTableForDate(tables, "2000-01-01")).toBeNull();
  });
});
