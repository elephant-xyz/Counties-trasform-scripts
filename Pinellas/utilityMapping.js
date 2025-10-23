const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractStrap($, rawHtml) {
  let strap = null;
  const scriptsText = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scriptsText.match(/var\s+g_strap\s*=\s*"(\d+)"/);
  if (m) strap = m[1];
  if (!strap) {
    const pn = $("#pacel_no").text().trim();
    if (pn) strap = pn.replace(/\D/g, "");
  }
  return strap || "unknown_id";
}

/**
 * Extracts key-value pairs from a specific "Structural Elements" table.
 * This function is designed to work for a single building's structural elements.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @param {string} panelId - The ID of the structural panel (e.g., 'structural_1').
 * @returns {Object} A map of structural elements.
 */
function extractStructuralKeyValues($, panelId) {
  const map = {};
  const $panel = $(`#${panelId}`);
  const $structTable = $panel.find("table.table-bordered").filter((i, tbl) => {
    return $(tbl).find("thead th").first().text().trim().toLowerCase().includes("structural elements");
  }).first();

  if ($structTable.length > 0) {
    $structTable.find("tbody tr").each((i, tr) => {
      const k = $(tr).find("td").eq(0).text().trim().replace(/:$/, "");
      const v = $(tr).find("td").eq(1).text().trim();
      if (k) map[k] = v;
    });
  }
  return map;
}

/**
 * Infers utility details from the HTML content.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @param {string} requestIdentifier - The identifier for the request.
 * @param {object} sourceHttpRequest - The source HTTP request details.
 * @returns {object} An object containing inferred utility properties.
 */
function inferUtilities($, requestIdentifier, sourceHttpRequest) {
  // Extract structural key values for Building 1 (assuming primary structure for utility info)
  const kv = extractStructuralKeyValues($, 'structural_1');

  // Heating and cooling
  let heating_system_type = null;
  let cooling_system_type = null;

  // Check for "Cooling" in structural elements
  const coolTxt = (kv["Cooling"] || "").toLowerCase();
  if (coolTxt.includes("heat & cooling pkg") || coolTxt.includes("central")) {
    cooling_system_type = "CentralAir";
    // If it's a package, it likely includes heating too
    heating_system_type = "HeatPump"; // Common for heat & cooling packages
  } else if (coolTxt.includes("none")) {
    cooling_system_type = null;
  }

  // Check for "Heating" in structural elements (if present, might override/refine)
  const heatTxt = (kv["Heating"] || "").toLowerCase();
  if (heatTxt.includes("central")) {
    heating_system_type = "Central";
  } else if (heatTxt.includes("electric")) {
    heating_system_type = "Electric";
  } else if (heatTxt.includes("gas")) {
    heating_system_type = "Gas";
  }



  const public_utility_type = null;

  const sewer_type = null;

  const water_source_type = null;

  // Solar panel presence and type
  let solar_panel_present = false;
  let solar_panel_type = null;
  let solar_inverter_visible = false; // Not directly inferable from HTML

  // Check Extra Features table for "SOLAR"
  const hasSolarFeature = $("#tblExtraFeatures tbody tr td").filter((i, el) =>
    /solar/i.test($(el).text())
  ).length > 0;

  // Check Permit Data table for "SOLAR PANELS" description
  const solarPermit = $("#tblPermit tbody tr").filter((i, tr) =>
    /solar panels/i.test($(tr).find("td").eq(1).text() || "")
  ).length > 0;

  if (hasSolarFeature || solarPermit) {
    solar_panel_present = true;
    // solar_panel_type = "Photovoltaic";
  }

  // Construct the utility object, filling in required fields with null if not found
  return {
    request_identifier: requestIdentifier,
    source_http_request: sourceHttpRequest,

    cooling_system_type: cooling_system_type,
    heating_system_type: heating_system_type,
    public_utility_type: public_utility_type,
    sewer_type: sewer_type,
    water_source_type: water_source_type,

    plumbing_system_type: null, // Not in HTML
    plumbing_system_type_other_description: null, // Not in HTML

    electrical_panel_capacity: null, // Not in HTML
    electrical_wiring_type: null, // Not in HTML
    hvac_condensing_unit_present: null, // Not in HTML
    electrical_wiring_type_other_description: null, // Not in HTML

    solar_panel_present: solar_panel_present,
    solar_panel_type: solar_panel_type,
    solar_panel_type_other_description: null, // Not in HTML

    smart_home_features: null, // Not in HTML (schema expects array or null)
    smart_home_features_other_description: null, // Not in HTML

    hvac_unit_condition: null, // Not in HTML
    solar_inverter_visible: solar_inverter_visible, // Not directly inferable, default to false
    hvac_unit_issues: null, // Not in HTML
  };
}

(function main() {
  try {
    const rawHtml = fs.readFileSync("input.html", "utf8");
    const $ = cheerio.load(rawHtml);

    const strap = extractStrap($, rawHtml);

    // Define request_identifier and source_http_request
    const requestIdentifier = strap;
    const sourceHttpRequest = {
      method: "GET",
      url: `https://www.pcpao.gov/property-details?s=${strap}`, // Example URL
    };

    const utility = inferUtilities($, requestIdentifier, sourceHttpRequest);

    const outDir = path.join("owners");
    ensureDir(outDir);
    const outPath = path.join(outDir, "utilities_data.json");

    const key = `property_${strap}`;
    const payload = {};
    payload[key] = utility; // Wrap the utility object under the property key

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote utility data for ${key} to ${outPath}`);
  } catch (err) {
    console.error("Error building utility data:", err);
    process.exit(1);
  }
})();
