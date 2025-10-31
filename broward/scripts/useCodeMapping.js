// useCodeMapping.js
// Comprehensive mapping of Broward County use codes to Lexicon property fields
// Maps useCode to: property_type, property_usage_type, ownership_estate_type, structure_form

/**
 * Maps a Broward County use code to property classification fields
 * @param {string} useCode - The use code from Broward County (e.g., "01-01", "11-01")
 * @param {string} useCodeDescription - The description of the use code
 * @returns {Object} Object with property_type, property_usage_type, ownership_estate_type, structure_form
 */
function mapUseCodeToPropertyFields(useCode, useCodeDescription = "") {
  if (!useCode) {
    throw new Error("useCode is required for property classification");
  }

  const code = String(useCode).trim();
  const desc = String(useCodeDescription).toLowerCase();

  // Extract the major category (first two digits)
  const majorCode = code.substring(0, 2);

  // Default values
  let property_type = null;
  let property_usage_type = null;
  let ownership_estate_type = null;
  let structure_form = null;

  // RESIDENTIAL CATEGORIES (00-09)
  if (majorCode === "00") {
    // Vacant Residential
    property_type = "VacantLand";
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";

    if (code === "00-02") {
      ownership_estate_type = "Condominium";
    } else if (code === "00-03") {
      property_type = "ResidentialCommonElementsAreas";
      property_usage_type = "ResidentialCommonElementsAreas";
    }
  }
  else if (majorCode === "01") {
    // Single Family
    property_type = "SingleFamily";
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";
    structure_form = "SingleFamilyDetached";

    if (code === "01-04") {
      property_type = "Townhouse";
      structure_form = "TownhouseRowhouse";
    } else if (code === "01-05") {
      // Zero Lot Line - still single family but semi-detached
      structure_form = "SingleFamilySemiDetached";
    } else if (code === "01-06") {
      // Attached 1-story
      structure_form = "SingleFamilySemiDetached";
    }
  }
  else if (majorCode === "02") {
    // Manufactured/Modular Housing
    property_type = "ManufacturedHousing";
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";

    if (code === "02-01") {
      property_type = "ManufacturedHousingSingleWide";
      structure_form = "ManufacturedHousingSingleWide";
    } else if (code === "02-02" || code === "02-03") {
      property_type = "ManufacturedHousingMultiWide";
      structure_form = "ManufacturedHousingMultiWide";
    } else if (code === "02-99") {
      property_type = "VacantLand";
    }
  }
  else if (majorCode === "03") {
    // Multi-family 10+ units
    property_type = "MultiFamilyMoreThan10";
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";
    structure_form = "MultiFamilyMoreThan10";

    if (code === "03-99") {
      property_type = "VacantLand";
    }
  }
  else if (majorCode === "04") {
    // Condominium - Residential
    property_type = "Condominium";
    property_usage_type = "Residential";
    ownership_estate_type = "Condominium";

    if (code === "04-02") {
      property_type = "DetachedCondominium";
      structure_form = "SingleFamilyDetached";
    } else if (code === "04-03") {
      structure_form = "ManufacturedHousing";
    } else if (code === "04-04") {
      property_type = "Timeshare";
      ownership_estate_type = "Timeshare";
    } else if (code === "04-06") {
      property_type = "ResidentialCommonElementsAreas";
      property_usage_type = "ResidentialCommonElementsAreas";
    } else if (code === "04-99") {
      property_type = "NonWarrantableCondo";
      ownership_estate_type = "NonWarrantableCondo";
    }
  }
  else if (majorCode === "05") {
    // Cooperatives - Residential
    property_type = "Cooperative";
    property_usage_type = "Residential";
    ownership_estate_type = "Cooperative";

    if (code === "05-02") {
      structure_form = "SingleFamilyDetached";
    } else if (code === "05-03" || code === "05-04" || code === "05-05" || code === "05-06") {
      structure_form = "ManufacturedHousing";
    } else if (code === "05-99") {
      property_type = "VacantLand";
    }
  }
  else if (majorCode === "06") {
    // Retirement homes
    property_type = "Retirement";
    property_usage_type = "Retirement";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "07" || majorCode === "09") {
    // Miscellaneous residential
    property_type = "MiscellaneousResidential";
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";

    if (desc.includes("common area") || desc.includes("common elements")) {
      property_type = "ResidentialCommonElementsAreas";
      property_usage_type = "ResidentialCommonElementsAreas";
    }
  }
  else if (majorCode === "08") {
    // Multi-family 2-9 units
    if (code === "08-02") {
      property_type = "Duplex";
      structure_form = "Duplex";
    } else if (code === "08-03") {
      property_type = "3Units";
      structure_form = "Triplex";
    } else if (code === "08-04") {
      property_type = "4Units";
      structure_form = "Quadplex";
    } else if (code === "08-05") {
      property_type = "MultiFamilyLessThan10";
      structure_form = "MultiFamilyLessThan10";
    } else if (code === "08-08") {
      property_type = "Townhouse";
      structure_form = "TownhouseRowhouse";
    } else {
      property_type = "MultipleFamily";
      structure_form = "MultiFamilyLessThan10";
    }
    property_usage_type = "Residential";
    ownership_estate_type = "FeeSimple";
  }

  // COMMERCIAL CATEGORIES (10-39)
  else if (majorCode === "10") {
    // Vacant Commercial
    property_type = "VacantLand";
    property_usage_type = "Commercial";
    ownership_estate_type = "FeeSimple";

    if (code === "10-04") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "11") {
    // Retail Store
    property_type = "Building";
    property_usage_type = "RetailStore";
    ownership_estate_type = "FeeSimple";

    if (code === "11-04") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "12") {
    // Mixed use
    property_type = "Building";
    property_usage_type = "Commercial";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "13") {
    // Department Stores
    property_type = "Building";
    property_usage_type = "DepartmentStore";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "14") {
    // Supermarkets
    property_type = "Building";
    property_usage_type = "Supermarket";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "15") {
    // Regional Shopping Center
    property_type = "Building";
    property_usage_type = "ShoppingCenterRegional";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "16") {
    // Shopping Center - Community/Neighborhood
    property_type = "Building";
    property_usage_type = "ShoppingCenterCommunity";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "17" || majorCode === "18") {
    // Office buildings
    property_type = "Building";
    property_usage_type = "OfficeBuilding";
    ownership_estate_type = "FeeSimple";

    if (code === "17-04" || code === "18-04") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "19") {
    // Professional buildings
    property_type = "Building";
    property_usage_type = "MedicalOffice";
    ownership_estate_type = "FeeSimple";

    if (code === "19-04") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "20") {
    // Transportation terminals (airports, marinas, etc.)
    property_type = "Building";
    property_usage_type = "TransportationTerminal";
    ownership_estate_type = "FeeSimple";

    if (code === "20-04" || code === "20-05") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "21" || majorCode === "22") {
    // Restaurants
    property_type = "Building";
    property_usage_type = "Restaurant";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "23") {
    // Financial Institution
    property_type = "Building";
    property_usage_type = "FinancialInstitution";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "24") {
    // Insurance company offices
    property_type = "Building";
    property_usage_type = "OfficeBuilding";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "25") {
    // Repair services
    property_type = "Building";
    property_usage_type = "Commercial";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "26") {
    // Service Station
    property_type = "Building";
    property_usage_type = "ServiceStation";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "27") {
    // Auto sales/repair
    property_type = "Building";
    property_usage_type = "AutoSalesRepair";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "28") {
    // Parking/Mobile Home Parks
    if (code === "28-03" || code === "28-04" || code === "28-05") {
      property_type = "Building";
      property_usage_type = "MobileHomePark";
    } else {
      property_type = "LandParcel";
      property_usage_type = "Commercial";
    }
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "29") {
    // Wholesale outlets
    property_type = "Building";
    property_usage_type = "WholesaleOutlet";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "30") {
    // Nursery/Greenhouse
    property_type = "Building";
    property_usage_type = "NurseryGreenhouse";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "31" || majorCode === "32") {
    // Theaters
    property_type = "Building";
    property_usage_type = "Theater";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "33" || majorCode === "34" || majorCode === "35") {
    // Entertainment facilities
    property_type = "Building";
    property_usage_type = "Entertainment";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "36") {
    // Camps
    property_type = "Building";
    property_usage_type = "Recreational";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "37") {
    // Race tracks / Casinos
    property_type = "Building";
    property_usage_type = "RaceTrack";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "38") {
    // Golf courses
    property_type = "LandParcel";
    property_usage_type = "GolfCourse";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "39") {
    // Hotels/Motels
    property_type = "Building";
    property_usage_type = "Hotel";
    ownership_estate_type = "FeeSimple";

    if (code === "39-05") {
      ownership_estate_type = "Condominium";
    }
  }

  // INDUSTRIAL CATEGORIES (40-49)
  else if (majorCode === "40") {
    // Vacant Industrial
    property_type = "VacantLand";
    property_usage_type = "Industrial";
    ownership_estate_type = "FeeSimple";

    if (code === "40-04") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "41") {
    // Light Manufacturing
    property_type = "Building";
    property_usage_type = "LightManufacturing";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "42") {
    // Heavy Industrial
    property_type = "Building";
    property_usage_type = "HeavyManufacturing";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "43") {
    // Lumber yards
    property_type = "Building";
    property_usage_type = "LumberYard";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "44") {
    // Packing Plants
    property_type = "Building";
    property_usage_type = "PackingPlant";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "45" || majorCode === "46") {
    // Canneries / Food Processing
    property_type = "Building";
    property_usage_type = "Cannery";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "47") {
    // Mineral Plants
    property_type = "Building";
    property_usage_type = "MineralProcessing";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "48") {
    // Warehousing
    property_type = "Building";
    property_usage_type = "Warehouse";
    ownership_estate_type = "FeeSimple";

    if (code === "48-05") {
      ownership_estate_type = "Condominium";
    }
  }
  else if (majorCode === "49") {
    // Open Storage
    property_type = "LandParcel";
    property_usage_type = "OpenStorage";
    ownership_estate_type = "FeeSimple";
  }

  // AGRICULTURAL CATEGORIES (50-69)
  else if (majorCode === "50") {
    // Improved Agriculture
    property_type = "LandParcel";
    property_usage_type = "Agricultural";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "51" || majorCode === "52" || majorCode === "53") {
    // Cropland
    property_type = "LandParcel";

    if (majorCode === "51") {
      property_usage_type = "CroplandClass2"; // Class I is best quality
    } else if (majorCode === "52") {
      property_usage_type = "CroplandClass2";
    } else {
      property_usage_type = "CroplandClass3";
    }
    ownership_estate_type = "FeeSimple";
  }
  else if (["54", "55", "56", "57", "58", "59"].includes(majorCode)) {
    // Timberland
    property_type = "LandParcel";
    property_usage_type = "TimberLand";
    ownership_estate_type = "FeeSimple";
  }
  else if (["60", "61", "62", "63", "64", "65"].includes(majorCode)) {
    // Grazing Land
    property_type = "LandParcel";
    property_usage_type = "GrazingLand";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "66") {
    // Orchard Groves
    property_type = "LandParcel";
    property_usage_type = "OrchardGroves";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "67") {
    // Poultry / Aquaculture
    if (desc.includes("tropical fish")) {
      property_usage_type = "Aquaculture";
    } else {
      property_usage_type = "Poultry";
    }
    property_type = "LandParcel";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "68") {
    // Dairies, Feed Lots
    property_type = "LandParcel";
    property_usage_type = "LivestockFacility";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "69") {
    // Ornamentals
    property_type = "LandParcel";
    property_usage_type = "Ornamentals";
    ownership_estate_type = "FeeSimple";
  }

  // INSTITUTIONAL CATEGORIES (70-79)
  else if (majorCode === "70") {
    // Vacant Institutional
    property_type = "VacantLand";
    property_usage_type = "Residential"; // Default, may vary
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "71") {
    // Churches
    property_type = "Building";
    property_usage_type = "Church";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "72") {
    // Private Schools
    property_type = "Building";
    property_usage_type = "PrivateSchool";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "73") {
    // Private Hospitals
    property_type = "Building";
    property_usage_type = "PrivateHospital";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "74") {
    // Homes for the aged
    property_type = "Building";
    property_usage_type = "HomesForAged";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "75") {
    // Charitable services / HOA
    property_type = "Building";
    property_usage_type = "NonProfitCharity";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "76") {
    // Mortuaries/Cemeteries
    property_type = "LandParcel";
    property_usage_type = "MortuaryCemetery";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "77") {
    // Clubs/Lodges
    property_type = "Building";
    property_usage_type = "ClubsLodges";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "78") {
    // Nursing homes
    property_type = "Building";
    property_usage_type = "SanitariumConvalescentHome";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "79") {
    // Cultural organizations
    property_type = "Building";
    property_usage_type = "CulturalOrganization";
    ownership_estate_type = "FeeSimple";
  }

  // GOVERNMENTAL CATEGORIES (80-98)
  else if (majorCode === "80") {
    // Vacant Governmental
    property_type = "VacantLand";
    property_usage_type = "GovernmentProperty";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "81") {
    // Military
    property_type = "Building";
    property_usage_type = "Military";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "82") {
    // Forest, parks, recreational
    property_type = "LandParcel";
    property_usage_type = "ForestParkRecreation";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "83") {
    // Public Schools
    property_type = "Building";
    property_usage_type = "PublicSchool";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "84") {
    // Colleges
    property_type = "Building";
    property_usage_type = "PrivateSchool";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "85") {
    // Public Hospitals
    property_type = "Building";
    property_usage_type = "PublicHospital";
    ownership_estate_type = "FeeSimple";
  }
  else if (["86", "87", "88", "89"].includes(majorCode)) {
    // Government owned (County, State, Federal, Municipal)
    property_type = "Building";
    property_usage_type = "GovernmentProperty";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "90") {
    // Leasehold Interest Government property
    property_type = "LandParcel";
    property_usage_type = "GovernmentProperty";
    ownership_estate_type = "Leasehold";
  }
  else if (majorCode === "91") {
    // Utility
    property_type = "Building";
    property_usage_type = "Utility";
    ownership_estate_type = "FeeSimple";

    if (code === "91-07") {
      ownership_estate_type = "RightOfWay";
    }
  }
  else if (majorCode === "92") {
    // Mining lands
    property_type = "LandParcel";
    property_usage_type = "Industrial";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "93") {
    // Subsurface rights
    property_type = "LandParcel";
    property_usage_type = "Industrial";
    ownership_estate_type = "SubsurfaceRights";
  }
  else if (majorCode === "94") {
    // Right of Way
    property_type = "LandParcel";
    property_usage_type = "GovernmentProperty";
    ownership_estate_type = "RightOfWay";
  }
  else if (majorCode === "95") {
    // Submerged Lands / Rivers / Lakes
    property_type = "LandParcel";
    property_usage_type = "RiversLakes";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "96") {
    // Environmentally sensitive / Waste lands
    property_type = "LandParcel";

    if (desc.includes("sewage")) {
      property_usage_type = "SewageDisposal";
    } else {
      property_usage_type = "Conservation";
    }
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "97") {
    // Outdoor recreation
    property_type = "LandParcel";
    property_usage_type = "Recreational";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "98") {
    // Centrally assessed
    property_type = "Building";
    property_usage_type = "Utility";
    ownership_estate_type = "FeeSimple";
  }
  else if (majorCode === "99") {
    // Acreage not zoned agriculture
    property_type = "LandParcel";
    property_usage_type = "Unknown";
    ownership_estate_type = "FeeSimple";
  }
  else {
    throw new Error(`Unknown use code: ${code}. Cannot determine property classification.`);
  }

  return {
    property_type,
    property_usage_type,
    ownership_estate_type,
    structure_form,
  };
}

module.exports = {
  mapUseCodeToPropertyFields,
};
