// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf-8");
  return cheerio.load(html);
}

function getPropertyId($) {
  let vid = null;
  $(".summary-card .row").each((i, row) => {
      const label = $(row).find(".col-4").first().text().trim();
        const val = $(row).find(".col-8").first().text().trim();
    if (label === "VID:") vid = val;
    });
  if (!vid) {
    const res = $(".result-card").attr("data-parcel-pid");
    if (res) vid = res.trim();
  }
  return vid || "unknown";
}

function parseImprovements($) {
  const wrappers = $('#improvements-accordion > .card.wrapper-card');

  const overallDetails = [];
  const gradingDetails = [];
  const areasAndAdditions = [];

  wrappers.each((_, wrapperEl) => {
    const wrapper = $(wrapperEl);
    const improvementBody = wrapper.find('.improvement-card-body').first();
    if (!improvementBody.length) {
      return;
    }

    const id = improvementBody.attr('id') || '';
    const heading = cleanText(wrapper.find('.accordion-header').first().text());
    const firstDetailsCard = improvementBody.find('.details-card').first();
    const improvementName = cleanText(
      firstDetailsCard.find('.card-header').first().text()
    );

    let overallFields = null;
    let gradingFields = null;
    let areaRows = null;

    improvementBody.find('.details-card').each((_, cardEl) => {
      const card = $(cardEl);
      const cardTitle = cleanText(card.find('.card-header').first().text());
      if (!cardTitle) {
        return;
      }

      if (cardTitle === 'Grading') {
        gradingFields = extractKeyValueTable($, card);
      } else if (cardTitle === 'Area and Additions') {
        areaRows = extractAreaTable($, card);
      } else if (!overallFields) {
        overallFields = extractKeyValueTable($, card);
      }
    });

    const meta = {
      id: id || null,
      heading,
      improvement: improvementName || null,
    };

    if (overallFields) {
      overallDetails.push({
        ...meta,
        fields: overallFields,
      });
    }

    if (gradingFields) {
      gradingDetails.push({
        ...meta,
        fields: gradingFields,
      });
    }

    if (areaRows) {
      areasAndAdditions.push({
        ...meta,
        rows: areaRows,
      });
    }
  });

  return {
    overallDetails,
    gradingDetails,
    areasAndAdditions,
  };
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function extractKeyValueTable($, container) {
  const data = {};

  container.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (cells.length < 2) {
      return;
    }

    const key = cleanKey($(cells[0]).text());
    if (!key) {
      return;
    }

    const value = cleanText($(cells[1]).text());
    data[key] = value;
  });

  return data;
}

function cleanKey(value) {
  return cleanText(value).replace(/:\s*$/, '');
}

function extractAreaTable($, container) {
  const rows = [];

  container.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (!cells.length) {
      return;
    }

    rows.push({
      description: cleanText($(cells[0]).text()),
      percentRate: cleanText($(cells[1]).text()),
      rate: cleanText($(cells[2]).text()),
      squareFeet: cleanText($(cells[3]).text()),
      cost: cleanText($(cells[4]).text()),
    });
  });

  return rows;
}

function parseSubfloorSystem(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "03 - Wood W/Sub Floor": "Engineered Wood"
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function parseExteriorWalls(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "07 - Common Brick": "Brick",
    "01 - Conc. Block/Board": "Concrete Block",
    "06 - Cement Brick": "Brick",
    "11 - Wood - Stucco": "Stucco",
    "05 - Concrete Blk. Stucco": "Concrete Block",
    "04 - Wall Bd / Wd Sd - Min": null,
    "21 - Brick/Wood (RES)": "Brick",
    "03 - Shingle / Wd Sd. - Avg.": null,
    "10 - Concrete Block/Wood": "Concrete Block",
    "15 - Prefinished Metal": "Metal Siding",
    "13 - Corrugated Metal": "Metal Siding",
    "08 - Face Brick - Stone": "Brick",
    "09 - Concrete Blk - Brick": "Concrete Block",
    "12 - Aluminum/Vinyl Siding": "Metal Siding",
    "19 - Simulated Brick": "Brick",
    "02 - Wood Siding - Abv. Avg.": null,
    "17 - Unfinished": null,
    "18 - Corrugated": "Metal Siding",
    "20 - Log Cabin Wall (RES)": "Log",
    "22 - Precast Concrete Panel": "Precast Concrete",
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function parseFramingMaterial(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "05 - Wood Beam - Columns": "Wood Frame",
    "03 - Steel Structure": "Steel Frame",
    "02 - Masonry - Pilaster": "Masonry",
    "06 - Butler Bldg - Light": null,
    "01 - None": null,
    "04 - Concrete Reinforced": "Concrete Block"
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function parseRoofDesignStructure(value) {
  if(!value || !value.trim()) {
    return [null, null];
  }
  value = value.trim();
  const valueMapping = {
    "03 - Gable/Hip (RES)": ["Combination", null],
    "06 - Wood Frame/Truss (COM)": [null, "Wood Truss"],
    "05 - Bar Joist/Rigid Frame": [null, null],
    "09 - Mansard (RES)": ["Mansard", null],
    "07 - Steel Truss/Purlin": [null, "Steel Truss"],
    "02 - Flat (RES)": ["Flat", null],
    "08 - Reinf. Concrete - PS": [null, "Concrete Beam"],
    "01 - Irregular": [null, null],
    "04 - Shed (RES)": ["Shed", null],
    "10 - Gambrel (RES)": ["Gambrel", null],
    "11 - A-Frame (RES)": [null, null],
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return [null, null];
}

function parseRoofCover(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "13 - Pre Finished Metal": null,
    "04 - Composition Shingle": "3-Tab Asphalt Shingle",
    "06 - Corrugated Metal": "Metal Corrugated",
    "07 - Galv. Sheet - V Crimp": "Metal Standing Seam",
    "11 - Corrugated": "Metal Corrugated",
    "12 - Roll Roofing": null,
    "02 - Built-Up Comp/Gyp": "Built-Up Roof",
    "03 - Built-Up Metal Comp": "Built-Up Roof",
    "08 - Metal Shingle": null,
    "10 - Clay Tile": "Clay Tile",
    "01 - Built-Up Comp/Wood": "Built-Up Roof",
    "09 - Cement Tile": null,
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function parseFloorFinish(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "12 - Combo - Carpet-Vinyl": "Carpet",
    "19 - Concrete Finished": "Polished Concrete",
    "07 - Carpeting 1": "Carpet",
    "03 - Vinyl Tile (low quality)": "Sheet Vinyl",
    "13 - Combo - Carpet-Pine": "Carpet",
    "10 - Hard Tile/ Laminate Fir": "Laminate",
    "21 - Commercial Carpet": "Carpet",
    "15 - Vinyl Sheet": "Sheet Vinyl",
    "04 - Vinyl or Cork Tile": "Cork",
    "05 - Pine/Soft Wood": null,
    "11 - Combo - Carpet-Hard Tile": "Carpet",
    "06 - Finished Wood": null,
    "02 - Asphalt Tile": null,
    "14 - Combo - Carpet-Hardwood": "Carpet",
    "17 - Rough Pine": null,
    "20 - Earth": null,
    "08 - Carpeting 2": "Carpet",
    "01 - Terrazzo Mono": "Terazzo",
    "18 - Roll Congoleum": null,
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function parseInterior(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim();
  const valueMapping = {
    "03 - Drywall - Taped": "Drywall",
    "17 - Drywall/Paneling": "Drywall",
    "02 - Plastered - Direct": "Plaster",
    "08 - Wood- Wall Board": "Wood Paneling",
    "05 - Average Paneling": null,
    "13 - None": null,
    "04 - Economy Paneling": null,
    "12 - Unfinished": null,
    "06 - Custom Paneling": null,
    "01 - Furred - Plastered": "Plaster",
    "16 - Block": "Exposed Block",
    "11 - Ceiling Only - Avg": null,
    "07 - 1x6 V Joint (RES)": null,
    "14 - Redwood-Cedar-Cypress": null,
    "15 - Log (RES)": "Log",
  }
  if (value in valueMapping) {
    return valueMapping[value];
  }
  return null;
}

function buildStructures($) {
  const imps = parseImprovements($);
  const gradingDetails = imps["gradingDetails"];
  const structures = {};
  for (let index = 0; index < gradingDetails.length; index++) {
    const details = gradingDetails[index];
    let subfloor_material = null;
    let exterior_wall_material_primary = null;
    let primary_framing_material = null;
    let roof_design_type = null;
    let roof_structure_material = null;
    let roof_covering_material = null;
    let flooring_material_primary = null;
    let interior_wall_surface_material_primary = null;
    if (details["fields"]
        && "Floor System" in details["fields"]) {
        subfloor_material = parseSubfloorSystem(details["fields"]["Floor System"]);
    }
    if (details["fields"]
        && "Exterior Walls" in details["fields"]) {
        exterior_wall_material_primary = parseExteriorWalls(details["fields"]["Exterior Walls"]);
    }
    if (details["fields"]
        && "Sub Frame" in details["fields"]) {
        primary_framing_material = parseFramingMaterial(details["fields"]["Sub Frame"]);
    }
    if (details["fields"]
        && "Roof Framing" in details["fields"]) {
        let roof_design_structure = parseRoofDesignStructure(details["fields"]["Roof Framing"]);
        roof_design_type = roof_design_structure[0];
        roof_structure_material = roof_design_structure[1]
    }
    if (details["fields"]
        && "Roof Cover" in details["fields"]) {
        roof_covering_material = parseRoofCover(details["fields"]["Roof Cover"]);
    }
    if (details["fields"]
        && "Floor Finish" in details["fields"]) {
        flooring_material_primary = parseFloorFinish(details["fields"]["Floor Finish"]);
    }
    if (details["fields"]
        && "Interior Finish" in details["fields"]) {
        interior_wall_surface_material_primary = parseInterior(details["fields"]["Interior Finish"]);
    }
    const structure = {
        architectural_style_type: null,
        attachment_type: null,
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
        finished_base_area: null,
        finished_basement_area: null,
        finished_upper_story_area: null,
        flooring_condition: null,
        flooring_material_primary: flooring_material_primary,
        flooring_material_secondary: null,
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
        interior_wall_surface_material_primary: interior_wall_surface_material_primary,
        interior_wall_surface_material_secondary: null,
        number_of_buildings: null,
        number_of_stories: null,
        primary_framing_material: primary_framing_material,
        roof_age_years: null,
        roof_condition: null,
        roof_covering_material: roof_covering_material,
        roof_date: null,
        roof_design_type: roof_design_type,
        roof_material_type: null,
        roof_structure_material: roof_structure_material,
        roof_underlayment_type: null,
        secondary_framing_material: null,
        siding_installation_date: null,
        structural_damage_indicators: null,
        subfloor_material: subfloor_material,
        unfinished_base_area: null,
        unfinished_basement_area: null,
        unfinished_upper_story_area: null,
        window_frame_material: null,
        window_glazing_type: null,
        window_installation_date: null,
        window_operation_type: null,
        window_screen_material: null,
      };
      structures[(index + 1).toString()] = structure;
  }
  return structures;
}

function main() {
  const $ = readHtml();
  const pid = getPropertyId($);
  const structures = buildStructures($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {};
  payload[`property_${pid}`] = structures;

  fs.writeFileSync(
    path.join(outDir, "structure_data.json"),
    JSON.stringify(payload, null, 2),
  );
}

main();
