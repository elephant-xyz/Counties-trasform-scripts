const path = require("path");
const fs = require("fs");

// Copy input files to script directory for testing
const inputDir = path.join(__dirname, "..", "input");
const testDir = path.join(__dirname, "test_output");

// Clean up test output
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Change to test directory
process.chdir(testDir);

// Copy input files
fs.copyFileSync(path.join(inputDir, "23-04S-14E-03172-002010.html"), "input.html");
fs.copyFileSync(path.join(inputDir, "input.csv"), "input.csv");
fs.copyFileSync(path.join(inputDir, "property_seed.json"), "property_seed.json");
fs.copyFileSync(path.join(inputDir, "unnormalized_address.json"), "unnormalized_address.json");

// Create owners directory with dummy data
fs.mkdirSync("owners", { recursive: true });
fs.writeFileSync(path.join("owners", "owner_data.json"), JSON.stringify({}));
fs.writeFileSync(path.join("owners", "utilities_data.json"), JSON.stringify({}));
fs.writeFileSync(path.join("owners", "structure_data.json"), JSON.stringify({}));
fs.writeFileSync(path.join("owners", "layout_data.json"), JSON.stringify({}));

// Run the extractor
console.log("Running data extractor...");
require("../transform/suwannee/data_extractor.js");

// Check if parcel.json was created
const parcelPath = path.join("data", "parcel.json");
if (fs.existsSync(parcelPath)) {
  console.log("✓ parcel.json created successfully");
  const parcel = JSON.parse(fs.readFileSync(parcelPath, "utf-8"));
  console.log("Parcel content:", JSON.stringify(parcel, null, 2));
} else {
  console.log("✗ parcel.json NOT created");
}

// List all files created
console.log("\nFiles created in data directory:");
const dataFiles = fs.readdirSync("data");
dataFiles.forEach(f => console.log("  -", f));
