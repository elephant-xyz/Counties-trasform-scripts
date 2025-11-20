// Utility mapping script - UPDATED
// Reads input.html, parses with cheerio, maps to utility schema, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textAfterStrong($el) {
  const html = $el.html() || "";
  const noStrong = html
      .replace(/<strong>[^<]*<\/strong>/i, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  return cheerio.load(`<div>${noStrong}</div>`)("div").text().trim();
}

function parseNumberFromText(txt) {
  if (!txt) return null;
  const m = (txt + "").replace(/[,\s]/g, "").match(/(-?\d+\.?\d*)/);
  return m ? Number(m[1]) : null;
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    // Extract AIN as property id
    let ain = null;
    $("div.table-section.building-table table tr td").each((i, el) => {
      const td = $(el);
      const strong = td.find("strong").first().text().trim();
      if (/^AIN$/i.test(strong)) {
        ain = textAfterStrong(td);
      }
    });
    if (!ain) {
      $("div.table-section.general-info table tr td table tr td").each(
          (i, el) => {
            const td = $(el);
            const strong = td.find("strong").first().text().trim();
            if (/^Account Number$/i.test(strong)) ain = textAfterStrong(td);
          },
      );
    }
    const propertyId = ain
        ? `property_${String(ain).trim()}`
        : "property_unknown";

    // Check Features/Yard Items for utility-related features
    let hasSprinkler = false;
    let hasPool = false;
    let hasJacuzzi = false;
    let poolSize = null;
    let yearBuilt = null;

    // Extract year built for installation dates
    $("div.table-section.building-information td").each((i, el) => {
      const td = $(el);
      const label = td.find("strong").first().text().trim();
      const val = textAfterStrong(td);
      if (/^Year Built$/i.test(label)) yearBuilt = parseNumberFromText(val);
    });

    // Parse Features/Yard Items table
    $("div.table-section.features-yard-items").each((i, sect) => {
      const heading = $(sect).find("h2.table-heading").text().trim();
      if (/Features\/Yard Items/i.test(heading)) {
        $(sect)
            .find("table tr")
            .each((j, tr) => {
              if (j === 0) return; // skip header
              const tds = $(tr).find("td");
              const type = $(tds.get(0)).text().trim().toLowerCase();
              const size = parseNumberFromText($(tds.get(2)).text().trim());

              if (type.includes("sprinkler")) {
                hasSprinkler = true;
              }
              if (type.includes("pool") && type.includes("ground")) {
                hasPool = true;
                poolSize = size;
              }
              if (type.includes("jacuzzi")) {
                hasJacuzzi = true;
              }
            });
      }
    });

    // Parse Sketched Area Legend for additional utility info
    $("div.table-section.features-yard-items").each((i, sect) => {
      const heading = $(sect).find("h2.table-heading").text().trim();
      if (/Sketched Area Legend/i.test(heading)) {
        $(sect)
            .find("table tr")
            .each((j, tr) => {
              const tds = $(tr).find("td");
              const code = $(tds.get(0)).text().trim().toUpperCase();

              if (code === "POOL") hasPool = true;
              if (code === "JACUZZI") hasJacuzzi = true;
            });
      }
    });

    // Build utilities object
    const utilities = {
      cooling_system_type: null, // Can't determine from this HTML
      heating_system_type: null, // Can't determine from this HTML
      public_utility_type: null, // Can't determine from this HTML
      sewer_type: null, // Can't determine from this HTML
      water_source_type: null, // Can't determine from this HTML
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: false, // Would need to check for SOLARPAN in features
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: hasSprinkler ? ["Sprinkler System"] : null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: yearBuilt ? `${yearBuilt}-01-01` : null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      plumbing_system_installation_date: yearBuilt ? `${yearBuilt}-01-01` : null,
      sewer_connection_date: null,
      solar_installation_date: null,
      solar_inverter_installation_date: null,
      solar_inverter_manufacturer: null,
      solar_inverter_model: null,
      water_connection_date: null,
      water_heater_installation_date: null,
      water_heater_manufacturer: null,
      water_heater_model: null,
      well_installation_date: null,
    };

    // Check for solar panels in features
    $("div.table-section.features-yard-items table tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const type = $(tds.get(0)).text().trim().toLowerCase();
      if (type.includes("solar")) {
        utilities.solar_panel_present = true;
        utilities.solar_panel_type = "Photovoltaic"; // Assume PV
      }
    });

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "utilities_data.json");
    const payload = {};
    payload[propertyId] = utilities;
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote utilities data to ${outPath}`);
  } catch (err) {
    console.error("Error generating utilities data:", err.message);
    process.exit(1);
  }
})();