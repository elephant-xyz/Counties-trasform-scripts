// Structure mapping script
// Reads input.html, extracts structural info with cheerio, writes owners/structure_data.json

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function safeInt(val) {
    if (val == null) return undefined;
    const n = parseInt(String(val).replace(/[,\s]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
}

function extractText($, selector) {
    const t = $(selector).first().text();
    return t ? t.trim() : "";
}

function getFolioId($) {
    // Try primary label
    let t = $("#parcelLabel").text();
    let m = t.match(/Folio\s*ID:\s*(\d+)/i);
    if (m) return m[1];
    // Try links with folioid query
    let href = $("a[href*='FolioID=']").first().attr("href") || "";
    m = href.match(/FolioID=(\d+)/i);
    if (m) return m[1];
    return "unknown";
}

function detectStyle($) {
    // Look for Improvement Type row text e.g., "102 - Ranch"
    let styleText = "";
    $("table.appraisalAttributes tr").each((i, el) => {
        const ths = $(el).find("th");
        const tds = $(el).find("td");
        if (ths.length === 4 && /Improvement Type/i.test($(ths[0]).text())) {
            styleText = $(el).next().find("td").eq(0).text().trim();
        }
    });
    if (/ranch/i.test(styleText)) return "Ranch";
    // Fallback null
    return null;
}

function detectAttachment($) {
    // Model Type often includes SINGLE FAMILY RESIDENTIAL
    let modelType = "";
    $("table.appraisalAttributes tr").each((i, el) => {
        const ths = $(el).find("th");
        if (ths.length === 4 && /Stories/i.test($(ths[2]).text())) {
            const row = $(el).next();
            modelType = row.find("td").eq(1).text().trim();
        }
    });
    if (/single\s*family/i.test(modelType)) return "Detached";
    return null;
}

function extractAreas($) {
    let finished_base_area;
    let finished_upper_story_area;
    $("table.appraisalAttributes tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 4) {
            const desc = $(tds[0]).text().trim();
            const heated = $(tds[2]).text().trim();
            const areaTxt = $(tds[3]).text().trim();
            const area = safeInt(areaTxt);
            if (/^BAS\s*-\s*BASE/i.test(desc) && /^Y/i.test(heated)) {
                finished_base_area = area;
            }
            if (
                /^FUS\s*-\s*FINISHED\s*UPPER\s*STORY/i.test(desc) &&
                /^Y/i.test(heated)
            ) {
                finished_upper_story_area = area;
            }
        }
    });
    return { finished_base_area, finished_upper_story_area };
}

function extractGeneratedYear($) {
    const genTxt = $(".generatedOnExpander, .generatedOn").first().text();
    const m = genTxt.match(/\b(20\d{2})\b/);
    return m ? parseInt(m[1], 10) : undefined;
}

function extractPropertyBuiltYear($) {
    // Look for Year Built in property details tables
    let year;
    $("table.appraisalAttributes tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 4) {
            const desc = $(tds[0]).text().trim();
            if (/Year Built/i.test(desc)) {
                const yearText = $(tds[2]).text().trim();
                const m = yearText.match(/(\d{4})/);
                if (m) {
                    year = parseInt(m[1], 10);
                    return false; // break
                }
            }
        }
    });
    return year;
}

function extractRoofDateFromPermits($) {
    // Look in Permit Details table for a row where Permit Type contains 'Roof'
    let roofDate;
    console.log("Looking for roof permits...");
    $("#PermitDetails table.detailsTable tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 3) {
            const type = $(tds[1]).text().trim();
            const date = $(tds[2]).text().trim();
            console.log(`Found permit: type="${type}", date="${date}"`);
            if (/\broof\b/i.test(type)) {
                console.log("Found roof permit!");
                // Try to parse full date format (MM/DD/YYYY)
                const fullDateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (fullDateMatch) {
                    const [, month, day, year] = fullDateMatch;
                    roofDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    console.log(`Extracted roof date: ${roofDate}`);
                    return false; // break
                }
                // Fallback to year only
                const yearMatch = date.match(/(\d{4})/);
                if (yearMatch) {
                    roofDate = yearMatch[1];
                    console.log(`Extracted roof year: ${roofDate}`);
                    return false; // break
                }
            }
        }
    });
    console.log(`Final roof date: ${roofDate}`);
    return roofDate;
}

function normalizeDateStr(s) {
    if (!s) return null;
    const str = String(s).trim();
    // Accept YYYY-MM-DD or YYYY-MM or YYYY
    const m = str.match(/^(\d{4})(?:-(0[1-9]|1[0-2]))?(?:-([0-2][0-9]|3[01]))?/);
    if (m) {
        const y = m[1];
        const mm = m[2];
        const dd = m[3];
        if (y && mm && dd) return `${y}-${mm}-${dd}`;
        if (y && mm) return `${y}-${mm}`;
        if (y) return y;
    }
    // Try MM/DD/YYYY
    const us = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
        const mm = us[1].padStart(2, '0');
        const dd = us[2].padStart(2, '0');
        const y = us[3];
        return `${y}-${mm}-${dd}`;
    }
    // Fallback to just a 4-digit year if present
    const y = str.match(/(\d{4})/);
    return y ? y[1] : null;
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
// Maps extra feature codes to structure field names and values
const EXTRA_FEATURE_TO_STRUCTURE_MAPPING = {
    // Example: 'C1': { field: 'exterior_wall_material_primary', value: 'Brick' },
    // Example: 'C5': { field: 'roof_covering_material', value: 'Tile' },
};

// Extract extra feature codes that map to structure, grouped by building
function extractStructureFeatures($) {
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
            if (code && code.match(/^[A-Z0-9]+$/) && EXTRA_FEATURE_TO_STRUCTURE_MAPPING[code]) {
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
                    
                    // Only process if it maps to structure
                    if (EXTRA_FEATURE_TO_STRUCTURE_MAPPING[code]) {
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


function main() {
    // Debug: Write a test file to verify script execution
    fs.writeFileSync("debug_test.txt", "Script executed at " + new Date().toISOString());
    
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf-8");
    const $ = cheerio.load(html);

    const folio = getFolioId($);
    const style = detectStyle($);
    const attachment = detectAttachment($);
    const areas = extractAreas($);
    const propertyBuiltYear = extractPropertyBuiltYear($);
    const roofPermitDate = extractRoofDateFromPermits($);
    
    // Use roof permit date if available, otherwise use property built year
    const roofDateRaw = roofPermitDate || (propertyBuiltYear ? propertyBuiltYear.toString() : null);
    const roofDate = normalizeDateStr(roofDateRaw);

    // Extract extra feature codes that map to structure, grouped by building
    const structureFeaturesByBuilding = extractStructureFeatures($);
    const buildingNumbers = Object.keys(structureFeaturesByBuilding).map(Number).sort((a, b) => a - b);
    
    // If no buildings detected, default to building 1
    const structuresByBuilding = {};
    const allBuildingNumbers = buildingNumbers.length > 0 ? buildingNumbers : [1];
    
    allBuildingNumbers.forEach(buildingNum => {
        // Create base structure for this building
        const structure = {
            architectural_style_type: style,
            attachment_type: attachment,
            exterior_wall_material_primary: null,
            exterior_wall_material_secondary: null,
            exterior_wall_condition: null,
            exterior_wall_insulation_type: null,
            flooring_material_primary: null,
            flooring_material_secondary: null,
            subfloor_material: null,
            flooring_condition: null,
            interior_wall_structure_material: null,
            interior_wall_surface_material_primary: null,
            interior_wall_surface_material_secondary: null,
            interior_wall_finish_primary: null,
            interior_wall_finish_secondary: null,
            interior_wall_condition: null,
            roof_covering_material: null,
            roof_underlayment_type: null,
            roof_structure_material: null,
            roof_design_type: null,
            roof_condition: null,
            roof_date: roofDate,
            roof_age_years: null,
            gutters_material: null,
            gutters_condition: null,
            roof_material_type: null,
            foundation_type: null,
            foundation_material: null,
            foundation_waterproofing: null,
            foundation_condition: null,
            ceiling_structure_material: null,
            ceiling_surface_material: null,
            ceiling_insulation_type: null,
            ceiling_height_average: null,
            ceiling_condition: null,
            exterior_door_material: null,
            interior_door_material: null,
            window_frame_material: null,
            window_glazing_type: null,
            window_operation_type: null,
            window_screen_material: null,
            primary_framing_material: null,
            secondary_framing_material: null,
            structural_damage_indicators: "None Observed",
        };

        // Optional area fields
        if (areas.finished_base_area != null)
            structure.finished_base_area = areas.finished_base_area;
        if (areas.finished_upper_story_area != null)
            structure.finished_upper_story_area = areas.finished_upper_story_area;

        // Apply extra feature codes to structure fields
        const features = structureFeaturesByBuilding[buildingNum] || [];
        features.forEach(feature => {
            const mapping = EXTRA_FEATURE_TO_STRUCTURE_MAPPING[feature.code];
            if (mapping && mapping.field) {
                structure[mapping.field] = mapping.value !== undefined ? mapping.value : feature.value;
                console.log(`Building ${buildingNum}: Applied ${feature.code} -> ${mapping.field} = ${structure[mapping.field]}`);
            }
        });

        structuresByBuilding[buildingNum] = structure;
    });

    const outputDir = path.resolve("owners");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, "structure_data.json");

    const payload = {};
    // Store structures by building number
    payload[`property_${folio}`] = structuresByBuilding;

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`Wrote ${outPath} with structures for ${allBuildingNumbers.length} building(s)`);
}

main();