import type { RateItem } from "./rate-engine";

/**
 * Rate table CSV interchange. Column order is the spreadsheet order used by the
 * Rate Manager so an exported file can be edited in Excel and imported back.
 */
export const RATE_CSV_HEADERS = [
  "project_type",
  "category",
  "item_code",
  "item_name",
  "material",
  "thickness",
  "height_category",
  "unit",
  "rate",
  "calculation_type",
  "included_qty",
  "active",
  "notes",
] as const;

type Header = (typeof RATE_CSV_HEADERS)[number];

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rateItemsToCsv(items: RateItem[]): string {
  const lines = [RATE_CSV_HEADERS.join(",")];
  for (const i of items) {
    lines.push(
      [
        i.project_type,
        i.category,
        i.item_code,
        i.item_name,
        i.material ?? "",
        i.thickness ?? "",
        i.height_category ?? "",
        i.unit,
        String(i.rate),
        i.calculation_type,
        String(i.included_qty ?? 0),
        i.active === false ? "false" : "true",
        i.notes ?? "",
      ]
        .map((c) => escapeCell(String(c)))
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/** RFC-4180 style parser: handles quoted cells, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const src = text.replace(/^\uFEFF/, ""); // strip a UTF-8 BOM from Excel exports
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface CsvImportResult {
  rows: Omit<RateItem, "id">[];
  errors: string[];
}

/**
 * Turns a CSV into rate rows for one rate table. Rows with a missing required
 * column or an unparseable rate are reported instead of silently dropped — the
 * engine must never receive a guessed rate.
 */
export function csvToRateItems(text: string, rateTableId: string): CsvImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const out: Omit<RateItem, "id">[] = [];

  const headerRow = rows[0];
  if (!headerRow) return { rows: [], errors: ["The file is empty."] };

  const header = headerRow.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const index = (name: Header) => header.indexOf(name);

  const required: Header[] = ["project_type", "category", "item_code", "item_name", "unit", "rate"];
  const missing = required.filter((c) => index(c) === -1);
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }

  const at = (row: string[], name: Header): string => {
    const i = index(name);
    return i === -1 ? "" : (row[i] ?? "").trim();
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const line = r + 1;

    const rateRaw = at(row, "rate");
    const rate = Number(rateRaw);
    if (rateRaw === "" || Number.isNaN(rate)) {
      errors.push(`Line ${line}: rate "${rateRaw}" is not a number — row skipped.`);
      continue;
    }
    const itemCode = at(row, "item_code");
    if (!itemCode) {
      errors.push(`Line ${line}: item_code is empty — row skipped.`);
      continue;
    }

    const includedRaw = at(row, "included_qty");
    const activeRaw = at(row, "active").toLowerCase();

    out.push({
      rate_table_id: rateTableId,
      project_type: at(row, "project_type"),
      category: at(row, "category"),
      item_code: itemCode,
      item_name: at(row, "item_name") || itemCode,
      material: at(row, "material") || null,
      thickness: at(row, "thickness") || null,
      height_category: at(row, "height_category") || null,
      unit: at(row, "unit"),
      rate,
      calculation_type: at(row, "calculation_type") || "per_unit",
      included_qty: includedRaw === "" ? 0 : Number(includedRaw) || 0,
      active: activeRaw === "" ? true : activeRaw !== "false" && activeRaw !== "0",
      notes: at(row, "notes") || null,
    });
  }

  return { rows: out, errors };
}

/**
 * A blank rate sheet: every row a table normally needs, with the `rate` column
 * left empty on purpose. The rates must be typed in from the agreement — the
 * import rejects rows whose rate is empty, so nothing can be invented here.
 */
export function rateTemplateCsv(): string {
  const materials = ["regular", "type_x", "moisture"];
  const thicknesses = ['1/2"', '5/8"'];
  const heights = ["up_to_10", "10_to_12", "12_to_16", "over_16"];
  const projectTypes = ["low_rise", "high_rise", "commercial"];

  const extras: [string, string, string, string, string][] = [
    ["RC", "Resilient Channel", "linear_ft", "per_linear_ft", "0"],
    ["CORNER_BEAD", "Corner Bead", "linear_ft", "per_linear_ft", "0"],
    ["POT_LIGHT", "Pot Lights", "item", "tiered", "5"],
    ["SPRINKLER", "Sprinkler Heads", "item", "per_item", "0"],
    ["SKYLIGHT", "Skylights", "item", "per_item", "0"],
    ["SHAFTWALL", "Shaftwall", "sq_ft", "per_sq_ft", "0"],
    ["ACCESS_PANEL", "Access Panels", "item", "per_item", "0"],
    ["BULKHEAD", "Bulkheads", "linear_ft", "per_linear_ft", "0"],
    ["ARCHWAY", "Archways", "item", "per_item", "0"],
    ["COLUMN_WRAP", "Column Wraps", "item", "per_item", "0"],
  ];

  const premiums: Record<string, [string, string, string, string][]> = {
    low_rise: [
      ["TOWNHOUSE", "Townhouse Premium", "percent", "percentage"],
      ["STEEL_FRAME", "Steel Frame Premium", "percent", "percentage"],
      ["FIRE_CODE", "Fire Code Premium", "sq_ft", "per_sq_ft"],
    ],
    high_rise: [
      ["HIGH_RISE", "High Rise Premium", "percent", "percentage"],
      ["HEIGHT", "Height Premium", "sq_ft", "per_sq_ft"],
      ["FIRE_CODE", "Fire Code Premium", "sq_ft", "per_sq_ft"],
    ],
    commercial: [
      ["HEIGHT", "Height Premium", "sq_ft", "per_sq_ft"],
      ["FIRE_CODE", "Fire Code Premium", "sq_ft", "per_sq_ft"],
      ["STEEL_FRAME", "Steel Frame Premium", "percent", "percentage"],
    ],
  };

  const materialName: Record<string, string> = {
    regular: "Regular Board",
    type_x: "Type X Fire Rated",
    moisture: "Moisture Resistant",
  };

  const rows: string[][] = [];
  for (const pt of projectTypes) {
    for (const m of materials) {
      for (const th of thicknesses) {
        for (const h of heights) {
          rows.push([
            pt,
            "boarding",
            `BOARD_${m.toUpperCase()}_${th.replace(/\D/g, "")}_${h.toUpperCase()}`,
            `${materialName[m] ?? m} ${th}`,
            m,
            th,
            h,
            "sq_ft",
            "", // rate — fill in from the agreement
            "per_sq_ft",
            "0",
            "true",
            "",
          ]);
        }
      }
    }
    for (const [code, name, unit, calc, included] of extras) {
      rows.push([pt, "extra", code, name, "", "", "", unit, "", calc, included, "true", ""]);
    }
    for (const [code, name, unit, calc] of premiums[pt] ?? []) {
      rows.push([pt, "premium", code, name, "", "", "", unit, "", calc, "0", "true", ""]);
    }
  }

  return [
    RATE_CSV_HEADERS.join(","),
    ...rows.map((r) => r.map((c) => escapeCell(c)).join(",")),
  ].join("\r\n");
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
