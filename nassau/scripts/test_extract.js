const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Extract owner HTML
const ownershipHtml = $(".parcel-info .parcel-detail .ownership").html();
console.log("=== Ownership HTML ===");
console.log(ownershipHtml);
console.log("\n=== After removing <p> tags ===");
const htmlWithoutAddresses = ownershipHtml.replace(/<p>.*?<\/p>/gs, '');
console.log(htmlWithoutAddresses);
console.log("\n=== After splitting by <br> ===");
const ownerLines = htmlWithoutAddresses.split(/<br\s*\/?>/i)
  .map(line => line.replace(/<[^>]*>/g, '').trim())
  .filter(line => line.length > 0);
console.log(JSON.stringify(ownerLines, null, 2));
