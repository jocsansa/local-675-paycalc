import { describe, expect, it } from "vitest";

import {
  ANY_VALUE,
  boardingDimensions,
  boardingSheets,
  boardingSqFt,
  calculateBoarding,
  calculateExtra,
  calculateJobTotal,
  calculatePremium,
  calculateTieredRate,
  compareHeights,
  heightLabel,
  RATE_NOT_CONFIGURED,
  round2,
  selectRateTableForDate,
  type EngineContext,
  type RateItem,
  type RateTier,
} from "./rate-engine";
import { LOCAL_675_RATES, LOCAL_675_YEARS } from "../data/local675-2025-2028";

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

describe("per-1000 pricing", () => {
  // Local 675 quotes boarding per 1000 square feet, not per square foot.
  const per1000 = item({
    category: "boarding",
    item_code: "BOARD_9_TO_10",
    item_name: "Boarding — over 9 ft to 10 ft",
    height_category: "9_to_10",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rate: 422,
  });
  const ctx1000: EngineContext = { rateTable: TABLE, items: [per1000], tiers: [] };

  it("divides the quantity by 1000 before applying the rate", () => {
    const line = calculateBoarding(
      ctx1000,
      "low_rise",
      board({
        material: "",
        thickness: null,
        height_category: "9_to_10",
        quantity: 1000,
        entry_mode: "sqft",
      }),
    );
    expect(line.subtotal).toBe(422);
    expect(line.formula).toContain("÷ 1000");
  });

  it("scales correctly for a real sheet count", () => {
    // 100 sheets of 4×8 = 3200 sq ft → 3.2 × $422
    const line = calculateBoarding(
      ctx1000,
      "low_rise",
      board({ material: "", thickness: null, height_category: "9_to_10" }),
    );
    expect(line.subtotal).toBe(1350.4);
  });

  it("would have been 1000x wrong under flat per-unit pricing", () => {
    const flat: EngineContext = {
      ...ctx1000,
      items: [{ ...per1000, calculation_type: "per_sq_ft" }],
    };
    const line = calculateBoarding(
      flat,
      "low_rise",
      board({
        material: "",
        thickness: null,
        height_category: "9_to_10",
        quantity: 1000,
        entry_mode: "sqft",
      }),
    );
    expect(line.subtotal).toBe(422000);
  });
});

describe("wildcard rate matching", () => {
  // A row that leaves material and thickness blank prices any board at that height.
  const byHeightOnly = item({
    category: "boarding",
    item_code: "BOARD_8_TO_9",
    item_name: "Boarding — over 8 ft to 9 ft",
    material: null,
    thickness: null,
    height_category: "8_to_9",
    calculation_type: "per_1000_sq_ft",
    rate: 373,
  });

  it("matches whatever material and thickness the line carries", () => {
    const c: EngineContext = { rateTable: TABLE, items: [byHeightOnly], tiers: [] };
    const line = calculateBoarding(
      c,
      "low_rise",
      board({ material: "type_x", thickness: '5/8"', height_category: "8_to_9" }),
    );
    expect(line.missing).toBe(false);
    expect(line.rate).toBe(373);
  });

  it("still requires the height band to match", () => {
    const c: EngineContext = { rateTable: TABLE, items: [byHeightOnly], tiers: [] };
    expect(
      calculateBoarding(c, "low_rise", board({ material: "", height_category: "11_to_12" }))
        .missing,
    ).toBe(true);
  });

  it("prefers the most specific row when several match", () => {
    const specific = item({
      category: "boarding",
      item_code: "BOARD_8_TO_9_TYPEX",
      item_name: "Type X exception",
      material: "type_x",
      thickness: null,
      height_category: "8_to_9",
      calculation_type: "per_1000_sq_ft",
      rate: 999,
    });
    const c: EngineContext = { rateTable: TABLE, items: [byHeightOnly, specific], tiers: [] };
    const line = calculateBoarding(
      c,
      "low_rise",
      board({ material: "type_x", thickness: null, height_category: "8_to_9" }),
    );
    expect(line.rate).toBe(999);
  });
});

describe("Local 675 2025–2028 schedule", () => {
  const yearCtx = (year: 0 | 1 | 2): EngineContext => ({
    rateTable: { ...TABLE, version: LOCAL_675_YEARS[year]!.version },
    items: LOCAL_675_RATES.map((r, idx) => ({
      id: `seed-${idx}`,
      rate_table_id: TABLE.id,
      project_type: r.project_type,
      category: r.category,
      item_code: r.item_code,
      item_name: r.item_name,
      material: r.material ?? null,
      thickness: r.thickness ?? null,
      height_category: r.height_category ?? null,
      unit: r.unit,
      rate: r.rates[year],
      calculation_type: r.calculation_type,
      included_qty: r.included_qty ?? 0,
      active: true,
    })),
    tiers: [],
  });

  it("carries the ceiling-height ladder the agreement actually uses", () => {
    const bands = LOCAL_675_RATES.filter(
      (r) => r.category === "boarding" && r.project_type === "low_rise" && r.height_category,
    ).map((r) => r.height_category);
    expect(bands).toEqual(["up_to_8", "8_to_9", "9_to_10", "10_to_11", "11_to_12"]);
  });

  it("prices low-rise boarding at the published rate for each year", () => {
    const line = (year: 0 | 1 | 2) =>
      calculateBoarding(
        yearCtx(year),
        "low_rise",
        board({
          material: "",
          thickness: null,
          height_category: "9_to_10",
          quantity: 1000,
          entry_mode: "sqft",
        }),
      ).subtotal;
    expect(line(0)).toBe(422);
    expect(line(1)).toBe(431);
    expect(line(2)).toBe(439);
  });

  it("has no high-rise band at or below 8 ft, as the agreement omits one", () => {
    const line = calculateBoarding(
      yearCtx(0),
      "high_rise",
      board({ material: "", thickness: null, height_category: "up_to_8" }),
    );
    expect(line.missing).toBe(true);
  });

  it("includes the first five pot lights and charges the rest", () => {
    const line = calculateExtra(yearCtx(0), "low_rise", {
      id: "e1",
      item_code: "POT_LIGHT",
      quantity: 12,
    });
    expect(line.subtotal).toBe(round2(7 * 4.28));
  });

  it("applies the fire code premium per 1000 sq ft of boarding", () => {
    const line = calculatePremium(
      yearCtx(0),
      "low_rise",
      { id: "p1", item_code: "FIRE_CODE_C" },
      { baseTotal: 4220, extrasTotal: 0, totalSqFt: 10000, totalSheets: 312.5 },
    );
    expect(line.subtotal).toBe(1050); // 10 × $105
  });

  it("totals a low-rise job the way the agreement reads", () => {
    const r = calculateJobTotal(
      {
        project_type: "low_rise",
        boarding: [
          board({
            id: "b1",
            material: "",
            thickness: null,
            height_category: "9_to_10",
            quantity: 10000,
            entry_mode: "sqft",
          }),
        ],
        extras: [{ id: "e1", item_code: "CORNER_BEAD", quantity: 500 }],
        premiums: [{ id: "p1", item_code: "TOWNHOUSE" }],
      },
      yearCtx(1),
    );
    expect(r.base_total).toBe(4310); // 10 × $431
    expect(r.extras_total).toBe(145); // 500 × $0.29
    expect(r.premiums_total).toBe(143); // 10 × $14.30
    expect(r.grand_total).toBe(4598);
    expect(r.metrics.missing_rates).toBe(0);
  });
});

describe("height band labels", () => {
  it("reads the agreement's own bands", () => {
    expect(heightLabel("up_to_8")).toBe("Up to and including 8 ft");
    expect(heightLabel("8_to_9")).toBe("Over 8 ft up to and including 9 ft");
  });

  it("still reads bands this build does not know, instead of showing a raw code", () => {
    // Bands from a table imported before the ladder was corrected.
    expect(heightLabel("up_to_10")).toBe("Up to and including 10 ft");
    expect(heightLabel("10_to_12")).toBe("Over 10 ft up to and including 12 ft");
    expect(heightLabel("12_to_16")).toBe("Over 12 ft up to and including 16 ft");
    expect(heightLabel("over_16")).toBe("Over 16 ft");
  });

  it("calls a blank band Any", () => {
    expect(heightLabel(null)).toBe("Any");
    expect(heightLabel("")).toBe("Any");
  });

  it("falls back to the raw value for something unparseable", () => {
    expect(heightLabel("weird_band")).toBe("weird_band");
  });

  it("orders unknown bands by the feet in the code", () => {
    // The order these came back in before the fix: over_16, 12_to_16, up_to_10, 10_to_12.
    expect(["over_16", "12_to_16", "up_to_10", "10_to_12"].sort(compareHeights)).toEqual([
      "up_to_10",
      "10_to_12",
      "12_to_16",
      "over_16",
    ]);
  });

  it("orders a mixed ladder correctly", () => {
    expect(["over_12", "up_to_8", "10_to_11", "8_to_9"].sort(compareHeights)).toEqual([
      "up_to_8",
      "8_to_9",
      "10_to_11",
      "over_12",
    ]);
  });
});

describe("boarding form options", () => {
  const items = LOCAL_675_RATES.map((r, idx) => ({
    id: `seed-${idx}`,
    rate_table_id: TABLE.id,
    project_type: r.project_type,
    category: r.category,
    item_code: r.item_code,
    item_name: r.item_name,
    material: r.material ?? null,
    thickness: r.thickness ?? null,
    height_category: r.height_category ?? null,
    unit: r.unit,
    rate: r.rates[0],
    calculation_type: r.calculation_type,
    included_qty: r.included_qty ?? 0,
    active: true,
  }));

  it("offers the low-rise ladder starting at the 8 ft band", () => {
    expect(boardingDimensions(items, "low_rise").heights).toEqual([
      "up_to_8",
      "8_to_9",
      "9_to_10",
      "10_to_11",
      "11_to_12",
    ]);
  });

  it("starts high rise at the 8-to-9 band, matching the agreement", () => {
    expect(boardingDimensions(items, "high_rise").heights).toEqual([
      "8_to_9",
      "9_to_10",
      "10_to_11",
      "11_to_12",
    ]);
  });

  it("keeps the height-priced rate reachable next to the steel framed rate", () => {
    const materials = boardingDimensions(items, "low_rise").materials;
    expect(materials.map((m) => m.value)).toEqual([ANY_VALUE, "steel_framed"]);
    expect(materials[0]?.label).toBe("Not specified");
  });

  it("hides the material picker for high rise, which prices by height alone", () => {
    expect(boardingDimensions(items, "high_rise").materials).toEqual([]);
  });

  it("never offers a thickness, because the agreement does not price on one", () => {
    expect(boardingDimensions(items, "low_rise").thicknesses).toEqual([]);
    expect(boardingDimensions(items, "high_rise").thicknesses).toEqual([]);
  });

  it("brings the pickers back for an agreement that prices by board type", () => {
    const dims = boardingDimensions(
      [
        item({
          category: "boarding",
          item_code: "A",
          material: "regular",
          thickness: '1/2"',
          height_category: "up_to_8",
        }),
        item({
          category: "boarding",
          item_code: "B",
          material: "type_x",
          thickness: '5/8"',
          height_category: "up_to_8",
        }),
      ],
      "low_rise",
    );
    expect(dims.materials.map((m) => m.value)).toEqual(["regular", "type_x"]);
    expect(dims.thicknesses.map((t) => t.value)).toEqual(['1/2"', '5/8"']);
  });

  it("ignores deactivated rows", () => {
    const withRetired = [
      ...items,
      item({
        category: "boarding",
        item_code: "OLD",
        height_category: "over_12",
        active: false,
      }),
    ];
    expect(boardingDimensions(withRetired, "low_rise").heights).not.toContain("over_12");
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
