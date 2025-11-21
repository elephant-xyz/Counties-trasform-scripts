const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "input", "22430011621.html"), "utf8");
const $ = cheerio.load(html);

console.log('SchoolTaxableValue:', $('#SchoolTaxableValue').text().trim());
console.log('TotalAdvTaxes:', $('#TotalAdvTaxes').text().trim());
console.log('Tax1:', $('#Tax1').text().trim());
console.log('Tax10:', $('#Tax10').text().trim());
console.log('Tax11:', $('#Tax11').text().trim());
console.log('TaName10:', $('#TaName10').text().trim());
console.log('TaName11:', $('#TaName11').text().trim());
console.log('Municipality:', $('#Municipality').text().trim());
console.log('OwnerCity:', $('#OwnerCity').text().trim());
console.log('OwnerLine3:', $('#OwnerLine3').text().trim());
console.log('HistoryTotalTaxes2:', $('#HistoryTotalTaxes2').text().trim());
