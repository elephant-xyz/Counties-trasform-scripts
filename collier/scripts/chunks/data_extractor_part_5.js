  const township = getCellText($, "#Township");
  const range = getCellText($, "#Range");
  const municipality = getCellText($, "#Municipality");
  const totalAcresText = getCellText($, "#TotalAcres");
  const totalAcres = totalAcresText ? toNumberCurrency(totalAcresText) : null;
  const totalLandSquareFeet = toNumberCurrency(getCellText($, "#TOTALUNITS1"));

  // Property JSON
  const property = {
    request_identifier: folio,
    livable_floor_area: null,
    parcel_identifier: parcelId,
    property_legal_description_text: legalText,
    property_structure_built_year: null,
    property_type: null,
    property_usage_type: null,
    area_under_air: null,
    historic_designation: undefined,
    number_of_units: null,
    number_of_units_type: null,
    property_effective_built_year: null,
    subdivision: subdivision || null,
    total_area: null,
    building_adjusted_area: null,
    lot_size_square_feet: null,
    lot_size_acres: null,
    zoning: null,
  };

  // property_type and property_usage_type
  if (useCodeText) {
    property.property_type = extractPropertyType(useCodeText);
    property.property_usage_type = extractPropertyUsageType(useCodeText);
  }

  // Year built and areas from Building/Extra Features
  // Positive list: These ARE residential structures that should be included
  const residentialTypes = [
    /SINGLE\s+FAMILY\s+RESIDENCE/i,
    /SINGLE\s+FAMILY/i,
    /CONDO/i,
    /CONDOMINIUM/i,
    /HOMEOWNERS/i,
    /MULTI[-\s]*FAMILY/i,
    /MOBILE\s+HOME/i,
    /MANUFACTURED\s+HOME/i,
    /DUPLEX/i,
    /TRIPLEX/i,
    /FOURPLEX/i,
    /TOWNHOUSE/i,
    /TOWNHOME/i,
    /APARTMENT/i,
    /RESIDENTIAL\s+STYLE\s+BUILDING/i,
    /RESIDENTIAL\s+BUILDING/i,
  ];

  let yearBuilt = null;
  let totalBaseArea = 0;
  let totalAdjArea = 0;
  let hasAnyResidentialBuildings = false;

  // Find all BLDGCLASS spans and process each building
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim();
    const spanId = $span.attr("id");

    if (!buildingClass) return;

    // Extract building number from span ID (e.g., "BLDGCLASS1" -> "1")
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];

    // Check if this matches any residential pattern
    const isResidential = residentialTypes.some(pattern => pattern.test(buildingClass));

    if (isResidential) {
      hasAnyResidentialBuildings = true;

      // Get year built from first residential building
      if (!yearBuilt) {
        const yrSpan = $(`#YRBUILT${buildingNum}`);
        const yr = yrSpan.text().trim();
        if (yr) yearBuilt = parseInt(yr, 10);
      }

      // Sum base area
      const baseAreaSpan = $(`#BASEAREA${buildingNum}`);
      const baseAreaText = baseAreaSpan.text().trim();
      if (baseAreaText) {
        const num = parseFloat(baseAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalBaseArea += num;
        }
      }

      // Sum adjusted area
      const adjAreaSpan = $(`#TYADJAREA${buildingNum}`);
      const adjAreaText = adjAreaSpan.text().trim();
      if (adjAreaText) {
        const num = parseFloat(adjAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalAdjArea += num;
        }
      }
    }
  });

  if (yearBuilt) property.property_structure_built_year = yearBuilt;
  // Only set area if >= 10 sq ft (values < 10 are unrealistic and fail validation)
  if (hasAnyResidentialBuildings && totalBaseArea >= 10) {
    property.livable_floor_area = totalBaseArea;
    property.area_under_air = totalBaseArea;
  }
  if (hasAnyResidentialBuildings && totalAdjArea >= 10) {
    property.total_area = totalAdjArea;
    property.building_adjusted_area = totalAdjArea;
  }

  if (totalLandSquareFeet != null && totalLandSquareFeet > 0) {
    property.lot_size_square_feet = totalLandSquareFeet;
  }
  if (totalAcres != null && totalAcres > 0) {
    property.lot_size_acres = totalAcres;
  }

  // Write property.json
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // Address
  const countyName =
    unaddr.county_jurisdiction === "Collier"
      ? "Collier"
      : unaddr.county_jurisdiction || null;
  const addressObj = parseAddress(
    fullAddress,
    legalText,
    section,
    township,
    range,
    countyName,
    municipality,
    folio,
  );
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addressObj, null, 2),
  );

  // Sales + Deeds - from Summary sales table
  const saleRows = [];
  for (let idx = 1; idx <= 25; idx++) {
    const dateTxt = getCellText($, `#SaleDate${idx}`);
    const amountTxt = getCellText($, `#SaleAmount${idx}`);
    const bookPage =
      getCellText(
        $,
        `table.clsWide > tfoot.clsNoBorderBox > tr:nth-child(${idx}) > td.clsLabelnt:nth-child(2) > a`,
      ) || getCellText($, `#TrSale${idx} td:nth-child(2) a`);

    if (!dateTxt && !amountTxt && !bookPage) {
      if (idx > 5) break;
      continue;
    }

    saleRows.push({
      rowIndex: idx,
      dateTxt: dateTxt || null,
      iso: parseDateToISO(dateTxt),
      amount: toNumberCurrency(amountTxt),
