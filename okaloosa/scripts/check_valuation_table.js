const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("./input/002S2200000001A680.html", "utf8");
const $ = cheerio.load(html);

console.log("=== Valuation Table Analysis ===\n");

// Find the valuation section
const section = $("section").filter((_, s) => {
  const title = $(s).find(".module-header .title").first().text().trim();
  return title === "Valuation";
}).first();

if (section.length > 0) {
  console.log("Found Valuation section\n");

  const table = $(section).find("table.tabular-data");

  // Get all header columns
  console.log("Headers:");
  table.find("thead tr th").each((idx, th) => {
    console.log(`  Column ${idx}: ${$(th).text().trim()}`);
  });

  console.log("\nRows:");
  table.find("tbody tr").each((rowIdx, tr) => {
    const label = $(tr).find("th").text().trim();
    console.log(`  Row ${rowIdx + 1}: ${label}`);

    const cells = [];
    $(tr).find("td.value-column").each((cellIdx, td) => {
      cells.push($(td).text().trim());
    });
    console.log(`    Values: ${cells.join(" | ")}`);
  });
}

console.log("\n\n=== Extra Features Table ===\n");
const extraSection = $("section").filter((_, s) => {
  const title = $(s).find(".module-header .title").first().text().trim();
  return title === "Extra Features";
}).first();

if (extraSection.length > 0) {
  const table = $(extraSection).find("table.tabular-data");
  console.log("Headers:");
  table.find("thead tr th").each((idx, th) => {
    console.log(`  Column ${idx}: ${$(th).text().trim()}`);
  });

  console.log(`\nTotal rows: ${table.find("tbody tr").length}`);
  console.log("\nFirst 5 rows:");
  table.find("tbody tr").slice(0, 5).each((rowIdx, tr) => {
    const cells = [];
    $(tr).find("td").each((cellIdx, td) => {
      const text = $(td).text().trim().substring(0, 50);
      cells.push(text);
    });
    console.log(`  Row ${rowIdx + 1}: ${cells.join(" | ")}`);
  });
}

console.log("\n\n=== Building Area Types Table ===\n");
const areaSection = $("section").filter((_, s) => {
  const title = $(s).find(".module-header .title").first().text().trim();
  return title === "Building Area Types";
}).first();

if (areaSection.length > 0) {
  const table = $(areaSection).find("table.tabular-data");
  console.log("Headers:");
  table.find("thead tr th").each((idx, th) => {
    console.log(`  Column ${idx}: ${$(th).text().trim()}`);
  });

  console.log(`\nTotal rows: ${table.find("tbody tr").length}`);
  console.log("\nSample rows:");
  table.find("tbody tr").slice(0, 5).each((rowIdx, tr) => {
    const cells = [];
    $(tr).find("td").each((cellIdx, td) => {
      const text = $(td).text().trim();
      cells.push(text);
    });
    console.log(`  Row ${rowIdx + 1}: ${cells.join(" | ")}`);
  });
}

console.log("\n\n=== Owner Information ===\n");
const ownerName = $("#ctlBodyPane_ctl01_ctl01_rptOwner_ctl00_sprOwnerName1_lnkUpmSearchLinkSuppressed_lnkSearch").text().trim();
const ownerAddress = $("#ctlBodyPane_ctl01_ctl01_rptOwner_ctl00_lblOwnerAddress").text().trim();
console.log(`Owner Name: ${ownerName}`);
console.log(`Owner Address: ${ownerAddress}`);
