// Utility mapping script
// Reads input.html and extracts utility data per schema, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getFolioId($) {
    let t = $("#parcelLabel").text();
    let m = t.match(/Folio\s*ID:\s*(\d+)/i);
    if (m) return m[1];
    let href = $("a[href*='FolioID=']").first().attr("href") || "";
    m = href.match(/FolioID=(\d+)/i);
    if (m) return m[1];
    return "unknown";
}

// Extract building number from various patterns
function extractBuildingNumber(text, currentBuilding = null) {
    if (!text) return currentBuilding;
    
    const patterns = [
        /Building\s+(\d+)\s+of\s+\d+/i, // "Building 1 of 5", "Building 2 of 5", etc.
        /Building\s*#?\s*(\d+)/i,
        /Bldg\s*#?\s*(\d+)/i,
        /^#\s*(\d+)/i,
        /Building\s+(\d+)/i,
        /Bldg\s+(\d+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    
    return currentBuilding;
}

// TODO: Populate this mapping from Extra_Feature_Code_List.pdf
// Maps extra feature codes to utility field names and values
const EXTRA_FEATURE_TO_UTILITY_MAPPING = {
    // Example: 'C2': { field: 'hvac_condensing_unit_present', value: true },
    // Example: 'C3': { field: 'solar_panel_present', value: true },
};

// Extract extra feature codes that map to utility, grouped by building
function extractUtilityFeatures($) {
    const featuresByBuilding = {}; // { buildingNumber: [{ code, value, description }] }
    let currentBuilding = null;
    
    // Method 1: Extract from F50 field in certified roll data (format: C1;14678;C2;371;C5;7354)
    const certifiedRollText = $('.certifiedRollData').text();
    const f50Match = certifiedRollText.match(/F50:\s*([^\n]+)/i);
    if (f50Match) {
        const f50Value = f50Match[1].trim();
        // Parse format: C1;14678;C2;371;C5;7354
        const pairs = f50Value.split(';');
        for (let i = 0; i < pairs.length - 1; i += 2) {
            const code = pairs[i].trim().toUpperCase();
            const value = pairs[i + 1] ? parseInt(pairs[i + 1].trim(), 10) : null;
            if (code && code.match(/^[A-Z0-9]+$/) && EXTRA_FEATURE_TO_UTILITY_MAPPING[code]) {
                if (!featuresByBuilding[1]) {
                    featuresByBuilding[1] = [];
                }
                featuresByBuilding[1].push({
                    code: code,
                    value: value,
                    description: null,
                    buildingNumber: 1
                });
            }
        }
    }
    
    // Method 2: Extract from appraisalAttributes table rows
    $('table.appraisalAttributes').each((tableIdx, table) => {
        const $table = $(table);
        let tableBuilding = null;
        
        // Check for building indicator in table header or preceding elements
        const $prev = $table.prevAll('.sectionSubTitle, .sectionTitle, th, h3, h4').first();
        if ($prev.length) {
            const prevText = $prev.text();
            tableBuilding = extractBuildingNumber(prevText);
        }
        
        $table.find('tr').each((i, el) => {
            const $row = $(el);
            const ths = $row.find('th');
            const tds = $row.find('td');
            
            // Check if this row indicates a building number
            if (ths.length > 0) {
                const headerText = ths.first().text();
                const buildingFromHeader = extractBuildingNumber(headerText);
                if (buildingFromHeader) {
                    currentBuilding = buildingFromHeader;
                    tableBuilding = buildingFromHeader;
                }
            }
            
            // Check for extra feature codes in description cells
            if (tds.length >= 3) {
                const descriptionCell = $(tds[0]).text().trim();
                // Look for pattern: CODE - Description or CODE Description
                const codeMatch = descriptionCell.match(/^\s*([A-Z]\d+)\s*[-–]?\s*(.+)?/i);
                if (codeMatch) {
                    const code = codeMatch[1].toUpperCase();
                    const description = (codeMatch[2] || '').trim();
                    const valueCell = tds.length > 1 ? $(tds[1]).text().trim() : null;
                    const value = valueCell ? parseInt(valueCell.replace(/[^0-9]/g, ''), 10) : null;
                    
                    // Only process if it maps to utility
                    if (EXTRA_FEATURE_TO_UTILITY_MAPPING[code]) {
                        const rowBuilding = tableBuilding || currentBuilding || 1;
                        if (!featuresByBuilding[rowBuilding]) {
                            featuresByBuilding[rowBuilding] = [];
                        }
                        featuresByBuilding[rowBuilding].push({
                            code: code,
                            value: value,
                            description: description || null,
                            buildingNumber: rowBuilding
                        });
                    }
                }
            }
        });
    });
    
    return featuresByBuilding;
}

function parsePoolEquipment($) {
    // Check building features for pool equipment and A/C pool heaters
    const items = [];
    $(
        "#PropertyDetailsCurrent table.appraisalAttributes tr, #PropertyDetails table.appraisalAttributes tr",
    ).each((i, el) => {
        const tds = cheerio(el).find("td");
        if (tds.length >= 3) {
            const desc = cheerio(tds[0]).text().trim().toUpperCase();
            if (desc.includes("A/C-POOL HEATERS")) items.push("PoolHeater");
            if (desc.includes("OUTDOOR KITCHEN")) items.push("OutdoorKitchen");
            if (desc.includes("OUTDOOR SHOWER")) items.push("OutdoorShower");
            if (desc.includes("XTRA/ADDITIONAL A/C UNITS"))
                items.push("ExtraACUnits");
        }
    });
    return Array.from(new Set(items));
}

function main() {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf-8");
    const $ = cheerio.load(html);
    const folio = getFolioId($);

    // Extract extra feature codes that map to utility, grouped by building
    const utilityFeaturesByBuilding = extractUtilityFeatures($);
    const buildingNumbers = Object.keys(utilityFeaturesByBuilding).map(Number).sort((a, b) => a - b);
    
    // If no buildings detected, default to building 1
    const utilitiesByBuilding = {};
    const allBuildingNumbers = buildingNumbers.length > 0 ? buildingNumbers : [1];
    
    // Default null/false values; very limited explicit utility info in given HTML
    // We infer public utilities available from presence of county services and garbage service
    const hasGarbage = $("#GarbageDetails").length > 0;

    allBuildingNumbers.forEach(buildingNum => {
        // Create base utility for this building
        const utility = {
            cooling_system_type: null, // unknown
            heating_system_type: null,
            public_utility_type: hasGarbage ? "ElectricityAvailable" : null,
            sewer_type: null,
            water_source_type: null,
            plumbing_system_type: null,
            plumbing_system_type_other_description: null,
            electrical_panel_capacity: null,
            electrical_wiring_type: null,
            hvac_condensing_unit_present: null,
            electrical_wiring_type_other_description: null,
            solar_panel_present: false,
            solar_panel_type: null,
            solar_panel_type_other_description: null,
            smart_home_features: null,
            smart_home_features_other_description: null,
            hvac_unit_condition: null,
            solar_inverter_visible: false,
            hvac_unit_issues: null,
        };

        // Apply extra feature codes to utility fields
        const features = utilityFeaturesByBuilding[buildingNum] || [];
        features.forEach(feature => {
            const mapping = EXTRA_FEATURE_TO_UTILITY_MAPPING[feature.code];
            if (mapping && mapping.field) {
                utility[mapping.field] = mapping.value !== undefined ? mapping.value : feature.value;
                console.log(`Building ${buildingNum}: Applied ${feature.code} -> ${mapping.field} = ${utility[mapping.field]}`);
            }
        });

        utilitiesByBuilding[buildingNum] = utility;
    });

    // Write output
    const outputDir = path.resolve("owners");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, "utilities_data.json");
    const payload = {};
    // Store utilities by building number
    payload[`property_${folio}`] = utilitiesByBuilding;
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`Wrote ${outPath} with utilities for ${allBuildingNumbers.length} building(s)`);
}

main();