/**
 * Local 675 residential piecework rates, 2025–2028.
 *
 * Source: RESIDENTIAL AGREEMENT between the Interior Systems Contractors
 * Association of Ontario and Drywall Acoustic Lathing and Insulation Local 675,
 * effective May 1, 2025 – April 30, 2028, Article 6 (Wages), pages 7–13.
 * https://www.isca.ca/wp-content/uploads/2025/08/Carpenters-Local-675-Residential-Collective-Agreement.pdf
 *
 * The agreement states three rate steps, one per contract year, so this seeds
 * three rate tables and the engine picks the one in force on the job date.
 * Every number here is transcribed from that document — nothing is estimated.
 * Verify against your own copy of the agreement before relying on a total.
 */

export interface SeedRate {
  project_type: "low_rise" | "high_rise";
  category: "boarding" | "extra" | "premium";
  item_code: string;
  item_name: string;
  material?: string;
  thickness?: string;
  height_category?: string;
  unit: string;
  calculation_type: string;
  included_qty?: number;
  notes?: string;
  /** Rate for contract year 1, 2 and 3 respectively. */
  rates: [number, number, number];
}

export const LOCAL_675_AGREEMENT = {
  name: "Local 675 / ISCA Residential Agreement 2025–2028",
  local_union: "675",
  jurisdiction: "Ontario — Board Areas 8, 9, 10 and 18",
  notes:
    "Drywall Acoustic Lathing and Insulation Local 675 with the Interior Systems Contractors " +
    "Association of Ontario. Effective May 1, 2025 to April 30, 2028. Piecework applies to " +
    "residential construction only. Benefit rate 26.5%.",
};

/** One rate table per contract year, with the dates the agreement steps on. */
export const LOCAL_675_YEARS = [
  {
    version: "2025–2028 · Year 1 (May 4, 2025)",
    effective_from: "2025-05-04",
    effective_to: "2026-05-02",
  },
  {
    version: "2025–2028 · Year 2 (May 3, 2026)",
    effective_from: "2026-05-03",
    effective_to: "2027-05-01",
  },
  {
    version: "2025–2028 · Year 3 (May 2, 2027)",
    effective_from: "2027-05-02",
    effective_to: "2028-04-30",
  },
] as const;

const HEIGHT_LABEL: Record<string, string> = {
  up_to_8: "up to 8 ft",
  "8_to_9": "over 8 ft to 9 ft",
  "9_to_10": "over 9 ft to 10 ft",
  "10_to_11": "over 10 ft to 11 ft",
  "11_to_12": "over 11 ft to 12 ft",
};

/** Boarding is priced by ceiling height alone — material and thickness stay blank. */
function boarding(
  project_type: SeedRate["project_type"],
  height_category: string,
  rates: [number, number, number],
): SeedRate {
  return {
    project_type,
    category: "boarding",
    item_code: `BOARD_${height_category.toUpperCase()}`,
    item_name: `Boarding — ${HEIGHT_LABEL[height_category] ?? height_category}`,
    height_category,
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    notes: "Rate per 1000 square feet of drywall shipped and delivered (Article 6.01).",
    rates,
  };
}

function studs(height_category: string, rates: [number, number, number]): SeedRate {
  return {
    project_type: "high_rise",
    category: "extra",
    item_code: `METAL_STUD_${height_category.toUpperCase()}`,
    item_name: `Metal Studs — ${HEIGHT_LABEL[height_category] ?? height_category}`,
    unit: "linear_ft",
    calculation_type: "per_1000_linear_ft",
    notes: "Furring channel, resilient channel and J-mould are paid as light gauge steel studs.",
    rates,
  };
}

export const LOCAL_675_RATES: SeedRate[] = [
  /* ------------------------------------------- boarding — low-rise residential */
  boarding("low_rise", "up_to_8", [352, 359, 366]),
  boarding("low_rise", "8_to_9", [373, 381, 388]),
  boarding("low_rise", "9_to_10", [422, 431, 439]),
  boarding("low_rise", "10_to_11", [451, 460, 469]),
  boarding("low_rise", "11_to_12", [466, 475, 485]),

  /* ------------------------------------------ boarding — high-rise residential */
  // The agreement lists no band at or below 8 ft for high rise.
  boarding("high_rise", "8_to_9", [377, 385, 393]),
  boarding("high_rise", "9_to_10", [397, 405, 413]),
  boarding("high_rise", "10_to_11", [416, 424, 433]),
  boarding("high_rise", "11_to_12", [434, 442, 451]),

  {
    project_type: "low_rise",
    category: "boarding",
    item_code: "BOARD_STEEL_FRAMED_HOUSE",
    item_name: "Boarding — Steel Framed House",
    material: "steel_framed",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    notes:
      'Agreement, page 10: "STEEL FRAMED HOUSES — $405.00 per 1000 square feet". Seeded as a ' +
      "flat boarding rate that replaces the height-based rate. If your local practice treats it " +
      "as an addition instead, deactivate this row and add it as a premium.",
    rates: [405, 413, 421],
  },

  /* -------------------------------------------------------------- metal studs */
  studs("up_to_8", [343, 349, 357]),
  studs("8_to_9", [361, 368, 376]),
  studs("9_to_10", [384, 391, 399]),
  studs("10_to_11", [405, 413, 421]),
  studs("11_to_12", [427, 436, 444]),

  /* ------------------------------------------------------------------ extras */
  ...(["low_rise", "high_rise"] as const).flatMap((pt): SeedRate[] => [
    {
      project_type: pt,
      category: "extra",
      item_code: "CORNER_BEAD",
      item_name: "Corner Beads",
      unit: "linear_ft",
      calculation_type: "per_linear_ft",
      rates: [0.285, 0.29, 0.295],
    },
    {
      project_type: pt,
      category: "extra",
      item_code: "POT_LIGHT",
      item_name: "Pot Lights / Sprinkler Heads",
      unit: "item",
      calculation_type: "per_item",
      included_qty: 5,
      notes: 'Agreement: "Pot lights/Sprinkler Heads after Five" — the first five are included.',
      rates: [4.28, 4.37, 4.46],
    },
    {
      project_type: pt,
      category: "extra",
      item_code: "DUROCK",
      item_name: "Durock",
      unit: "sq_ft",
      calculation_type: "per_sq_ft",
      rates: [0.6, 0.61, 0.63],
    },
    {
      project_type: pt,
      category: "extra",
      item_code: "PERLITE",
      item_name: "Perlite",
      unit: "box",
      calculation_type: "per_item",
      rates: [4.0, 4.08, 4.16],
    },
  ]),

  {
    project_type: "low_rise",
    category: "extra",
    item_code: "BULLNOSE_CORNER_BEAD",
    item_name: "Bull-nose Corner Beads",
    unit: "linear_ft",
    calculation_type: "per_linear_ft",
    notes: "Listed under low-rise extras, page 10.",
    rates: [0.443, 0.451, 0.46],
  },
  {
    project_type: "high_rise",
    category: "extra",
    item_code: "SUSPENDED_CEILING",
    item_name: "Suspended Ceilings — inserts, hanger wire, 1½ and furring channel",
    unit: "sq_ft",
    calculation_type: "per_sq_ft",
    rates: [0.66, 0.68, 0.69],
  },
  {
    project_type: "high_rise",
    category: "extra",
    item_code: "SUSPENDED_CEILING_ISOLATOR",
    item_name: "Suspended Ceilings — with isolator (hangers)",
    unit: "sq_ft",
    calculation_type: "per_sq_ft",
    rates: [0.71, 0.73, 0.74],
  },

  /* ------------------------------------------------------- insulation extras */
  {
    project_type: "high_rise",
    category: "extra",
    item_code: "INSUL_INTERIOR",
    item_name: "Insulation — interior walls",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [328, 335, 342],
  },
  {
    project_type: "high_rise",
    category: "extra",
    item_code: "INSUL_EXTERIOR",
    item_name: "Insulation — exterior walls",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [389, 396, 404],
  },
  {
    project_type: "low_rise",
    category: "extra",
    item_code: "INSUL_LOW_RISE",
    item_name: "Insulation — all applied, including material",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    notes: "Low rise only. Remuneration inclusive of wages and the supply of all material.",
    rates: [617, 629, 642],
  },

  /* ---------------------------------------------------------------- premiums */
  ...(["low_rise", "high_rise"] as const).map((pt): SeedRate => ({
    project_type: pt,
    category: "premium",
    item_code: "FIRE_CODE_C",
    item_name: 'Fire Code Type "C" premium (½" and 5/8")',
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    notes: "A premium in excess of the boarding rate, for low-rise and high-rise construction.",
    rates: [105, 107, 109],
  })),
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "TOWNHOUSE",
    item_name: "Townhouse premium",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [14.02, 14.3, 14.6],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "STACK_TOWNHOUSE",
    item_name: "Stack / Back-to-Back townhouse premium",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [40.8, 41.6, 42.4],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "SKYLIGHT_2X4",
    item_name: "Skylight premium — 2×4",
    unit: "opening",
    calculation_type: "fixed",
    rates: [82, 83, 85],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "SKYLIGHT_4X4",
    item_name: "Skylight premium — 4×4",
    unit: "opening",
    calculation_type: "fixed",
    rates: [174, 178, 181],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "TRAY_WAFFLE_CEILING",
    item_name: "Tray / waffle ceiling premium",
    unit: "ceiling",
    calculation_type: "fixed",
    rates: [84, 85, 87],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "OTA_CATHEDRAL",
    item_name: "Open-to-above / cathedral ceiling premium",
    unit: "opening",
    calculation_type: "fixed",
    notes:
      "Applies where the open-to-above area is 64 square feet of floor area and 10 feet in " +
      "height, and to cathedral ceilings meeting or exceeding those dimensions. Per opening.",
    rates: [213, 217, 222],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "OPEN_ROUND_STAIRS",
    item_name: "Open round stairs to basement premium",
    unit: "each",
    calculation_type: "fixed",
    rates: [161, 164, 168],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "INSUL_R24",
    item_name: "Insulation premium — R24",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [60, 61, 63],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "INSUL_ROCKWOOL",
    item_name: "Insulation premium — Rockwool",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [79, 80, 82],
  },
  {
    project_type: "low_rise",
    category: "premium",
    item_code: "ENERGY_STAR",
    item_name: "Energy Star homes premium",
    unit: "sq_ft",
    calculation_type: "per_1000_sq_ft",
    rates: [79, 80, 82],
  },
  ...(["low_rise", "high_rise"] as const).flatMap((pt): SeedRate[] => [
    {
      project_type: pt,
      category: "premium",
      item_code: "ENTRY_DOOR_SINGLE",
      item_name: "Entry door frame — single",
      unit: "frame",
      calculation_type: "fixed",
      notes:
        "Applies to a single entry door frame within a fire rated wall assembly, including the " +
        "insulation and drywall packing within the throat of the frame. Flat across all three years.",
      rates: [87, 87, 87],
    },
    {
      project_type: pt,
      category: "premium",
      item_code: "ENTRY_DOOR_DOUBLE",
      item_name: "Entry door frame — double",
      unit: "frame",
      calculation_type: "fixed",
      notes: "Flat across all three years.",
      rates: [174, 174, 174],
    },
  ]),
];
