// Test the relationship filename generation
function relationshipBaseName(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/^\.\/+/, "").trim();
  if (!normalized) return null;
  return normalized.toLowerCase().endsWith(".json")
    ? normalized.slice(0, -5)
    : normalized;
}

function makeRelationshipFilename(fromPath, toPath) {
  const fromBase = relationshipBaseName(fromPath);
  const toBase = relationshipBaseName(toPath);
  if (!fromBase || !toBase) return null;
  return `relationship_${fromBase}_has_${toBase}.json`;
}

// Test with sales_history and company
const from = "./sales_history_1.json";
const to = "./company_1.json";
const filename = makeRelationshipFilename(from, to);
console.log('Relationship filename:', filename);
// Expected: relationship_sales_history_1_has_company_1.json

// But Elephant might expect: relationship_sales_history_has_company_1.json
// or something else
