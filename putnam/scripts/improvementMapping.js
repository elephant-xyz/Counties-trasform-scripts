// Property Improvement extraction script
// Extracts outbuildings and extra features from HTML and writes property_improvement JSON files

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
}

function textClean(t) {
  return t == null ? "" : String(t).replace(/\s+/g, " ").trim();
}

function parseNumber(n) {
  if (n == null) return null;
  const s = String(n).replace(/[$,\s]/g, "");
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "nan")
    return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function writeOut(filePath, obj) {
  const outPath = path.join("data", filePath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
}

// Map improvement descriptions to valid Elephant schema enum values
function mapImprovementType(description) {
  if (!description) return null;

  const desc = description.trim().toLowerCase();

  // Canopy structures -> GeneralBuilding
  if (desc.includes("canopy")) {
    return "GeneralBuilding";
  }

  // Porches -> ExteriorOpeningsAndFinishes
  if (desc.includes("porch")) {
    return "ExteriorOpeningsAndFinishes";
  }

  // Utility buildings -> GeneralBuilding
  if (desc.includes("utility")) {
    return "GeneralBuilding";
  }

  // Pole barns -> GeneralBuilding
  if (desc.includes("pole barn")) {
    return "GeneralBuilding";
  }

  // Pump houses -> GeneralBuilding
  if (desc.includes("pump house")) {
    return "GeneralBuilding";
  }

  // Baseball backstop -> SiteDevelopment
  if (desc.includes("baseball") || desc.includes("backstop")) {
    return "SiteDevelopment";
  }

  // Fencing -> Fencing
  if (desc.includes("fence") || desc.includes("fencing")) {
    return "Fencing";
  }

  // Swimming pool -> PoolSpaInstallation
  if (desc.includes("pool") || desc.includes("swimming")) {
    return "PoolSpaInstallation";
  }

  // Concrete slabs, walks, patios -> SiteDevelopment
  if (desc.includes("concrete") || desc.includes("slab") || desc.includes("walk") || desc.includes("patio")) {
    return "SiteDevelopment";
  }

  // Docks -> DockAndShore
  if (desc.includes("dock")) {
    return "DockAndShore";
  }

  // Tennis courts -> SiteDevelopment
  if (desc.includes("tennis")) {
    return "SiteDevelopment";
  }

  // Central A/C -> MechanicalHVAC
  if (desc.includes("a/c") || desc.includes("air") || desc.includes("hvac")) {
    return "MechanicalHVAC";
  }

  // Parking lot lighting -> SiteDevelopment
  if (desc.includes("parking") || desc.includes("lighting")) {
    return "SiteDevelopment";
  }

  // Default to GeneralBuilding for unrecognized types
  return "GeneralBuilding";
}

function main() {
  const htmlPath = path.join(".", "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);

  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  // Find the "Outbuildings and Extra Features" table
  const improvements = [];

  $('#details-Features .card-header:contains("Outbuildings and Extra Features")')
    .parent()
    .find('tbody tr')
    .each((i, row) => {
      const $row = $(row);
      const tds = $row.find('td');

      if (tds.length < 8) return;

      const code = textClean($(tds[0]).text());
      const description = textClean($(tds[1]).text());
      const units = parseNumber(textClean($(tds[2]).text()));
      const length = parseNumber(textClean($(tds[3]).text()));
      const width = parseNumber(textClean($(tds[4]).text()));
      const sqFootage = parseNumber(textClean($(tds[5]).text()));
      const rate = parseNumber(textClean($(tds[6]).text()));
      const amount = parseNumber(textClean($(tds[7]).text()));

      improvements.push({
        code,
        description,
        units,
        length,
        width,
        sqFootage,
        rate,
        amount
      });
    });

  console.log(`Found ${improvements.length} improvement entries`);

  // Write property_improvement JSON files
  improvements.forEach((imp, index) => {
    const improvementNumber = index + 1;

    const improvementObj = {
      improvement_type: mapImprovementType(imp.description),
      improvement_action: null,
      improvement_status: null,
      permit_number: null,
      permit_issue_date: null,
      completion_date: null,
      contractor_type: null,  // Required field
      permit_required: false,  // Required boolean field - set to false since these appear to be existing improvements
    };

    // Only include fee if we have a valid amount
    if (imp.amount != null && typeof imp.amount === 'number') {
      improvementObj.fee = imp.amount;
    }

    writeOut(`property_improvement_${improvementNumber}.json`, improvementObj);
  });

  console.log(`Wrote ${improvements.length} property_improvement JSON files`);
}

if (require.main === module) {
  main();
}

module.exports = { main, mapImprovementType };
