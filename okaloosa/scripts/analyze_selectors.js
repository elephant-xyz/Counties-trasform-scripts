const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("../input/002S2200000001A680.html", "utf8");
const $ = cheerio.load(html);

const errors = fs.readFileSync("../errors.csv", "utf8").split("\n").slice(1);

const selectors = errors
  .filter(line => line.trim())
  .map(line => {
    const parts = line.split(",");
    return parts[0];
  });

// Get unique selectors
const uniqueSelectors = [...new Set(selectors)];

console.log(`Total unique selectors: ${uniqueSelectors.length}`);
console.log("\nSample data from first 20 selectors:\n");

uniqueSelectors.slice(0, 20).forEach(selector => {
  try {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      console.log(`Selector: ${selector}`);
      console.log(`Value: ${text}`);
      console.log("---");
    }
  } catch (e) {
    console.log(`Error with selector: ${selector}`);
  }
});
