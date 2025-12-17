const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

function normalizeSpace(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

// Extract current owner candidates from the Owners section
function extractCurrentOwnerCandidates($) {
  const owners = [];
  $(".parcel-info .parcel-detail .ownership > div").each((i, el) => {
    const clone = $(el).clone();
    clone.find("p").remove();
    const raw = normalizeSpace(
      clone
        .text()
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    );
    console.log(`Current owner candidate ${i}: "${raw}"`);
    if (raw) owners.push(raw);
  });
  return owners;
}

const currentCandidates = extractCurrentOwnerCandidates($);
console.log('\nExtracted current owner candidates:');
console.log(JSON.stringify(currentCandidates, null, 2));
