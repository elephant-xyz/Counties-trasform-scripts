// layoutMapping.js
// Reads input.json and produces owners/layout_data.json with an array of layout objects per required schema fields.
const fs = require("fs");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function makeBaseLayout(
  space_type,
  space_index,
  floor_level,
  size_square_feet,
  has_windows,
) {
  return {
    space_type,
    space_index,
    flooring_material_type: null,
    size_square_feet,
    floor_level,
    has_windows,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
  };
}

try {
  const input = JSON.parse(fs.readFileSync("input.json", "utf-8"));
  const propId = input.apprId || input.parcelNumber || "unknown";
  const layouts = [];

  // Bedrooms
  const bedrooms = Number(input.bedrooms) || 0;
  for (let i = 1; i <= bedrooms; i++) {
    layouts.push(makeBaseLayout("Bedroom", i, "1st Floor", null, true));
  }

  // Bathrooms: represent each as Full Bathroom where bathrooms is 2.0
  const baths = Number(input.bathrooms) || 0;
  for (let i = 1; i <= Math.floor(baths); i++) {
    layouts.push(makeBaseLayout("Full Bathroom", i, "1st Floor", null, false));
  }
  if (baths % 1 !== 0) {
    layouts.push(
      makeBaseLayout(
        "Half Bathroom / Powder Room",
        Math.ceil(baths),
        "1st Floor",
        null,
        false,
      ),
    );
  }

  // Living spaces
  layouts.push(makeBaseLayout("Living Room", 1, "1st Floor", null, true));
  layouts.push(makeBaseLayout("Kitchen", 1, "1st Floor", null, true));

  // Exterior features from extraFeatureDetails
  if (Array.isArray(input.extraFeatureDetails)) {
    const hasScreenPatio = input.extraFeatureDetails.some((f) =>
      /SCREEN\s*PATIO/i.test(f.exftNotes || f.exFtDescription || ""),
    );
    const hasCarport = input.extraFeatureDetails.some((f) =>
      /CARPORT/i.test(f.exftNotes || f.exFtDescription || ""),
    );
    if (hasScreenPatio) {
      const l = makeBaseLayout("Screened Porch", 1, "1st Floor", null, true);
      l.is_exterior = true;
      l.is_finished = true;
      layouts.push(l);
    }
    if (hasCarport) {
      const l = makeBaseLayout("Carport", 1, "1st Floor", null, false);
      l.is_exterior = true;
      l.is_finished = false;
      layouts.push(l);
    }
  }

  const out = {
    [`property_${propId}`]: {
      layouts,
    },
  };

  ensureDir("owners");
  fs.writeFileSync("owners/layout_data.json", JSON.stringify(out, null, 2));
  console.log(
    "Wrote owners/layout_data.json for",
    `property_${propId}`,
    "with",
    layouts.length,
    "layouts",
  );
} catch (e) {
  console.error("Error creating layout mapping:", e.message);
  process.exit(1);
}
