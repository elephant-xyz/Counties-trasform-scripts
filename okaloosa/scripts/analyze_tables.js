const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("./input/002S2200000001A680.html", "utf8");
const $ = cheerio.load(html);

// Find all sections with tabular-data
console.log("=== Analyzing tabular-data tables ===\n");

$("section").each((sectionIdx, section) => {
  const title = $(section).find(".module-header .title").first().text().trim();
  const tables = $(section).find("table.tabular-data");

  if (tables.length > 0) {
    console.log(`\nSection: ${title}`);
    console.log(`Number of tabular-data tables: ${tables.length}`);

    tables.each((tableIdx, table) => {
      console.log(`\n  Table ${tableIdx + 1}:`);

      // Get headers
      const headers = [];
      $(table).find("thead tr th").each((i, th) => {
        headers.push($(th).text().trim());
      });
      console.log(`  Headers: ${headers.join(" | ")}`);

      // Show first few rows
      $(table).find("tbody tr").slice(0, 3).each((rowIdx, row) => {
        const cells = [];
        $(row).find("td").each((cellIdx, cell) => {
          cells.push($(cell).text().trim().substring(0, 50));
        });
        console.log(`    Row ${rowIdx + 1}: ${cells.join(" | ")}`);
      });

      const rowCount = $(table).find("tbody tr").length;
      console.log(`  Total rows: ${rowCount}`);
    });
  }
});

// Check for permit grids
console.log("\n\n=== Analyzing permit data ===\n");
const permitGrid = $("#ctlBodyPane_ctl12_ctl01_grdPermits_grdFlat");
if (permitGrid.length > 0) {
  console.log("Found permit grid");
  const permitRows = permitGrid.find("tbody tr").length;
  console.log(`Permit rows: ${permitRows}`);

  // Show first permit
  const firstRow = permitGrid.find("tbody tr").first();
  firstRow.find("td").each((idx, cell) => {
    console.log(`  Cell ${idx + 1}: ${$(cell).text().trim().substring(0, 100)}`);
  });
}

// Check for sketches
console.log("\n\n=== Analyzing sketches ===\n");
const sketches = $(".sketch-thumbnail");
console.log(`Found ${sketches.length} sketch thumbnails`);
sketches.slice(0, 3).each((idx, sketch) => {
  const caption = $(sketch).find(".sketch-thumbnail-caption").text().trim();
  console.log(`  Sketch ${idx + 1}: ${caption}`);
});

// Check last updated
console.log("\n\n=== Last Updated ===\n");
const lastUpdated = $("#hlkLastUpdated").text().trim();
console.log(`Last Updated: ${lastUpdated}`);
