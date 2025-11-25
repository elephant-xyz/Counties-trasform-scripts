// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

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

function toIntRounded(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
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

function toKey(label) {
  const parts = cleanText(label)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (!parts.length) {
    return '';
  }

  const [first, ...rest] = parts;
  const tail = rest
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join('');

  const key = first.toLowerCase() + tail;
  if (/^\d/.test(key)) {
    return `value${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  }

  return key;
}

function parseFeatures($) {
  const featuresTab = $('#details-Features');
  if (!featuresTab.length) {
    return [];
  }

  const table = featuresTab.find('table').first();
  if (!table.length) {
    return [];
  }

  const headers = [];
  table.find('thead th').each((_, headerEl) => {
    const headerText = cleanText($(headerEl).text());
    if (headerText) {
      headers.push({
        label: headerText,
        key: toKey(headerText),
      });
    }
  });

  const rows = [];

  table.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (!cells.length) {
      return;
    }

    const row = {};
    cells.each((index, cellEl) => {
      const header = headers[index];
      if (!header) {
        return;
      }

      row[header.key] = cleanText($(cellEl).text());
    });

    if (Object.keys(row).length) {
      rows.push(row);
    }
  });

  return rows;
}

function mapUtility($) {
  const imps = parseImprovements($);
  const gradingDetails = imps["gradingDetails"];
  let utilities = {};
  for (let index = 0; index < gradingDetails.length; index++) {
    const details = gradingDetails[index];
    let heating_system_type = null;
    let cooling_system_type = null;
    if (details["fields"]
      && "Heating & Air" in details["fields"]) {
        const heatingAir = details["fields"]["Heating & Air"];
        if (heatingAir === "11 - Heat Pump") {
          heating_system_type = "HeatPump";
        } else if (heatingAir === "01 - Heating-Cooling Ducts") {
          heating_system_type = "Central";
          cooling_system_type = "CentralAir";
        } else if (heatingAir === "13 - Zone Heat & Air") {
          heating_system_type = "Central";
          cooling_system_type = "CentralAir";
        } else if (heatingAir === "15 - Zone Heat Pump") {
          heating_system_type = "HeatPump";
        } else if (heatingAir === "02 - Heating w/Ducts") {
          heating_system_type = "Central";
        } else if (heatingAir === "08 - Radiant Heat") {
          heating_system_type = "Radiant";
        } else if (heatingAir === "05 - Wall-Floor Heat/Cool") {
          heating_system_type = "Baseboard";
        } else if (heatingAir === "04 - Wall-Floor Furnace") {
          heating_system_type = "Baseboard";
        } else if (heatingAir === "03 - Heat-Cool/Dbl Ducts") {
          heating_system_type = "Central";
          cooling_system_type = "CentralAir";
        } else if (heatingAir === "14 - Cooling w/Ducts") {
          cooling_system_type = "CentralAir";
        } else if (heatingAir === "06 - Cooling - No Ducts") {
          cooling_system_type = "Ductless";
        }
    }
    const util = {
      cooling_system_type: cooling_system_type,
      heating_system_type: heating_system_type,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
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
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      plumbing_fixture_count: null,
      plumbing_fixture_quality: null,
      plumbing_fixture_type_primary: null,
      plumbing_system_installation_date: null,
      sewer_connection_date: null,
      solar_installation_date: null,
      solar_inverter_installation_date: null,
      solar_inverter_manufacturer: null,
      solar_inverter_model: null,
      water_connection_date: null,
      water_heater_installation_date: null,
      water_heater_manufacturer: null,
      water_heater_model: null,
      well_installation_date: null,
    };
    utilities[(index + 1).toString()] = util;
  }
  const features = parseFeatures($);
  for(const feature of features) {
    if (feature && feature["description"]) {
      const featureType =  feature["description"].toUpperCase();
      if (featureType.includes("CENTRAL A/C")) {
        const util = {
          cooling_system_type: "CentralAir",
          heating_system_type: null,
          public_utility_type: null,
          sewer_type: null,
          water_source_type: null,
          plumbing_system_type: null,
          plumbing_system_type_other_description: null,
          electrical_panel_capacity: null,
          electrical_panel_installation_date: null,
          electrical_rewire_date: null,
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
          hvac_capacity_kw: null,
          hvac_capacity_tons: null,
          hvac_equipment_component: null,
          hvac_equipment_manufacturer: null,
          hvac_equipment_model: null,
          hvac_installation_date: null,
          hvac_seer_rating: null,
          hvac_system_configuration: null,
          plumbing_fixture_count: null,
          plumbing_fixture_quality: null,
          plumbing_fixture_type_primary: null,
          plumbing_system_installation_date: null,
          sewer_connection_date: null,
          solar_installation_date: null,
          solar_inverter_installation_date: null,
          solar_inverter_manufacturer: null,
          solar_inverter_model: null,
          water_connection_date: null,
          water_heater_installation_date: null,
          water_heater_manufacturer: null,
          water_heater_model: null,
          well_installation_date: null,
        };
        utilities["Generic"] = util;
      }
    }
  }


  return utilities;
}

function main() {
  const $ = readHtml();
  const pid = getPropertyId($);
  const utility = mapUtility($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {};
  payload[`property_${pid}`] = utility;

  fs.writeFileSync(
    path.join(outDir, "utilities_data.json"),
    JSON.stringify(payload, null, 2),
  );
}

main();
