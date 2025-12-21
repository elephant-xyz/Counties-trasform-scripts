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
  'APT': 'Living Area',
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
'FLS': 'Lower Screened Porch',

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

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      /Bedrooms/i.test(cleanText($(ths[0]).text())) &&
      /Bathrooms/i.test(cleanText($(ths[1]).text()))
    ) {
      const row = $(el).next();
      const tds = row.find("td");
      beds = parseInt(cleanText(tds.eq(0).text()), 10) || 0;
      bathsText = cleanText(tds.eq(1).text());
    }
  });

  // NEW: Handle condominium pages with detailsTableLeft structure
  if (beds === 0 && bathsText === "") {
    $("#PropertyDetailsCurrent table.detailsTableLeft tr, #PropertyDetails table.detailsTableLeft tr").each((i, el) => {
      const $row = $(el);
      const th = cleanText($row.find("th").first().text());
      const td = cleanText($row.find("td").first().text());

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

// Extract building area fields per building from appraisalAttributes tables
function extractBuildingAreas($) {
  const areasByBuilding = {}; // { buildingNumber: { total_area_sq_ft, area_under_air_sq_ft, heated_area_sq_ft, livable_area_sq_ft } }
  let currentBuilding = null;
  
  $('table.appraisalAttributes, table.appraisalDetails').each((tableIdx, table) => {
    const $table = $(table);
    let tableBuilding = null;
    
    // Check for building indicator in table header or preceding elements
    const $prev = $table.prevAll('.sectionSubTitle, .sectionTitle, th, h3, h4').first();
    if ($prev.length) {
      const prevText = cleanText($prev.text());
      tableBuilding = extractBuildingNumber(prevText);
    }
    
    $table.find('tr').each((i, el) => {
      const $row = $(el);
      const ths = $row.find('th');
      const tds = $row.find('td');
      
      // Check if this row indicates a building number
      if (ths.length > 0) {
        const headerText = cleanText(ths.first().text());
        const buildingFromHeader = extractBuildingNumber(headerText);
        if (buildingFromHeader) {
          currentBuilding = buildingFromHeader;
          tableBuilding = buildingFromHeader;
        }
      }
      
      if (tds.length > 0) {
        const firstCellText = cleanText($(tds[0]).text());
        if (/[A-Za-z]/.test(firstCellText) && /building|bldg/i.test(firstCellText)) {
          const buildingFromCell = extractBuildingNumber(firstCellText);
          if (buildingFromCell) {
            currentBuilding = buildingFromCell;
            tableBuilding = buildingFromCell;
          }
        }
      }
      
      const rowBuilding = tableBuilding || currentBuilding || 1;
      
      if (!areasByBuilding[rowBuilding]) {
        areasByBuilding[rowBuilding] = {
          total_area_sq_ft: null,
          area_under_air_sq_ft: null,
          heated_area_sq_ft: null,
          livable_area_sq_ft: null
        };
      }
      
      // Extract area fields from table rows
      // Look for patterns like "BAS - BASE", "FUS - FINISHED UPPER STORY", "Total", etc.
      if (tds.length >= 3) {
        const desc = cleanText($(tds[0]).text()).toUpperCase();
        const heated = tds.length >= 2 ? cleanText($(tds[1]).text()) : '';
        const areaText = tds.length >= 3 ? cleanText($(tds[2]).text()) : '';
        const area = parseInt(areaText.replace(/[^0-9]/g, ''), 10);
        
        if (Number.isFinite(area) && area > 0) {
          // Total area - sum of all areas for this building
          if (areasByBuilding[rowBuilding].total_area_sq_ft === null) {
            areasByBuilding[rowBuilding].total_area_sq_ft = 0;
          }
          areasByBuilding[rowBuilding].total_area_sq_ft += area;
          
          // Area under air (heated/cooled area)
          if (/^Y/i.test(heated)) {
            if (areasByBuilding[rowBuilding].area_under_air_sq_ft === null) {
              areasByBuilding[rowBuilding].area_under_air_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].area_under_air_sq_ft += area;
            
            // Heated area (same as area under air if heated)
            if (areasByBuilding[rowBuilding].heated_area_sq_ft === null) {
              areasByBuilding[rowBuilding].heated_area_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].heated_area_sq_ft += area;
          }
          
          // Livable area (excludes garages, porches, unfinished areas)
          if (!desc.includes('GARAGE') && !desc.includes('PORCH') && !desc.includes('CARPORT') && 
              !desc.includes('STORAGE') && !desc.includes('MECHANICAL') && /^Y/i.test(heated)) {
            if (areasByBuilding[rowBuilding].livable_area_sq_ft === null) {
              areasByBuilding[rowBuilding].livable_area_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].livable_area_sq_ft += area;
          }
        }
      }
      
      // Also check 4-column format [Description, ?, Heated, Area]
      if (tds.length >= 4) {
        const desc = cleanText($(tds[0]).text()).toUpperCase();
        const heated = cleanText($(tds[2]).text());
        const areaText = cleanText($(tds[3]).text());
        const area = parseInt(areaText.replace(/[^0-9]/g, ''), 10);
        
        if (Number.isFinite(area) && area > 0) {
          if (areasByBuilding[rowBuilding].total_area_sq_ft === null) {
            areasByBuilding[rowBuilding].total_area_sq_ft = 0;
          }
          areasByBuilding[rowBuilding].total_area_sq_ft += area;
          
          if (/^Y/i.test(heated)) {
            if (areasByBuilding[rowBuilding].area_under_air_sq_ft === null) {
              areasByBuilding[rowBuilding].area_under_air_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].area_under_air_sq_ft += area;
            
            if (areasByBuilding[rowBuilding].heated_area_sq_ft === null) {
              areasByBuilding[rowBuilding].heated_area_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].heated_area_sq_ft += area;
          }
          
          if (!desc.includes('GARAGE') && !desc.includes('PORCH') && !desc.includes('CARPORT') && 
              !desc.includes('STORAGE') && !desc.includes('MECHANICAL') && /^Y/i.test(heated)) {
            if (areasByBuilding[rowBuilding].livable_area_sq_ft === null) {
              areasByBuilding[rowBuilding].livable_area_sq_ft = 0;
            }
            areasByBuilding[rowBuilding].livable_area_sq_ft += area;
          }
        }
      }
    });
  });
  
  // If no buildings detected, try to extract from top level (fallback)
  if (Object.keys(areasByBuilding).length === 0) {
    let totalArea = 0;
    let areaUnderAir = 0;
    let heatedArea = 0;
    let livableArea = 0;
    
    $('table.appraisalAttributes tr, table.appraisalDetails tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 3) {
        const desc = cleanText($(tds[0]).text()).toUpperCase();
        const heated = cleanText($(tds[1]).text());
        const areaText = cleanText($(tds[2]).text());
        const area = parseInt(areaText.replace(/[^0-9]/g, ''), 10);
        
        if (Number.isFinite(area) && area > 0) {
          totalArea += area;
          if (/^Y/i.test(heated)) {
            areaUnderAir += area;
            heatedArea += area;
            if (!desc.includes('GARAGE') && !desc.includes('PORCH') && !desc.includes('CARPORT') && 
                !desc.includes('STORAGE') && !desc.includes('MECHANICAL')) {
              livableArea += area;
            }
          }
        }
      }
    });
    
    if (totalArea > 0) {
      areasByBuilding[1] = {
        total_area_sq_ft: totalArea > 0 ? totalArea : null,
        area_under_air_sq_ft: areaUnderAir > 0 ? areaUnderAir : null,
        heated_area_sq_ft: heatedArea > 0 ? heatedArea : null,
        livable_area_sq_ft: livableArea > 0 ? livableArea : null
      };
    }
  }
  
  return areasByBuilding;
}

function extractBuildingCharacteristics($) {
  const characteristicsByBuilding = {};
  let currentBuilding = null;

  $('table.appraisalAttributes, table.appraisalDetails').each((tableIdx, table) => {
    const $table = $(table);
    let tableBuilding = null;

    $table.find('tr').each((i, el) => {
      const $row = $(el);
      const ths = $row.find('th');

      if (ths.length > 0) {
        const headerText = cleanText($row.text());
        const buildingFromHeader = extractBuildingNumber(headerText);
        if (buildingFromHeader) {
          currentBuilding = buildingFromHeader;
          tableBuilding = buildingFromHeader;
        }
      }

      if (ths.length >= 4) {
        const labels = ths
          .toArray()
          .map((th) => cleanText($(th).text()).toLowerCase());

        const hasBedrooms = labels.some((label) => label.includes('bedrooms'));
        const hasBathrooms = labels.some((label) => label.includes('bathrooms'));
        const hasYearBuilt = labels.some((label) => label.includes('year built'));

        if (hasBedrooms && hasBathrooms && hasYearBuilt) {
          const dataRow = $row.next();
          if (!dataRow || !dataRow.length) {
            return;
          }

          const tds = dataRow.find('td');
          if (tds.length < 4) {
            return;
          }

          const buildingNum = tableBuilding || currentBuilding || 1;
          if (!characteristicsByBuilding[buildingNum]) {
            characteristicsByBuilding[buildingNum] = {};
          }

          const entry = characteristicsByBuilding[buildingNum];

          const bedroomsIdx = labels.findIndex((label) => label.includes('bedrooms'));
          if (bedroomsIdx >= 0 && bedroomsIdx < tds.length) {
            const bedValue = parseInt(cleanText($(tds[bedroomsIdx]).text()), 10);
            if (Number.isFinite(bedValue)) {
              entry.beds = bedValue;
            }
          }

          const bathroomsIdx = labels.findIndex((label) => label.includes('bathrooms'));
          if (bathroomsIdx >= 0 && bathroomsIdx < tds.length) {
            const bathText = cleanText($(tds[bathroomsIdx]).text());
            const bathNumber = parseFloat(bathText);
            if (!Number.isNaN(bathNumber)) {
              const fullBaths = Math.floor(bathNumber);
              const halfBaths = Math.round((bathNumber - fullBaths) * 2);
              entry.fullBaths = fullBaths;
              entry.halfBaths = halfBaths;
            }
          }

          const yearBuiltIdx = labels.findIndex((label) => label.includes('year built'));
          if (yearBuiltIdx >= 0 && yearBuiltIdx < tds.length) {
            const yearBuilt = parseInt(cleanText($(tds[yearBuiltIdx]).text()), 10);
            if (Number.isFinite(yearBuilt)) {
              entry.built_year = yearBuilt;
            }
          }
        }
      }
    });
  });

  return characteristicsByBuilding;
}

function isBedBathType(spaceType) {
  const t = String(spaceType || '').toLowerCase();
  return t.includes('bedroom') || t.includes('bathroom') || t.includes('powder room');
}

// Extract building number from various patterns
function extractBuildingNumber(text, currentBuilding = null) {
  if (!text) return currentBuilding;
  
  // Patterns: "Building 1", "Bldg 2", "Building #3", "Bldg #4", "#1", etc.
  // Also handle standalone numbers, "1", "2", etc. when in building context
  const patterns = [
    /Building\s+(\d+)\s+of\s+\d+/i, // "Building 1 of 5", "Building 2 of 5", etc.
    /Building\s*#?\s*(\d+)/i,
    /Bldg\s*#?\s*(\d+)/i,
    /^#\s*(\d+)/i,
    /Building\s+(\d+)/i,
    /Bldg\s+(\d+)/i,
    /^(\d+)$/, // Standalone number (if in building context)
    /\b(\d+)\s*[-–]\s*Building/i, // "1 - Building" or "1-Building"
    /Building\s*[-–]\s*(\d+)/i // "Building - 1" or "Building-1"
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 20) { // Reasonable building number range
        return num;
      }
    }
  }
  
  return currentBuilding;
}

// Extract subarea codes from structure data, grouped by building
function extractSubareaCodes($) {
  const subareasByBuilding = {}; // { buildingNumber: [subareas] }
  let currentBuilding = null;
  
  // First, try to detect building sections/headers
  // Also check for building numbers in section titles and headers before tables
  $('table.appraisalAttributes, table.appraisalDetails').each((tableIdx, table) => {
    const $table = $(table);
    let tableBuilding = null;
    
    // Check for building indicator in table header or preceding elements
    const $prev = $table.prevAll('.sectionSubTitle, .sectionTitle, th, h3, h4, .box, div').first();
    if ($prev.length) {
      const prevText = cleanText($prev.text());
      tableBuilding = extractBuildingNumber(prevText);
      if (tableBuilding) {
        currentBuilding = tableBuilding;
      }
    }
    
    // Also check parent containers for building indicators
    const $parent = $table.parent();
    if ($parent.length) {
      const parentText = cleanText($parent.text());
      const buildingFromParent = extractBuildingNumber(parentText);
      if (buildingFromParent) {
        tableBuilding = buildingFromParent;
        currentBuilding = buildingFromParent;
      }
    }
    
    // Look for subarea information in appraisal attributes table
    $table.find('tr').each((i, el) => {
      const $row = $(el);
      const ths = $row.find('th');
      const tds = $row.find('td');
      
      // Check if this row indicates a building number (check all th cells)
      if (ths.length > 0) {
        ths.each((idx, th) => {
          const headerText = cleanText($(th).text());
          const buildingFromHeader = extractBuildingNumber(headerText);
          if (buildingFromHeader) {
            currentBuilding = buildingFromHeader;
            tableBuilding = buildingFromHeader;
          }
        });
      }
      
      // Check first cell for building indicator
      if (tds.length > 0) {
        const firstCellText = cleanText($(tds[0]).text());
        if (/[A-Za-z]/.test(firstCellText) && /building|bldg/i.test(firstCellText)) {
          const buildingFromCell = extractBuildingNumber(firstCellText);
          if (buildingFromCell) {
            currentBuilding = buildingFromCell;
            tableBuilding = buildingFromCell;
          }
        }
      }
      
      // Use table-level building if set, otherwise use current
      const rowBuilding = tableBuilding || currentBuilding || 1; // Default to building 1
      
      // Newer structure: 3 columns [Description, Heated, Area]
      if (tds.length >= 3) {
        const descriptionCell = cleanText($(tds[0]).text());
        const heatedCell = cleanText($(tds[1]).text());
        const areaCell = cleanText($(tds[2]).text());
        const area = parseInt(areaCell.replace(/[^0-9]/g, ''), 10);
        const codeMatch = descriptionCell.match(/^\s*([A-Z0-9]{2,8})\b(?:\s*[-–]\s*(.+))?/i);
        if (codeMatch && Number.isFinite(area) && area > 0) {
          const code = codeMatch[1].toUpperCase();
          const description = (codeMatch[2] || '').trim();
          const mapped = SUBAREA_CODE_MAPPING[code] || null;
          // Include ALL mapped subareas, including bed/bath types (they should be layouts)
          if (mapped) {
            if (!subareasByBuilding[rowBuilding]) {
              subareasByBuilding[rowBuilding] = [];
            }
            subareasByBuilding[rowBuilding].push({
              code,
              description,
              spaceType: mapped,
              area,
              heated: /^Y/i.test(heatedCell),
              isExterior: isExteriorSpace(code, description),
              buildingNumber: rowBuilding
            });
          }
        }
        return;
      }

      // Fallback: 4 columns [Description, ?, Heated, Area]
      if (tds.length >= 4) {
        const desc = cleanText($(tds[0]).text());
        const heated = cleanText($(tds[2]).text());
        const areaText = cleanText($(tds[3]).text());
        const area = parseInt(areaText.replace(/[\,\s]/g, ''), 10);
        const codeMatch = desc.match(/^\s*([A-Z0-9]{2,8})\b(?:\s*[-–]\s*(.+))?/i);
        if (codeMatch && Number.isFinite(area) && area > 0) {
          const code = codeMatch[1].toUpperCase();
          const description = (codeMatch[2] || '').trim();
          const mapped = SUBAREA_CODE_MAPPING[code] || null;
          // Include ALL mapped subareas, including bed/bath types (they should be layouts)
          if (mapped) {
            if (!subareasByBuilding[rowBuilding]) {
              subareasByBuilding[rowBuilding] = [];
            }
            subareasByBuilding[rowBuilding].push({
              code,
              description,
              spaceType: mapped,
              area,
              heated: /^Y/i.test(heated),
              isExterior: isExteriorSpace(code, description),
              buildingNumber: rowBuilding
            });
          }
        }
      }
    });
  });
  
  // If no buildings detected, put everything in building 1
  if (Object.keys(subareasByBuilding).length === 0) {
    // Fallback: extract without building grouping
    const allSubareas = [];
    $('table.appraisalAttributes tr, table.appraisalDetails tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 3) {
        const descriptionCell = cleanText($(tds[0]).text());
        const heatedCell = cleanText($(tds[1]).text());
        const areaCell = cleanText($(tds[2]).text());
        const area = parseInt(areaCell.replace(/[^0-9]/g, ''), 10);
        const codeMatch = descriptionCell.match(/^\s*([A-Z0-9]{2,8})\b(?:\s*[-–]\s*(.+))?/i);
        if (codeMatch && Number.isFinite(area) && area > 0) {
          const code = codeMatch[1].toUpperCase();
          const description = (codeMatch[2] || '').trim();
          const mapped = SUBAREA_CODE_MAPPING[code] || null;
          // Include ALL mapped subareas, including bed/bath types (they should be layouts)
          if (mapped) {
            allSubareas.push({
              code,
              description,
              spaceType: mapped,
              area,
              heated: /^Y/i.test(heatedCell),
              isExterior: isExteriorSpace(code, description),
              buildingNumber: 1
            });
          }
        }
      }
    });
    if (allSubareas.length > 0) {
      subareasByBuilding[1] = allSubareas;
    }
  }
  
  return subareasByBuilding;
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
  const layout = {
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
  // building_number will be added separately when creating layouts
  return layout;
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

  let { beds, fullBaths, halfBaths } = getBedsBaths($);
  const layouts = [];
  let idx = 1;

  // Extract subarea codes grouped by building
  const subareasByBuilding = extractSubareaCodes($);
  const buildingCharacteristics = extractBuildingCharacteristics($);
  const buildingNumbers = Object.keys(subareasByBuilding).map(Number);
  const characteristicNumbers = Object.keys(buildingCharacteristics).map(Number);

  // Extract building area fields per building
  const buildingAreas = extractBuildingAreas($);

  if (process.env.LAYOUT_DEBUG === '1') {
    const debugPayload = {
      subareasByBuilding,
      buildingCharacteristics,
      buildingAreas,
    };
    const debugPath = process.env.LAYOUT_DEBUG_PATH
      ? path.resolve(process.env.LAYOUT_DEBUG_PATH)
      : path.resolve('layout_debug.json');
    fs.writeFileSync(debugPath, JSON.stringify(debugPayload, null, 2));
  }
  
  // Merge building numbers from both sources
  const allBuildingNumbers = Array.from(
    new Set([
      ...buildingNumbers,
      ...Object.keys(buildingAreas).map(Number),
      ...characteristicNumbers,
    ]),
  )
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  
  if (allBuildingNumbers.length === 0) {
    allBuildingNumbers.push(1); // Default to building 1
  }
  
  console.log(`Found ${allBuildingNumbers.length} building(s): ${allBuildingNumbers.join(', ')}`);
  
  // Create Building space_type layout for each building with area fields
  const buildingTargets = {};
  allBuildingNumbers.forEach(buildingNum => {
    const areas = buildingAreas[buildingNum] || {};
    const characteristics = buildingCharacteristics[buildingNum] || {};
    const buildingLayout = {
      space_type: 'Building',
      space_index: idx++,
      building_number: buildingNum,
      size_square_feet: areas.total_area_sq_ft || null,
      total_area_sq_ft: areas.total_area_sq_ft || null,
      area_under_air_sq_ft: areas.area_under_air_sq_ft || null,
      heated_area_sq_ft: areas.heated_area_sq_ft || null,
      livable_area_sq_ft: areas.livable_area_sq_ft || null,
      built_year: Number.isFinite(characteristics.built_year) ? characteristics.built_year : null,
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
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
    };
    layouts.push(buildingLayout);
    buildingTargets[buildingNum] = {
      beds: Number.isFinite(characteristics.beds) ? characteristics.beds : null,
      fullBaths: Number.isFinite(characteristics.fullBaths) ? characteristics.fullBaths : null,
      halfBaths: Number.isFinite(characteristics.halfBaths) ? characteristics.halfBaths : null,
    };
    console.log(
      `  Created Building layout for building ${buildingNum} with areas: total=${areas.total_area_sq_ft || 'N/A'}, under_air=${areas.area_under_air_sq_ft || 'N/A'}, heated=${areas.heated_area_sq_ft || 'N/A'}, livable=${areas.livable_area_sq_ft || 'N/A'}, built_year=${buildingLayout.built_year || 'N/A'}`,
    );
  });

  // Create subarea layouts for each building
  allBuildingNumbers.forEach(buildingNum => {
    const subareas = subareasByBuilding[buildingNum] || [];
    console.log(`Building ${buildingNum}: Found ${subareas.length} subarea codes`);
    subareas.forEach(subarea => {
      console.log(`  ${subarea.code}: ${subarea.description} -> ${subarea.spaceType} (${subarea.area} sq ft)`);
      const layout = defaultLayout(subarea.spaceType, idx++, subarea.area, subarea.isExterior);
      layout.building_number = buildingNum; // Add building_number to each subarea layout
      layouts.push(layout);
    });
  });

  const existingCountsByBuilding = {};
  const ensureCounts = (buildingNum) => {
    if (!existingCountsByBuilding[buildingNum]) {
      existingCountsByBuilding[buildingNum] = {
        beds: 0,
        fullBaths: 0,
        halfBaths: 0,
      };
    }
    return existingCountsByBuilding[buildingNum];
  };

  layouts.forEach((layout) => {
    const buildingNum = layout.building_number ?? (allBuildingNumbers[0] || 1);
    const counts = ensureCounts(buildingNum);
    const st = String(layout.space_type || '').toLowerCase();
    if (st.includes('bedroom')) counts.beds += 1;
    if (st.includes('full bathroom')) counts.fullBaths += 1;
    if (st.includes('half bathroom') || st.includes('powder room')) counts.halfBaths += 1;
  });

  const sumTargetBeds = allBuildingNumbers.reduce(
    (sum, buildingNum) => sum + (Number.isFinite(buildingTargets[buildingNum]?.beds) ? buildingTargets[buildingNum].beds : 0),
    0,
  );
  if (sumTargetBeds > 0) {
    beds = sumTargetBeds;
  }

  const sumTargetFullBaths = allBuildingNumbers.reduce(
    (sum, buildingNum) => sum + (Number.isFinite(buildingTargets[buildingNum]?.fullBaths) ? buildingTargets[buildingNum].fullBaths : 0),
    0,
  );
  if (sumTargetFullBaths > 0) {
    fullBaths = sumTargetFullBaths;
  }

  const sumTargetHalfBaths = allBuildingNumbers.reduce(
    (sum, buildingNum) => sum + (Number.isFinite(buildingTargets[buildingNum]?.halfBaths) ? buildingTargets[buildingNum].halfBaths : 0),
    0,
  );
  if (sumTargetHalfBaths > 0) {
    halfBaths = sumTargetHalfBaths;
  }

  allBuildingNumbers.forEach((buildingNum) => {
    const counts = ensureCounts(buildingNum);
    const targets = buildingTargets[buildingNum] || {};

    const targetBeds = Number.isFinite(targets.beds) ? targets.beds : 0;
    let missingBeds = Math.max(0, targetBeds - counts.beds);
    while (missingBeds > 0) {
      const bedLayout = defaultLayout("Bedroom", idx++, null);
      bedLayout.building_number = buildingNum;
      layouts.push(bedLayout);
      counts.beds += 1;
      missingBeds -= 1;
    }

    const targetFullBaths = Number.isFinite(targets.fullBaths) ? targets.fullBaths : 0;
    let missingFullBaths = Math.max(0, targetFullBaths - counts.fullBaths);
    while (missingFullBaths > 0) {
      const bathLayout = defaultLayout("Full Bathroom", idx++, null);
      bathLayout.building_number = buildingNum;
      layouts.push(bathLayout);
      counts.fullBaths += 1;
      missingFullBaths -= 1;
    }

    const targetHalfBaths = Number.isFinite(targets.halfBaths) ? targets.halfBaths : 0;
    let missingHalfBaths = Math.max(0, targetHalfBaths - counts.halfBaths);
    while (missingHalfBaths > 0) {
      const halfBathLayout = defaultLayout("Half Bathroom / Powder Room", idx++, null);
      halfBathLayout.building_number = buildingNum;
      layouts.push(halfBathLayout);
      counts.halfBaths += 1;
      missingHalfBaths -= 1;
    }
  });

  const totalBedsAfterTargets = allBuildingNumbers.reduce((sum, buildingNum) => sum + ensureCounts(buildingNum).beds, 0);
  let remainingBeds = Math.max(0, beds - totalBedsAfterTargets);
  while (remainingBeds > 0) {
    for (const buildingNum of allBuildingNumbers) {
      if (remainingBeds <= 0) break;
      const bedLayout = defaultLayout("Bedroom", idx++, null);
      bedLayout.building_number = buildingNum;
      layouts.push(bedLayout);
      ensureCounts(buildingNum).beds += 1;
      remainingBeds -= 1;
    }
  }

  const totalFullBathsAfterTargets = allBuildingNumbers.reduce((sum, buildingNum) => sum + ensureCounts(buildingNum).fullBaths, 0);
  let remainingFullBaths = Math.max(0, fullBaths - totalFullBathsAfterTargets);
  while (remainingFullBaths > 0) {
    for (const buildingNum of allBuildingNumbers) {
      if (remainingFullBaths <= 0) break;
      const bathLayout = defaultLayout("Full Bathroom", idx++, null);
      bathLayout.building_number = buildingNum;
      layouts.push(bathLayout);
      ensureCounts(buildingNum).fullBaths += 1;
      remainingFullBaths -= 1;
    }
  }

  const totalHalfBathsAfterTargets = allBuildingNumbers.reduce((sum, buildingNum) => sum + ensureCounts(buildingNum).halfBaths, 0);
  let remainingHalfBaths = Math.max(0, halfBaths - totalHalfBathsAfterTargets);
  while (remainingHalfBaths > 0) {
    for (const buildingNum of allBuildingNumbers) {
      if (remainingHalfBaths <= 0) break;
      const halfBathLayout = defaultLayout("Half Bathroom / Powder Room", idx++, null);
      halfBathLayout.building_number = buildingNum;
      layouts.push(halfBathLayout);
      ensureCounts(buildingNum).halfBaths += 1;
      remainingHalfBaths -= 1;
    }
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