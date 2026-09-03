import { describe, expect, it } from "vitest";

import { csvToRateItems, parseCsv } from "./csv";
import { PROJECT_TYPE_VALUES } from "./rate-engine";

const HEADER =
  "project_type,category,item_code,item_name,material,thickness,height_category,unit,rate,calculation_type,included_qty,active,notes";

describe("csvToRateItems", () => {
  it("imports a valid per_1000_sq_ft boarding row", () => {
    const csv = `${HEADER}\nlow_rise,boarding,BOARD_UP_TO_8,Regular up to 8,regular,"1/2""",up_to_8,sq_ft,55.20,per_1000_sq_ft,0,true,`;
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.calculation_type).toBe("per_1000_sq_ft");
  });

  it("rejects a row with an unknown category instead of silently importing it", () => {
    const csv = `${HEADER}\nlow_rise,boardingx,BOARD_1,Regular,regular,"1/2""",up_to_8,sq_ft,55.20,per_1000_sq_ft,0,true,`;
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/category "boardingx"/);
  });

  it("rejects a row with an unknown calculation_type instead of silently importing it", () => {
    const csv = `${HEADER}\nlow_rise,boarding,BOARD_1,Regular,regular,"1/2""",up_to_8,sq_ft,55.20,per_squarefoot,0,true,`;
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/calculation_type "per_squarefoot"/);
  });

  it("defaults a blank calculation_type to per_unit, which is still validated", () => {
    const csv = `${HEADER}\nlow_rise,extra,RC,Resilient Channel,,,,linear_ft,2.50,,0,true,`;
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(errors).toEqual([]);
    expect(rows[0]?.calculation_type).toBe("per_unit");
  });

  it("rejects a row with an unknown project_type instead of importing an unreachable rate", () => {
    // Rates are matched on an exact project_type, so "lowrise" would never be
    // found and every line priced against it would read RATE NOT CONFIGURED.
    const csv = `${HEADER}\nlowrise,boarding,BOARD_1,Regular,regular,"1/2""",up_to_8,sq_ft,55.20,per_1000_sq_ft,0,true,`;
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/project_type "lowrise"/);
  });

  it("accepts every project type the engine prices", () => {
    const csv = [
      HEADER,
      ...PROJECT_TYPE_VALUES.map(
        (t) => `${t},extra,RC,Resilient Channel,,,,linear_ft,2.50,,0,true,`,
      ),
    ].join("\n");
    const { rows, errors } = csvToRateItems(csv, "tbl-1");
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.project_type)).toEqual(PROJECT_TYPE_VALUES);
  });
});

describe("parseCsv", () => {
  it("keeps an embedded line break as a plain newline, without a stray carriage return", () => {
    // How Excel writes a multi-line notes cell.
    const rows = parseCsv('a,"line one\r\nline two",c\r\nd,e,f');
    expect(rows[0]).toEqual(["a", "line one\nline two", "c"]);
    expect(rows[1]).toEqual(["d", "e", "f"]);
  });

  it("unescapes doubled quotes inside a quoted cell", () => {
    expect(parseCsv('a,"1/2""",c')[0]).toEqual(["a", '1/2"', "c"]);
  });
});
