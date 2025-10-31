// Utility extractor per Elephant Lexicon schema
// - Reads input.html
// - Uses embedded Remix context and visible tables to infer HVAC, plumbing, electrical basics
// - Writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractRemixContext($) {
  let json = null;
  $("script").each((i, el) => {
    const txt = $(el).html() || "";
    const m = txt.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});?/);
    if (m && !json) {
      try {
        json = JSON.parse(m[1]);
      } catch {
        json = null;
      }
    }
  });
  return json;
}

function getPropertyId($, remix) {
  try {
    const id = remix.state.loaderData["routes/_index"].parcelInformation.number;
    if (id) return id.trim();
  } catch {}
  const h1 = $("h1").first().text();
  const m = h1.match(
    /[0-9]{2}-[0-9A-Z]{1,2}-[0-9]{2}-[0-9]{4}-[0-9]{5}-[0-9]{4}/i,
  );
  return m ? m[0] : "unknown_id";
}

function textOfCell(rows, label) {
  const row = rows.filter((i, el) =>
    cheerio
      .load(el)('th,td[role="cell"]')
      .first()
      .text()
      .trim()
      .toLowerCase()
      .startsWith(label.toLowerCase()),
  );
  if (!row.length) return null;
  const td = cheerio.load(row[0])('td[role="cell"]');
  return (td.text() || "").trim() || null;
}

function extractUtility($, remix) {
  const util = {
    cooling_system_type: null,
    heating_system_type: null,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: null,
    electrical_wiring_type_other_description: null,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    hvac_unit_condition: null,
    solar_inverter_visible: false,
    hvac_unit_issues: null,
  };

  // Prefer embedded component tags
  try {
    const comps =
      remix.state.loaderData["routes/_index"].buildings.components || [];
    const heat = comps.find(
      (c) =>
        c.category &&
        (c.category.description || "").toUpperCase().includes("HEATING"),
    );
    const ac = comps.find(
      (c) =>
        c.category &&
        (c.category.description || "")
          .toUpperCase()
          .includes("AIR CONDITIONING"),
    );

    if (
      !util.cooling_system_type &&
      ac &&
      /CENTRAL/i.test(ac.description || "")
    )
      util.cooling_system_type = "CentralAir";
    if (
      !util.heating_system_type &&
      heat &&
      /FORCED AIR/i.test(heat.description || "")
    )
      util.heating_system_type = "Central";
  } catch {}

  // Fallback to visible Building table rows (Heat Type / A/C Type)
  try {
    const buildingTable = $("caption")
      .filter((i, el) =>
        $(el).text().trim().toUpperCase().startsWith("BUILDING"),
      )
      .first()
      .closest("table");
    if (buildingTable && buildingTable.length) {
      const rows = buildingTable.find("tbody > tr");
      const heatType = textOfCell(rows, "Heat Type");
      const acType = textOfCell(rows, "A/C Type");

      if (!util.cooling_system_type && /CENTRAL/i.test(acType || ""))
        util.cooling_system_type = "CentralAir";
      if (
        !util.heating_system_type &&
        /(FORCED AIR|CENTRAL)/i.test(heatType || "")
      )
        util.heating_system_type = "Central";
    }
  } catch {}


  // Leave unknowns as null or false where appropriate due to lack of explicit evidence
  return util;
}

(function main() {
  try {
    const $ = loadHtml();
    const remix = extractRemixContext($) || {};
    const propertySeed = readJSON("property_seed.json");
    const id = propertySeed["parcel_id"];
    const utility = extractUtility($, remix);

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "utilities_data.json");

    const payload = {};
    payload[`property_${id}`] = utility;

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote utilities data for ${id} -> ${outPath}`);
  } catch (err) {
    console.error("Utility mapping failed:", err.message);
    process.exitCode = 1;
  }
})();
