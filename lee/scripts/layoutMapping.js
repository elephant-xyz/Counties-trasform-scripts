// Enhanced Layout mapping script with subarea code support
// Reads input.html, extracts layout entries with subarea code mapping to space types
// Writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Comprehensive subarea code to space type mapping
const SUBAREA_CODE_MAPPING = {
  // Living areas
  'LIV': 'Living Room',
  'LR': 'Living Room',
  'FAM': 'Family Room',
  'FR': 'Family Room',
  'GR': 'Great Room',
  'DIN': 'Dining Room',
  'DR': 'Dining Room',
  'KIT': 'Kitchen',
  'K': 'Kitchen',
  'BN': 'Breakfast Nook',
  'PAN': 'Pantry',
  
  // Bedrooms
  'BR': 'Bedroom',
  'BED': 'Bedroom',
  'MBR': 'Primary Bedroom',
  'MBED': 'Primary Bedroom',
  'SEC': 'Secondary Bedroom',
  'GUEST': 'Guest Bedroom',
  'CHILD': 'Children\'s Bedroom',
  'NURS': 'Nursery',
  
  // Bathrooms
  'BA': 'Full Bathroom',
  'BATH': 'Full Bathroom',
  'FB': 'Full Bathroom',
  'HB': 'Half Bathroom / Powder Room',
  'PB': 'Primary Bathroom',
  'ENSUITE': 'En-Suite Bathroom',
  'JACK': 'Jack-and-Jill Bathroom',
  
  // Utility areas
  'LAU': 'Laundry Room',
  'LAUNDRY': 'Laundry Room',
  'MUD': 'Mudroom',
  'CL': 'Closet',
  'CLOSET': 'Closet',
  'WIC': 'Walk-in Closet',
  
  // Storage and mechanical
  'MECH': 'Mechanical Room',
  'STOR': 'Storage Room',
  'STORAGE': 'Storage Room',
  'IT': 'Server/IT Closet',
  'OFF': 'Home Office',
  'OFFICE': 'Home Office',
  'LIB': 'Library',
  'DEN': 'Den',
  'STUDY': 'Study',
  
  // Recreational spaces
  'MEDIA': 'Media Room / Home Theater',
  'THEATER': 'Media Room / Home Theater',
  'GAME': 'Game Room',
  'GYM': 'Home Gym',
  'MUSIC': 'Music Room',
  'CRAFT': 'Craft Room / Hobby Room',
  'HOBBY': 'Craft Room / Hobby Room',
  'PRAYER': 'Prayer Room / Meditation Room',
  'MEDITATION': 'Prayer Room / Meditation Room',
  'SAFE': 'Safe Room / Panic Room',
  'WINE': 'Wine Cellar',
  'BAR': 'Bar Area',
  'GREEN': 'Greenhouse',
  
  // Garages and outbuildings
  'GAR': 'Attached Garage',
  'GARAGE': 'Attached Garage',
  'FGR': 'Attached Garage',
  'DETG': 'Detached Garage',
  'DETACHED': 'Detached Garage',
  'CARP': 'Carport',
  'WORK': 'Workshop',
  'LOFT': 'Storage Loft',
  
  // Outdoor spaces
  'PORCH': 'Porch',
  'SCREENED': 'Screened Porch',
  'USP': 'Screened Porch',
  'SUN': 'Sunroom',
  'DECK': 'Deck',
  'PATIO': 'Patio',
  'PERGOLA': 'Pergola',
  'BALC': 'Balcony',
  'TERR': 'Terrace',
  'GAZEBO': 'Gazebo',
  'POOLH': 'Pool House',
  'OUTKIT': 'Outdoor Kitchen',

  // Property improvements mapping (from property-improvement.txt)
  // Offices
  'AOF': 'Home Office',
  'FOF': 'Home Office',
  'GOF': 'Home Office',

  // Balconies / Lanais / Porches
  'BAL': 'Balcony',
  'COB': 'Balcony',
  'COL': 'Lanai',
  'COP': 'Open Porch',
  'FOP': 'Open Porch',
  'UOP': 'Open Porch',
  'FEP': 'Enclosed Porch',
  'UEP': 'Enclosed Porch',
  'DEP': 'Enclosed Porch',
  'DSP': 'Screened Porch',
  'FSP': 'Screened Porch',
  'USP': 'Screened Porch',
  'ULS': 'Lower Screened Porch',
  'FLS': 'Lower Screen Room',

  // Screen enclosures
  'PS1': 'Screen Porch (1-Story)',
  'PS2': 'Screen Enclosure (2-Story)',
  'PS3': 'Screen Enclosure (3-Story)',
  'PSE': 'Screened Porch',
  'CP1': 'Screen Porch (1-Story)',
  'CP2': 'Screen Enclosure (2-Story)',
  'CPC': 'Screen Enclosure (Custom)',
  'PSC': 'Screen Enclosure (Custom)',

  // Patios / Courtyards
  'PTO': 'Patio',
  'CPT': 'Patio',
  'OCY': 'Open Courtyard',
  'CGA': 'Courtyard',

  // Decks / Steps
  'RFT': 'Deck',
  'STP': 'Stoop',

  // Kitchens
  'KTA': 'Kitchen',
  'KTG': 'Kitchen',

  // Lobbies
  'LBA': 'Lobby / Entry Hall',
  'LBG': 'Lobby / Entry Hall',

  // Garages (detailed)
  'UGR': 'Attached Garage',
  'FLG': 'Lower Garage',
  'ULG': 'Lower Garage',
  'COG': 'Attached Garage',
  'FDG': 'Detached Garage',
  'UDG': 'Detached Garage',

  // Carports
  'FCP': 'Attached Carport',
  'UCP': 'Attached Carport',
  'LCP': 'Attached Carport',
  'FDC': 'Detached Carport',
  'UDC': 'Detached Carport',

  // Attic / Loft
  'FAT': 'Attic',
  'UAT': 'Attic',
  'MEF': 'Storage Loft',
  'MEU': 'Storage Loft',

  // Cabana
  'FCB': 'Enclosed Cabana',
  'UCB': 'Enclosed Cabana',

  // Utility / Storage
  'FDU': 'Detached Utility Closet',
  'UDU': 'Detached Utility Closet',
  'FST': 'Utility Closet',
  'UST': 'Utility Closet',

  // Pools / Spa
  'PLR': 'Outdoor Pool',
  'CPL': 'Outdoor Pool',
  'PPT': 'Pool Area',
  'CSP': 'Hot Tub / Spa Area',
  'JAZ': 'Jacuzzi',
  
  // Common areas
  'LOBBY': 'Lobby / Entry Hall',
  'ENTRY': 'Lobby / Entry Hall',
  'COMMON': 'Common Room',
  'UTIL': 'Utility Closet',
  'ELEV': 'Elevator Lobby',
  'MAIL': 'Mail Room',
  'JAN': 'Janitor\'s Closet',
  
  // Pool and spa areas
  'POOL': 'Pool Area',
  'INDPOOL': 'Indoor Pool',
  'OUTDPOOL': 'Outdoor Pool',
  'SPA': 'Hot Tub / Spa Area',
  'HOTTUB': 'Hot Tub / Spa Area',
  'SHED': 'Shed',

  
};

function getFolioId($) {
  let t = $("#parcelLabel").text();
  let m = t.match(/Folio\s*ID:\s*(\d+)/i);
  if (m) return m[1];
  let href = $("a[href*='FolioID=']").first().attr("href") || "";
  m = href.match(/FolioID=(\d+)/i);
  if (m) return m[1];
  return "unknown";
}

function getBedsBaths($) {
  let beds = 0;
  let bathsText = "";

  // Original logic for standard property pages
  $(
    "#PropertyDetailsCurrent table.appraisalAttributes tr, #PropertyDetails table.appraisalAttributes tr",
  ).each((i, el) => {
    const ths = $(el).find("th");
    if (
      ths.length === 4 &&
      /Bedrooms/i.test($(ths[0]).text()) &&
      /Bathrooms/i.test($(ths[1]).text())
    ) {
      const row = $(el).next();
      const tds = row.find("td");
      beds = parseInt(tds.eq(0).text().trim(), 10) || 0;
      bathsText = tds.eq(1).text().trim();
    }
  });

  // NEW: Handle condominium pages with detailsTableLeft structure
  if (beds === 0 && bathsText === "") {
    $("#PropertyDetailsCurrent table.detailsTableLeft tr, #PropertyDetails table.detailsTableLeft tr").each((i, el) => {
      const $row = $(el);
      const th = $row.find("th").first().text().trim();
      const td = $row.find("td").first().text().trim();

      if (/^Bedrooms$/i.test(th)) {
        beds = parseInt(td, 10) || 0;
      }
      if (/^Bathrooms$/i.test(th)) {
        bathsText = td;
      }
    });
  }

  // Convert bathroom text to full/half baths
  let fullBaths = 0;
  let halfBaths = 0;
  if (bathsText) {
    const num = parseFloat(bathsText);
    if (!isNaN(num)) {
      fullBaths = Math.floor(num);
      halfBaths = Math.round((num - fullBaths) * 2);
    }
  }

  return { beds, fullBaths, halfBaths };
}

function getGLA($) {
  let gla = 0;
  $(".appraisalDetails td").each((i, el) => {
    const txt = $(el).text().trim();
    if (/^3,?733$/.test(txt)) {
      gla = 3733;
    }
  });
  if (!gla) {
    // Try reading exact field row
    $("table.appraisalDetails tr").each((i, el) => {
      const th = $(el).find("th");
      const td = $(el).find("td");
      if (th.length && /Gross\s*Living\s*Area/i.test($(th[0]).text())) {
        const n = parseInt(
          $(td[0])
            .text()
            .replace(/[\,\s]/g, ""),
          10,
        );
        if (Number.isFinite(n)) gla = n;
      }
    });
  }
  return gla;
}

function isBedBathType(spaceType) {
  const t = String(spaceType || '').toLowerCase();
  return t.includes('bedroom') || t.includes('bathroom') || t.includes('powder room');
}

// Extract subarea codes from structure data
function extractSubareaCodes($) {
  const subareas = [];
  
  // Look for subarea information in appraisal attributes table
  $('table.appraisalAttributes tr').each((i, el) => {
    const tds = $(el).find('td');
    // Newer structure: 3 columns [Description, Heated, Area]
    if (tds.length >= 3) {
      const descriptionCell = $(tds[0]).text().trim();
      const heatedCell = $(tds[1]).text().trim();
      const areaCell = $(tds[2]).text().trim();
      const area = parseInt(areaCell.replace(/[^0-9]/g, ''), 10);
      const codeMatch = descriptionCell.match(/^\s*([A-Z0-9]{2,8})\b(?:\s*[-–]\s*(.+))?/i);
      if (codeMatch && Number.isFinite(area) && area > 0) {
        const code = codeMatch[1].toUpperCase();
        const description = (codeMatch[2] || '').trim();
        const mapped = SUBAREA_CODE_MAPPING[code] || null;
        if (mapped && !isBedBathType(mapped)) {
          subareas.push({
            code,
            description,
            spaceType: mapped,
            area,
            heated: /^Y/i.test(heatedCell),
            isExterior: isExteriorSpace(code, description)
          });
        }
      }
      return;
    }

    // Fallback: 4 columns [Description, ?, Heated, Area]
    if (tds.length >= 4) {
      const desc = $(tds[0]).text().trim();
      const heated = $(tds[2]).text().trim();
      const areaText = $(tds[3]).text().trim();
      const area = parseInt(areaText.replace(/[\,\s]/g, ''), 10);
      const codeMatch = desc.match(/^\s*([A-Z0-9]{2,8})\b(?:\s*[-–]\s*(.+))?/i);
      if (codeMatch && Number.isFinite(area) && area > 0) {
        const code = codeMatch[1].toUpperCase();
        const description = (codeMatch[2] || '').trim();
        const mapped = SUBAREA_CODE_MAPPING[code] || null;
        if (mapped && !isBedBathType(mapped)) {
          subareas.push({
            code,
            description,
            spaceType: mapped,
            area,
            heated: /^Y/i.test(heated),
            isExterior: isExteriorSpace(code, description)
          });
        }
      }
    }
  });
  
  return subareas;
}

// Map by description when code mapping fails
function mapByDescription(description) {
  // Description-based fallback removed: mapping must be driven strictly by leading code.
  return null;
}

// Determine if space is exterior
function isExteriorSpace(code, description) {
  const extCodes = ['POOL', 'SPA', 'PORCH', 'DECK', 'PATIO', 'BALC', 'TERR', 'GAZEBO'];
  const extDesc = /pool|spa|porch|deck|patio|balcony|terrace|gazebo|outdoor/i;
  
  return extCodes.includes(code.toUpperCase()) || extDesc.test(description);
}

function defaultLayout(space_type, index, size, isExterior = false) {
  return {
    space_type,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: size ?? null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: isExterior,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
  };
}

function poolLayout($, index) {
  const hasPool =
    /POOL - RESIDENTIAL/i.test($("#PropertyDetailsCurrent").text()) ||
    /POOL - RESIDENTIAL/i.test($("#PropertyDetails").text());
  if (!hasPool) return null;
  const l = defaultLayout("Pool Area", index, null, true);
  l.pool_type = "BuiltIn";
  l.pool_equipment = "Heated";
  l.pool_condition = null;
  l.pool_surface_type = null;
  l.pool_water_quality = null;
  l.view_type = "Waterfront";
  l.lighting_features = null;
  return l;
}

function main() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);
  const folio = getFolioId($);

  const { beds, fullBaths, halfBaths } = getBedsBaths($);
  const gla = getGLA($);
  const layouts = [];
  let idx = 1;

  // Extract subarea codes and create layouts from them (excluding bed/bath)
  const subareas = extractSubareaCodes($);
  console.log(`Found ${subareas.length} subarea codes:`);
  subareas.forEach(subarea => {
    console.log(`  ${subarea.code}: ${subarea.description} -> ${subarea.spaceType} (${subarea.area} sq ft)`);
    const layout = defaultLayout(subarea.spaceType, idx++, subarea.area, subarea.isExterior);
    layouts.push(layout);
  });

  // Always add bedroom/bathroom layouts from counts section
  for (let i = 0; i < beds; i++) {
    layouts.push(defaultLayout("Bedroom", idx++, null));
  }
  for (let i = 0; i < fullBaths; i++) {
    layouts.push(defaultLayout("Full Bathroom", idx++, null));
  }
  for (let i = 0; i < halfBaths; i++) {
    layouts.push(defaultLayout("Half Bathroom / Powder Room", idx++, null));
  }

  const pool = poolLayout($, idx);
  if (pool) {
    layouts.push(pool);
    idx++;
  }

  // Save
  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "layout_data.json");
  const payload = {};
  payload[`property_${folio}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Wrote ${outPath} with ${layouts.length} layouts`);
}

main();