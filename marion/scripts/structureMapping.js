const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getPrimeKey($, html) {
  const m = html.match(/Prime Key:\s*(\d+)/i);
  if (m) return m[1].trim();
  return "unknown";
}

function getYearBuilt($) {
  let year = null;
  $("td").each((i, td) => {
    const txt = $(td).text().trim();
    const m = txt.match(/Year Built\s*(\d{4})/i);
    if (m) {
      year = parseInt(m[1], 10);
      return false;
    }
  });
  return year;
}

function getStoriesAndGFA($) {
  let stories = null;
  let gfa = null;
  $("table").each((i, tbl) => {
    const txt = $(tbl).text();
    if (/Stories/i.test(txt) && /Ground Floor Area/i.test(txt)) {
      const rows = $(tbl).find("tr");
      rows.each((rIdx, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 10) {
          const sTxt = $(tds[3]).text().trim();
          const gTxt = $(tds[8]).text().trim().replace(/,/g, "");
          const sVal = parseFloat(sTxt);
          const gVal = parseInt(gTxt, 10);
          if (!isNaN(sVal)) stories = sVal;
          if (!isNaN(gVal)) gfa = gVal;
          return false;
        }
      });
    }
  });
  return { stories, gfa };
}

function getExteriorWall($) {
  let val = null;
  $("td").each((i, td) => {
    const txt = $(td).text().trim();
    const m = txt.match(/Exterior Walls:\s*(.+)/i);
    if (m) {
      val = m[1].trim();
      return false;
    }
  });
  return val;
}

function mapExteriorMaterials(extStr) {
  if (!extStr) return { primary: null, secondary: null };
  const s = extStr.toLowerCase();
  let primary = null;
  if (s.includes("conc blk") || s.includes("concrete block")) primary = "Concrete Block";
  else if (s.includes("siding")) primary = "Wood Siding";
  return { primary, secondary: null };
}

function buildStructure($, html) {
  const primeKey = getPrimeKey($, html);
  const yearBuilt = getYearBuilt($);
  const { stories, gfa } = getStoriesAndGFA($);
  const extStr = getExteriorWall($);
  const { primary: extPrimary, secondary: extSecondary } = mapExteriorMaterials(extStr);

  const data = {
    property_structure_built_year: yearBuilt || null,
    number_of_stories: stories || null,
    finished_base_area: gfa || null,
    exterior_wall_material_primary: extPrimary || null,
    exterior_wall_material_secondary: extSecondary || null,
    exterior_wall_condition: extPrimary ? "Fair" : null
  };

  return { id: primeKey, data };
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const { id, data } = buildStructure($, html);

  const outObj = {};
  outObj[`property_${id}`] = data;

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(ownersDir);
  ensureDir(dataDir);

  fs.writeFileSync(path.join(ownersDir, "structure_data.json"), JSON.stringify(outObj, null, 2));
  fs.writeFileSync(path.join(dataDir, "structure_data.json"), JSON.stringify(outObj, null, 2));
  console.log(`Wrote structure data for property_${id} to owners/ and data/`);
})();
