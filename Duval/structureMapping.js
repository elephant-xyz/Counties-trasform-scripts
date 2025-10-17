// Structure mapping script
// Requirements:
// - Read input from input.html (fallback to embedded HTML if missing)
// - Parse with cheerio only for HTML extraction
// - Map to structure schema and write to owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Fallback HTML from provided input_file
const fallbackHtml = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<body>
    <div id="content">
        
    <div id="detailsWrapper">
        <div id="details_header">
            <div id="ownerName"></div>
            <div id="primaryAddr"></div>
            <div id="plat"></div>
            <div id="tile"></div>
        </div>
        <div class="collapsable">
            <div id="details_value">
                <h2>
                    <span id="ctl00_cphBody_lblHeaderPropertyAddress" aria-label="Property Address">11558 CABINET CT</span>
                </h2>
                <div class="data">
                    <div id="propDetail">
                        <div id="propDetail_data" class="dt_noHeader">
                            <h3>
                                <span id="ctl00_cphBody_lblHeaderPropertyDetail">Property Detail</span></h3>
                            <table>
                                <tr>
                                    <th scope="row">
                                        <span id="ctl00_cphBody_lblHeaderRealEstateNumber">RE #</span></th>
                                    <td>
                                        <span id="ctl00_cphBody_lblRealEstateNumber">002060-8295</span></td>
                                </tr>
                                <tr class="alt">
                                    <th scope="row">
                                        <span id="ctl00_cphBody_lblHeaderNumberOfBuildings"># of Buildings</span></th>
                                    <td>
                                        <span id="ctl00_cphBody_lblNumberOfBuildings">1</span></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="collapsable">
            <div id="details_buildings">
                <div id="buildingsDetailWrapper">
                            <h3>
                                <span id="ctl00_cphBody_repeaterBuilding_ctl00_lblBuildingNumber">Building 1</span></h3>
                            <div class="actualBuildingData">
                                <div class="propBuildingInfo">
                                    <div class="buildingType">
                                        <div class="dt_noHeader">
                                            <table>
                                                <tr>
                                                    <th>
                                                        <span id="ctl00_cphBody_repeaterBuilding_ctl00_lblHeaderBuildingType" class="shortTip" title="Building Type - The Type (also know as building use) denotes the primary use of a building on a particular property.">Building Type</span></th>
                                                    <td>
                                                        <span id="ctl00_cphBody_repeaterBuilding_ctl00_lblBuildingType">0105 - TOWNHOUSE</span></td>
                                                </tr>
                                                <tr class="alt">
                                                    <th>
                                                        <span id="ctl00_cphBody_repeaterBuilding_ctl00_lblHeaderYearBuilt" class="shortTip" title="Actual Year Built (AYB) - Actual year built of improvements, buildings or permanent structures.">Year Built</span></th>
                                                    <td>
                                                        <span id="ctl00_cphBody_repeaterBuilding_ctl00_lblYearBuilt">2023</span></td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                    <div class="typeList">
                                        <div class="gv">
                                            <div>
    <table class="gridview" cellspacing="0" border="0" id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea">
        <tr>
            <th class="faux_th" scope="col">Type</th><th scope="col">Gross Area</th><th scope="col">Heated Area</th><th scope="col">Effective Area</th>
        </tr><tr>
            <td class="faux_th">Finished Open Porch</td><td>16</td><td>0</td><td>5</td>
        </tr><tr class="alt">
            <td class="faux_th">Finished Garage</td><td>286</td><td>0</td><td>143</td>
        </tr><tr>
            <td class="faux_th">Base Area</td><td>596</td><td>596</td><td>596</td>
        </tr><tr class="alt">
            <td class="faux_th">Finished upper story 1</td><td>698</td><td>698</td><td>663</td>
        </tr><tr>
            <td class="faux_th">Finished Open Porch</td><td>35</td><td>0</td><td>10</td>
        </tr><tr class="alt">
            <td class="faux_th">Total</td><td>1631</td><td>1294</td><td>1417</td>
        </tr>
    </table>
</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="propBuildingElements">
                                    <div class="gv element_detail">
                                        <div>
    <table class="gridview" cellspacing="0" border="0" id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements">
        <tr>
            <th scope="col">Element</th><th scope="col">Code</th><th scope="col">Detail</th>
        </tr><tr>
            <td class="col_element">Exterior Wall</td><td class="col_code">8</td><td class="col_detail">8 Horizontal Lap</td>
        </tr><tr class="alt">
            <td class="col_element">Exterior Wall</td><td class="col_code">6</td><td class="col_detail">6 Vertical Sheet</td>
        </tr><tr>
            <td class="col_element">Roof Struct</td><td class="col_code">3</td><td class="col_detail">3 Gable or Hip</td>
        </tr><tr class="alt">
            <td class="col_element">Roofing Cover</td><td class="col_code">3</td><td class="col_detail">3 Asph/Comp Shng</td>
        </tr><tr>
            <td class="col_element">Interior Wall</td><td class="col_code">5</td><td class="col_detail">5 Drywall</td>
        </tr><tr class="alt">
            <td class="col_element">Int Flooring</td><td class="col_code">14</td><td class="col_detail">14 Carpet</td>
        </tr><tr>
            <td class="col_element">Int Flooring</td><td class="col_code">11</td><td class="col_detail">11 Cer Clay Tile</td>
        </tr><tr class="alt">
            <td class="col_element">Heating Fuel</td><td class="col_code">4</td><td class="col_detail">4 Electric</td>
        </tr><tr>
            <td class="col_element">Heating Type</td><td class="col_code">4</td><td class="col_detail">4 Forced-Ducted</td>
        </tr><tr class="alt">
            <td class="col_element">Air Cond</td><td class="col_code">3</td><td class="col_detail">3 Central</td>
        </tr>
    </table>
</div>
                                    </div>
                                    <br />
                                    <div class="gv element_stories">
                                        <div>
    <table class="gridview" cellspacing="0" border="0" id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes">
        <tr>
            <th scope="col">Element</th><th scope="col">Code</th><th scope="col">Detail</th>
        </tr><tr>
            <td class="col_element">Baths</td><td class="col_code">2.500</td><td class="col_detail"></td>
        </tr><tr class="alt">
            <td class="col_element">Bedrooms</td><td class="col_code">2.000</td><td class="col_detail"></td>
        </tr><tr>
            <td class="col_element">Stories</td><td class="col_code">2.000</td><td class="col_detail"></td>
        </tr><tr class="alt">
            <td class="col_element">Rooms / Units</td><td class="col_code">1.000</td><td class="col_detail"></td>
        </tr>
    </table>
</div>
                                    </div>
                                </div>
                            </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

function loadHtml() {
  const primary = path.join(process.cwd(), "input.html");
  if (fs.existsSync(primary)) return fs.readFileSync(primary, "utf8");
  const alternate = path.join(process.cwd(), "0020608295R.html");
  if (fs.existsSync(alternate)) return fs.readFileSync(alternate, "utf8");
  return fallbackHtml;
}

function textTrim($, sel) {
  return ($(sel).text() || "").trim();
}

function parseNumber(v) {
  if (v == null) return null;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function main() {
  const html = loadHtml();
  const $ = cheerio.load(html);

  const reId = textTrim($, "#ctl00_cphBody_lblRealEstateNumber") || "unknown";
  const propKey = `property_${reId}`;

  // Extract building elements into a map of arrays
  const elements = [];
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements tr").each(
    (i, el) => {
      if (i === 0) return; // header
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        elements.push({
          element: $(tds[0]).text().trim(),
          code: $(tds[1]).text().trim(),
          detail: $(tds[2]).text().trim(),
        });
      }
    },
  );

  const getDetails = (name) =>
    elements
      .filter((e) => e.element.toLowerCase() === name.toLowerCase())
      .map((e) => e.detail);

  const exteriorWalls = getDetails("Exterior Wall");
  const roofStruct = getDetails("Roof Struct")[0] || "";
  const roofCover = getDetails("Roofing Cover")[0] || "";
  const interiorWall = getDetails("Interior Wall")[0] || "";
  const intFlooring = getDetails("Int Flooring");

  // Areas
  let finished_base_area = null;
  let finished_upper_story_area = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const type = $(tds[0]).text().trim();
        const heated = parseNumber($(tds[2]).text());
        if (type === "Base Area") {
          finished_base_area = heated;
        } else if (type.toLowerCase().startsWith("finished upper story")) {
          finished_upper_story_area = heated;
        }
      }
    },
  );

  // Attributes
  let number_of_stories = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const name = $(tds[0]).text().trim();
        const code = parseNumber($(tds[1]).text());
        if (name === "Stories") {
          number_of_stories = code;
        }
      }
    },
  );

  // Mappings
  // Exterior wall mapping (best-effort; unknowns -> null)
  let exterior_wall_material_primary = null;
  if (exteriorWalls.find((w) => /Horizontal Lap/i.test(w))) {
    // Could be fiber cement, vinyl, or wood lap; choose Fiber Cement Siding for modern builds
    exterior_wall_material_primary = "Fiber Cement Siding";
  } else if (exteriorWalls.find((w) => /Vertical Sheet/i.test(w))) {
    exterior_wall_material_primary = "Wood Siding";
  }

  // Roof design type
  let roof_design_type = null;
  if (/Gable or Hip/i.test(roofStruct)) {
    roof_design_type = "Combination";
  } else if (/Gable/i.test(roofStruct)) {
    roof_design_type = "Gable";
  } else if (/Hip/i.test(roofStruct)) {
    roof_design_type = "Hip";
  }

  // Roof covering material
  let roof_covering_material = null;
  if (/Asph|Comp Shng/i.test(roofCover)) {
    // Assume architectural asphalt shingles for recent construction
    roof_covering_material = "Architectural Asphalt Shingle";
  }

  // Interior wall surface
  let interior_wall_surface_material_primary = null;
  if (/Drywall/i.test(interiorWall))
    interior_wall_surface_material_primary = "Drywall";

  // Flooring materials
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  const floorSet = new Set();
  intFlooring.forEach((f) => {
    if (/Carpet/i.test(f)) floorSet.add("Carpet");
    if (/Cer\s*Clay\s*Tile|Cer.*Tile|Tile/i.test(f))
      floorSet.add("Ceramic Tile");
  });
  const floorsArr = Array.from(floorSet);
  if (floorsArr.length > 0) flooring_material_primary = floorsArr[0];
  if (floorsArr.length > 1) flooring_material_secondary = floorsArr[1];

  // Year built -> roof_date
  const yearBuilt = textTrim(
    $,
    "#ctl00_cphBody_repeaterBuilding_ctl00_lblYearBuilt",
  );
  const roof_date =
    yearBuilt && /\d{4}/.test(yearBuilt) ? yearBuilt.match(/\d{4}/)[0] : null;

  const number_of_buildings =
    parseNumber(textTrim($, "#ctl00_cphBody_lblNumberOfBuildings")) || null;

  // Attachment type from Building Type townhouse
  const buildingType = textTrim(
    $,
    "#ctl00_cphBody_repeaterBuilding_ctl00_lblBuildingType",
  );
  let attachment_type = null;
  if (/TOWNHOUSE/i.test(buildingType)) attachment_type = "Attached";

  // Build structure object adhering to schema, using null where unknown
  const structure = {
    architectural_style_type: null,
    attachment_type: attachment_type,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: null,
    finished_base_area:
      finished_base_area != null ? Math.round(finished_base_area) : null,
    finished_basement_area: null,
    finished_upper_story_area:
      finished_upper_story_area != null
        ? Math.round(finished_upper_story_area)
        : null,
    flooring_condition: null,
    flooring_material_primary: flooring_material_primary,
    flooring_material_secondary: flooring_material_secondary,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: number_of_buildings,
    number_of_stories: number_of_stories,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roof_covering_material,
    roof_date: roof_date,
    roof_design_type: roof_design_type,
    roof_material_type: roof_covering_material ? "Composition" : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const out = {};
  out[propKey] = structure;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote structure data for ${propKey} -> ${outPath}`);
}

main();
