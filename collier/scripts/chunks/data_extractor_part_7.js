            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_company_${ci + 1}_${si + 1}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
          });
        });
      }
    }
  }

  // Utilities from owners/utilities_data.json
  const utilsEntry = utils[ownerKey];
  if (utilsEntry) {
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilsEntry, null, 2),
    );
  }

  // Layouts from owners/layout_data.json
  let layoutIdx = 1;
  const layoutEntry = layouts[ownerKey];
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    for (const lay of layoutEntry.layouts) {
      if (lay && Object.keys(lay).length > 0) {
        // Ensure space_index is an integer
        if (lay.space_index === null || lay.space_index === undefined) {
          lay.space_index = layoutIdx;
        }

        // Ensure is_finished is a boolean
        if (typeof lay.is_finished !== 'boolean') {
          // Default: exterior spaces are not finished, interior spaces are finished
          lay.is_finished = lay.is_exterior === false;
        }

        fs.writeFileSync(
          path.join(dataDir, `layout_${layoutIdx}.json`),
          JSON.stringify(lay, null, 2),
        );
        layoutIdx++;
      }
    }
  }

  // Extract pool, spa, and other exterior features from Building/Extra Features
  const poolFenceExists = [];
  const fountainExists = [];

  // First pass: identify pool fence and fountain for later reference
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const buildingClass = $(el).text().trim().toUpperCase();
    if (buildingClass.includes("POOL") && buildingClass.includes("FENCE")) {
      poolFenceExists.push(true);
    }
    if (buildingClass.includes("FOUNTAIN")) {
      fountainExists.push(true);
    }
  });

  // Second pass: create layout entries for features
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim().toUpperCase();
    const spanId = $span.attr("id");

    // Extract building number from span ID
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];

    // Get year built and area
    const yrSpan = $(`#YRBUILT${buildingNum}`);
    const yr = yrSpan.text().trim();
    const areaSpan = $(`#BASEAREA${buildingNum}`);
    const areaText = areaSpan.text().trim();
    const area = areaText ? parseFloat(areaText.replace(/[^0-9.]/g, "")) : null;

    let layoutObj = null;

    // Helper function to create complete layout object
    const createLayoutObj = (spaceType, isExterior, idx, customFields = {}) => {
      return {
        adjustable_area_sq_ft: null,
        area_under_air_sq_ft: null,
        bathroom_renovation_date: null,
        building_number: null,
        cabinet_style: null,
        clutter_level: null,
        condition_issues: null,
        countertop_material: null,
        decor_elements: null,
        design_style: null,
        fixture_finish_quality: null,
        floor_level: null,
        flooring_installation_date: null,
        flooring_material_type: null,
        flooring_wear: null,
        furnished: null,
        has_windows: null,
        heated_area_sq_ft: null,
        is_exterior: isExterior,
        is_finished: !isExterior, // Exterior spaces are not finished; interior spaces are finished
        kitchen_renovation_date: null,
        lighting_features: null,
        livable_area_sq_ft: null,
        natural_light_quality: null,
        paint_condition: null,
        pool_condition: null,
        pool_equipment: null,
        pool_installation_date: null,
        pool_surface_type: null,
        pool_type: null,
        pool_water_quality: null,
        request_identifier: null,
        safety_features: null,
        size_square_feet: area && !isNaN(area) && area > 0 ? area : null,
        spa_installation_date: null,
        spa_type: null,
        space_index: idx, // Use the layout index as space_index
        space_type_index: "1",
        space_type: spaceType,
        story_type: null,
        total_area_sq_ft: null,
        view_type: null,
        visible_damage: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        ...customFields, // Override with specific values
      };
    };

    // POOL
    if (buildingClass.includes("POOL") && !buildingClass.includes("FENCE") && !buildingClass.includes("HOUSE")) {
      const customFields = {
        pool_installation_date: yr ? `${yr}-01-01` : null,
      };

      // Add safety features if pool fence exists
      if (poolFenceExists.length > 0) {
        customFields.safety_features = "Fencing";
      }

      // Add pool equipment if fountain exists
      if (fountainExists.length > 0) {
        customFields.pool_equipment = "Fountain";
