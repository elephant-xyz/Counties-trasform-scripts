  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

  // Building permits and certificates of occupancy
  $("#PermitAdditional tr[id^=TrPermit]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrPermit(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const permitNumber = getCellText($, `#permitno${idx}`);
    const permitType = getCellText($, `#permittype${idx}`);
    const issuer = getCellText($, `#issuer${idx}`);
    const issueDateText = getCellText($, `#IssuedDate${idx}`);
    const coDateText = getCellText($, `#codate${idx}`);
    const taxYearText = getCellText($, `#taxyear${idx}`);
    const issueDate = parseDateToISO(issueDateText || "");
    const coDate = parseDateToISO(coDateText || "");
    const taxYearPermit = toNumberCurrency(taxYearText);
    const hasAnyRawValue = [
      permitNumber,
      permitType,
      issuer,
      issueDateText,
      coDateText,
      taxYearText,
    ].some((value) => value != null && String(value).trim().length > 0);

    if (!hasAnyRawValue && taxYearPermit == null) {
      return;
    }

    const permitObj = {
      parcel_identifier: parcelId,
      permit_identifier: permitNumber,
      permit_type_description: permitType,
      issuing_authority: issuer,
      permit_issue_date: issueDate,
      certificate_of_occupancy_date: coDate,
      tax_year: taxYearPermit != null ? Math.trunc(taxYearPermit) : null,
    };
    const permitSourceFields = {};
    if (issueDateText) {
      permitSourceFields.permit_issue_date_text = issueDateText;
    }
    addSelectorSource(
      permitSourceFields,
      `#IssuedDate${idx}`,
      issueDateText,
    );
    if (coDateText) {
      permitSourceFields.certificate_of_occupancy_date_text = coDateText;
    }
    addSelectorSource(
      permitSourceFields,
      `#codate${idx}`,
      coDateText,
    );
    if (taxYearText) {
      permitSourceFields.tax_year_text = taxYearText;
    }
    addSelectorSource(
      permitSourceFields,
      `#taxyear${idx}`,
      taxYearText,
    );
    if (Object.keys(permitSourceFields).length > 0) {
      permitObj.source_fields = permitSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `permit_${idx}.json`),
      JSON.stringify(permitObj, null, 2),
    );
  });

  // Tax from Summary and History
  // From Summary (preliminary/current)
  let rollType = (
    $("#RollType").first().text().trim() ||
    $("#RollType2").first().text().trim() ||
    ""
  ).toUpperCase();
  let ty = null;
  const mYear = rollType.match(/(\d{4})/);
  if (mYear) ty = parseInt(mYear[1], 10);
  const landText = getCellText($, "#LandJustValue");
  const landRaw = getRawSelectorText($, "#LandJustValue");
  const land = toNumberCurrency(landText);
  const imprText = getCellText($, "#ImprovementsJustValue");
  const imprRaw = getRawSelectorText($, "#ImprovementsJustValue");
  const impr = toNumberCurrency(imprText);
  const justText = getCellText($, "#TotalJustValue");
  const justRaw = getRawSelectorText($, "#TotalJustValue");
  const just = toNumberCurrency(justText);
  let assessedText = getCellText($, "#TdDetailCountyAssessedValue");
  let assessedRaw = getRawSelectorText($, "#TdDetailCountyAssessedValue");
  let assessed = toNumberCurrency(assessedText);
  let assessedSourceText = assessedRaw || assessedText;
  const schoolAssessedText = getCellText(
    $,
    "#HistorySchoolAssessedValue1",
  );
  const schoolAssessedRaw = getRawSelectorText(
    $,
    "#HistorySchoolAssessedValue1",
  );
  let schoolAssessedSourceText =
    schoolAssessedRaw || schoolAssessedText || null;
  if (assessed == null && schoolAssessedText) {
    assessed = toNumberCurrency(schoolAssessedText);
    assessedText = schoolAssessedText;
    assessedRaw = schoolAssessedRaw;
    assessedSourceText = schoolAssessedSourceText;
  }
  let taxableText = getCellText($, "#CountyTaxableValue");
  let taxableRaw = getRawSelectorText($, "#CountyTaxableValue");
  let taxable = toNumberCurrency(taxableText);
  let taxableSourceText = taxableRaw || taxableText;
  if (taxable == null) {
    const taxableFallbackText = getCellText(
      $,
      "#TdDetailCountyTaxableValue",
    );
    const taxableFallbackRaw = getRawSelectorText(
      $,
      "#TdDetailCountyTaxableValue",
    );
    if (taxableFallbackText) {
      taxable = toNumberCurrency(taxableFallbackText);
      taxableText = taxableFallbackText;
      taxableRaw = taxableFallbackRaw;
      taxableSourceText = taxableFallbackRaw || taxableFallbackText;
    }
  }
  const totalTaxesPrimaryText = getCellText($, "#TotalTaxes");
  const totalTaxesPrimaryRaw = getRawSelectorText($, "#TotalTaxes");
  let yearly = toNumberCurrency(totalTaxesPrimaryText);
  let yearlySourceText =
    totalTaxesPrimaryRaw ||
    (totalTaxesPrimaryText != null ? totalTaxesPrimaryText : null);
  const tableTotalTaxesText = getCellText(
    $,
    "#TblAdValoremAdditionalTotal #TotalAdvTaxes",
  );
  const tableTotalTaxesRaw = getRawSelectorText(
    $,
    "#TblAdValoremAdditionalTotal #TotalAdvTaxes",
  );
  if (yearly == null && tableTotalTaxesText) {
    const parsedTableYearly = toNumberCurrency(tableTotalTaxesText);
    if (parsedTableYearly != null) {
      yearly = parsedTableYearly;
      yearlySourceText =
        tableTotalTaxesRaw ||
        (tableTotalTaxesText != null ? tableTotalTaxesText : null);
    }
  }
  const totalTaxesAltSelector =
    "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)";
  const totalTaxesAltText = getCellText($, totalTaxesAltSelector);
  const totalTaxesAltRaw = getRawSelectorText($, totalTaxesAltSelector);
  const totalTaxesAltSourceText =
    totalTaxesAltRaw || totalTaxesAltText || null;
  if (yearly == null && totalTaxesAltText) {
    const altYearly = toNumberCurrency(totalTaxesAltText);
    if (altYearly != null) {
      yearly = altYearly;
      yearlySourceText =
        totalTaxesAltRaw ||
        (totalTaxesAltText != null ? totalTaxesAltText : null);
    }
  }
  const totalAdValoremText = getCellText($, "#TotalAdvTaxes");
  const totalAdValoremRaw = getRawSelectorText($, "#TotalAdvTaxes");
  const totalAdValoremTaxes = toNumberCurrency(totalAdValoremText);
  const totalNonAdValoremText = getCellText($, "#TotalNAdvTaxes");
  const totalNonAdValoremRaw = getRawSelectorText($, "#TotalNAdvTaxes");
  const totalNonAdValoremTaxes = toNumberCurrency(totalNonAdValoremText);
  const schoolTaxableValueText = getCellText($, "#SchoolTaxableValue");
  const schoolTaxableValueRaw = getRawSelectorText($, "#SchoolTaxableValue");
  const schoolTaxableValue = toNumberCurrency(schoolTaxableValueText);
  const nonSchoolAddlHomesteadText = getCellText(
    $,
    "#NonSchoolAddHmstdExemptAmount",
  );
  const nonSchoolAddlHomesteadRaw = getRawSelectorText(
    $,
    "#NonSchoolAddHmstdExemptAmount",
  );
  const nonSchoolAddlHomestead = toNumberCurrency(
    nonSchoolAddlHomesteadText,
  );
  const countyMillageText = getCellText($, "#TdDetailCountyMillage");
  const countyMillageRaw = getRawSelectorText($, "#TdDetailCountyMillage");
  const countyMillage = toNumberCurrency(countyMillageText);
  const schoolMillageText = getCellText($, "#TdDetailSchoolMillage");
  const schoolMillageRaw = getRawSelectorText($, "#TdDetailSchoolMillage");
  const schoolMillage = toNumberCurrency(schoolMillageText);
  const otherMillageText = getCellText($, "#TdDetailOtherMillage");
  const otherMillageRaw = getRawSelectorText($, "#TdDetailOtherMillage");
  const otherMillage = toNumberCurrency(otherMillageText);
  const totalMillageText = getCellText($, "#TdDetailTotalMillage");
  const totalMillageRaw = getRawSelectorText($, "#TdDetailTotalMillage");
  const totalMillage = toNumberCurrency(totalMillageText);
  const sohBenefitAmountText = getCellText($, "#SohBenefit");
  const sohBenefitAmountRaw = getRawSelectorText($, "#SohBenefit");
  const sohBenefitAmount = toNumberCurrency(sohBenefitAmountText);
  let sohLabel = null;
  const sohRow = $("#SohBenefit").closest("tr");
  if (sohRow && sohRow.length) {
    const labelText = sohRow.find("td").first().text();
    if (labelText) sohLabel = labelText.replace(/\s+/g, " ").trim();
  }
  const sohDetailSelector =
    "td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)";
  const sohDetailLabel = getCellText($, sohDetailSelector);
  if (!sohLabel && sohDetailLabel) {
    sohLabel = sohDetailLabel;
  }
  const sohSummarySelector =
    "div:nth-child(1) > table.clsWide:nth-child(1) > tbody > tr:nth-child(6) > td.clsField:nth-child(1)";
  const sohSummaryLabel = getCellText($, sohSummarySelector);
  if (!sohLabel && sohSummaryLabel) {
    sohLabel = sohSummaryLabel;
  }

  const summarySourceFields = {};
  if (landRaw || landText) {
    const value = landRaw || landText;
    summarySourceFields.land_just_value_text = value;
    addSelectorSource(summarySourceFields, "#LandJustValue", value);
  }
  if (imprRaw || imprText) {
    const value = imprRaw || imprText;
    summarySourceFields.improvements_just_value_text = value;
    addSelectorSource(summarySourceFields, "#ImprovementsJustValue", value);
  }
  if (justRaw || justText) {
    const value = justRaw || justText;
    summarySourceFields.total_just_value_text = value;
    addSelectorSource(summarySourceFields, "#TotalJustValue", value);
  }
  if (assessedSourceText) {
    summarySourceFields.county_assessed_value_text = assessedSourceText;
    addSelectorSource(
      summarySourceFields,
      ["#TdDetailCountyAssessedValue", "#CountyAssessedValue"],
      assessedSourceText,
    );
  }
  if (schoolAssessedSourceText) {
    summarySourceFields.school_assessed_value_text = schoolAssessedSourceText;
  }
  if (taxableSourceText) {
    summarySourceFields.county_taxable_value_text = taxableSourceText;
    addSelectorSource(
      summarySourceFields,
      ["#CountyTaxableValue", "#TdDetailCountyTaxableValue"],
      taxableSourceText,
    );
  }
  if (schoolTaxableValueRaw || schoolTaxableValueText) {
    const value = schoolTaxableValueRaw || schoolTaxableValueText;
    summarySourceFields.school_taxable_value_text = value;
    addSelectorSource(summarySourceFields, "#SchoolTaxableValue", value);
  }
  if (nonSchoolAddlHomesteadRaw || nonSchoolAddlHomesteadText) {
    const value = nonSchoolAddlHomesteadRaw || nonSchoolAddlHomesteadText;
    summarySourceFields.non_school_additional_homestead_exemption_amount_text =
      value;
    addSelectorSource(
      summarySourceFields,
      "#NonSchoolAddHmstdExemptAmount",
      value,
    );
  }
  if (totalAdValoremRaw || totalAdValoremText) {
    const value = totalAdValoremRaw || totalAdValoremText;
    summarySourceFields.total_ad_valorem_tax_amount_text = value;
    addSelectorSource(summarySourceFields, "#TotalAdvTaxes", value);
  }
  if (totalNonAdValoremRaw || totalNonAdValoremText) {
    const value = totalNonAdValoremRaw || totalNonAdValoremText;
    summarySourceFields.non_ad_valorem_tax_total_amount_text = value;
    addSelectorSource(summarySourceFields, "#TotalNAdvTaxes", value);
  }
  if (yearlySourceText || totalTaxesAltSourceText) {
    const value = yearlySourceText || totalTaxesAltSourceText;
    summarySourceFields.total_tax_amount_text = value;
    addSelectorSource(summarySourceFields, "#TotalTaxes", value);
    addSelectorSource(summarySourceFields, totalTaxesAltSelector, value);
  }
  if (countyMillageRaw || countyMillageText) {
    const value = countyMillageRaw || countyMillageText;
    summarySourceFields.county_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailCountyMillage", value);
  }
  if (schoolMillageRaw || schoolMillageText) {
    const value = schoolMillageRaw || schoolMillageText;
    summarySourceFields.school_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailSchoolMillage", value);
  }
  if (otherMillageRaw || otherMillageText) {
    const value = otherMillageRaw || otherMillageText;
    summarySourceFields.other_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailOtherMillage", value);
  }
  if (totalMillageRaw || totalMillageText) {
    const value = totalMillageRaw || totalMillageText;
    summarySourceFields.total_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailTotalMillage", value);
  }
  if (sohBenefitAmountRaw || sohBenefitAmountText) {
    const value = sohBenefitAmountRaw || sohBenefitAmountText;
    summarySourceFields.save_our_homes_reduction_amount_text = value;
    addSelectorSource(summarySourceFields, "#SohBenefit", value);
  }
  if (sohLabel || sohDetailLabel || sohSummaryLabel) {
    const labelValue = sohLabel || sohDetailLabel || sohSummaryLabel;
    summarySourceFields.save_our_homes_reduction_label_text = labelValue;
    addSelectorSource(summarySourceFields, sohDetailSelector, labelValue);
    addSelectorSource(summarySourceFields, sohSummarySelector, labelValue);
  }

  let summaryTaxRecord = null;
  const summaryValues = [
    land,
    impr,
    just,
    assessed,
    taxable,
    yearly,
    totalAdValoremTaxes,
    totalNonAdValoremTaxes,
    schoolTaxableValue,
    nonSchoolAddlHomestead,
    countyMillage,
    schoolMillage,
    otherMillage,
    totalMillage,
    sohBenefitAmount,
  ];
  if (summaryValues.some((val) => val != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    summaryTaxRecord = {
      parcel_identifier: parcelId,
      tax_year: ty != null ? ty : null,
      property_assessed_value_amount:
        assessed != null ? assessed : just != null ? just : null,
      property_market_value_amount:
        just != null ? just : assessed != null ? assessed : null,
      property_building_amount: impr != null ? impr : null,
      property_land_amount: land != null ? land : null,
      property_taxable_value_amount:
        taxable != null ? taxable : assessed != null ? assessed : null,
      school_taxable_value_amount:
        schoolTaxableValue != null ? schoolTaxableValue : null,
      non_school_additional_homestead_exemption_amount:
        nonSchoolAddlHomestead != null ? nonSchoolAddlHomestead : null,
      ad_valorem_tax_total_amount:
        totalAdValoremTaxes != null ? totalAdValoremTaxes : null,
      non_ad_valorem_tax_total_amount:
        totalNonAdValoremTaxes != null ? totalNonAdValoremTaxes : null,
      total_tax_amount: yearly != null ? yearly : null,
      county_millage_rate: countyMillage != null ? countyMillage : null,
      school_millage_rate: schoolMillage != null ? schoolMillage : null,
      other_millage_rate: otherMillage != null ? otherMillage : null,
      total_millage_rate: totalMillage != null ? totalMillage : null,
      save_our_homes_reduction_description: sohLabel || null,
      save_our_homes_reduction_amount:
        sohBenefitAmount != null ? sohBenefitAmount : null,
      monthly_tax_amount: monthly,
      period_end_date: ty ? `${ty}-12-31` : null,
      period_start_date: ty ? `${ty}-01-01` : null,
      yearly_tax_amount: yearly != null ? yearly : null,
    };
    const summarySourceEntries = Object.entries(summarySourceFields).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    );
    if (summarySourceEntries.length > 0) {
      summaryTaxRecord.source_fields = summarySourceEntries.reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {},
      );
    }
  }

  const taxRecordMap = new Map();

  // Ad valorem taxing authorities (current year)
  $("#TblAdValoremAdditional tr[id^=TrAdValorem]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrAdValorem(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const name = getCellText($, `#TaName${idx}`);
    const category = getCellText($, `#TaxableType${idx}`);
    const taxableValueText = getCellText($, `#Taxable${idx}`);
    const taxableValue = toNumberCurrency(taxableValueText);
    const millageRateText = getCellText($, `#Millage${idx}`);
    const millageRate = toNumberCurrency(millageRateText);
    const taxAmountText = getCellText($, `#Tax${idx}`);
    const taxAmount = toNumberCurrency(taxAmountText);
    if (!name && taxAmount == null && taxableValue == null) return;
    const authObj = {
      parcel_identifier: parcelId,
      tax_authority_name: name,
      tax_category: category,
      taxable_value_amount: taxableValue != null ? taxableValue : null,
      millage_rate: millageRate != null ? millageRate : null,
      tax_amount: taxAmount != null ? taxAmount : null,
      tax_year: ty,
    };
    const authSourceFields = {};
    const nameRaw = getRawSelectorText($, `#TaName${idx}`);
    const categoryRaw = getRawSelectorText($, `#TaxableType${idx}`);
    const taxableValueRaw = getRawSelectorText($, `#Taxable${idx}`);
    const millageRateRaw = getRawSelectorText($, `#Millage${idx}`);
    const taxAmountRaw = getRawSelectorText($, `#Tax${idx}`);
    if (nameRaw || name) {
      authSourceFields.tax_authority_name_text = nameRaw || name;
    }
    addSelectorSource(authSourceFields, `#TaName${idx}`, nameRaw || name);
    if (categoryRaw || category) {
      authSourceFields.tax_category_text = categoryRaw || category;
    }
    addSelectorSource(
      authSourceFields,
      `#TaxableType${idx}`,
      categoryRaw || category,
    );
    if (taxableValueRaw || taxableValueText) {
      authSourceFields.taxable_value_amount_text =
        taxableValueRaw || taxableValueText;
    }
    addSelectorSource(
      authSourceFields,
      `#Taxable${idx}`,
      taxableValueRaw || taxableValueText,
    );
    if (millageRateRaw || millageRateText) {
      authSourceFields.millage_rate_text = millageRateRaw || millageRateText;
    }
    addSelectorSource(
      authSourceFields,
      `#Millage${idx}`,
      millageRateRaw || millageRateText,
    );
    if (taxAmountRaw || taxAmountText) {
      authSourceFields.tax_amount_text = taxAmountRaw || taxAmountText;
    }
    addSelectorSource(
      authSourceFields,
      `#Tax${idx}`,
      taxAmountRaw || taxAmountText,
    );
    if (Object.keys(authSourceFields).length > 0) {
      authObj.source_fields = authSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `taxing_authority_${idx}.json`),
      JSON.stringify(authObj, null, 2),
    );
  });

  // Non-ad valorem assessments
  $("#TblNonAdValoremAdditional tr[id^=TrNonAdValorem]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrNonAdValorem(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const name = getCellText($, `#LANAME${idx}`);
    const chargeAmountText = getCellText($, `#TAX${idx}`);
    const chargeAmount = toNumberCurrency(chargeAmountText);
    if (!name && chargeAmount == null) return;
    const assessment = {
      parcel_identifier: parcelId,
      assessment_name: name,
      assessment_amount: chargeAmount != null ? chargeAmount : null,
      tax_year: ty,
    };
    const assessmentSourceFields = {};
    const nameRaw = getRawSelectorText($, `#LANAME${idx}`);
    const chargeAmountRaw = getRawSelectorText($, `#TAX${idx}`);
    if (nameRaw || name) {
      assessmentSourceFields.assessment_name_text = nameRaw || name;
    }
    addSelectorSource(
      assessmentSourceFields,
      `#LANAME${idx}`,
      nameRaw || name,
    );
    if (chargeAmountRaw || chargeAmountText) {
      assessmentSourceFields.assessment_amount_text =
        chargeAmountRaw || chargeAmountText;
    }
    addSelectorSource(
      assessmentSourceFields,
      `#TAX${idx}`,
      chargeAmountRaw || chargeAmountText,
    );
    if (Object.keys(assessmentSourceFields).length > 0) {
      assessment.source_fields = assessmentSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `non_ad_valorem_assessment_${idx}.json`),
      JSON.stringify(assessment, null, 2),
    );
  });

  // From History (Tab6) for multiple years
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = $(`#HistoryTaxYear${idx}`).text().trim();
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);
    if (!yNum) continue;

    const landHText = getCellText($, `#HistoryLandJustValue${idx}`);
    const landHRaw = getRawSelectorText($, `#HistoryLandJustValue${idx}`);
    const landH = toNumberCurrency(landHText);
    const imprHText = getCellText($, `#HistoryImprovementsJustValue${idx}`);
    const imprHRaw = getRawSelectorText(
      $,
      `#HistoryImprovementsJustValue${idx}`,
    );
    const imprH = toNumberCurrency(imprHText);
    const justHText = getCellText($, `#HistoryTotalJustValue${idx}`);
    const justHRaw = getRawSelectorText($, `#HistoryTotalJustValue${idx}`);
    const justH = toNumberCurrency(justHText);
    const schoolAssessedText = getCellText(
      $,
      `#HistorySchoolAssessedValue${idx}`,
    );
    const schoolAssessedRaw = getRawSelectorText(
      $,
      `#HistorySchoolAssessedValue${idx}`,
    );
    const schoolAssessed = toNumberCurrency(schoolAssessedText);
    const countyAssessedText = getCellText(
      $,
      `#HistoryCountyAssessedValue${idx}`,
    );
    const countyAssessedRaw = getRawSelectorText(
      $,
      `#HistoryCountyAssessedValue${idx}`,
    );
    const countyAssessed = toNumberCurrency(countyAssessedText);
    const taxableHText = getCellText($, `#HistoryCountyTaxableValue${idx}`);
    const taxableHRaw = getRawSelectorText(
      $,
      `#HistoryCountyTaxableValue${idx}`,
    );
    const taxableH = toNumberCurrency(taxableHText);
    const schoolTaxableHText = getCellText(
      $,
      `#HistorySchoolTaxableValue${idx}`,
    );
    const schoolTaxableHRaw = getRawSelectorText(
      $,
      `#HistorySchoolTaxableValue${idx}`,
    );
    const schoolTaxableH = toNumberCurrency(schoolTaxableHText);
    const yearlyHText = getCellText($, `#HistoryTotalTaxes${idx}`);
    const yearlyHRaw = getRawSelectorText($, `#HistoryTotalTaxes${idx}`);
    const yearlyH = toNumberCurrency(yearlyHText);
    const nonSchoolBenefitText = getCellText(
      $,
      `#HistoryNonSchool10PctBenefit${idx}`,
    );
    const nonSchoolBenefitRaw = getRawSelectorText(
      $,
      `#HistoryNonSchool10PctBenefit${idx}`,
    );
    const nonSchoolBenefit = toNumberCurrency(nonSchoolBenefitText);
    const totalAdvTaxesHText = getCellText(
      $,
      `#HistoryTotalAdvTaxes${idx}`,
    );
    const totalAdvTaxesHRaw = getRawSelectorText(
      $,
      `#HistoryTotalAdvTaxes${idx}`,
    );
    const totalAdvTaxesH = toNumberCurrency(totalAdvTaxesHText);
    const otherMillageHText = getCellText(
      $,
      `#HistoryOtherMillage${idx}`,
    );
    const otherMillageHRaw = getRawSelectorText(
      $,
      `#HistoryOtherMillage${idx}`,
    );
    const otherMillageH = toNumberCurrency(otherMillageHText);

    const hasAnyRawValue = [
      landHText,
      imprHText,
      justHText,
      schoolAssessedText,
      countyAssessedText,
      taxableHText,
      schoolTaxableHText,
      yearlyHText,
      nonSchoolBenefitText,
      totalAdvTaxesHText,
      otherMillageHText,
    ].some((text) => text && text.trim().length > 0);
    const hasAnyNumericValue =
      landH != null ||
      imprH != null ||
      justH != null ||
      schoolAssessed != null ||
      countyAssessed != null ||
      taxableH != null ||
      schoolTaxableH != null ||
      yearlyH != null ||
      nonSchoolBenefit != null ||
      totalAdvTaxesH != null ||
      otherMillageH != null;

    if (yNum && (hasAnyNumericValue || hasAnyRawValue)) {
      years.push({
        idx,
        yNum,
        landH,
        landHRaw: landHRaw || null,
        landHText,
        imprH,
        imprHRaw: imprHRaw || null,
        imprHText,
        justH,
        justHRaw: justHRaw || null,
        justHText,
        schoolAssessed,
        schoolAssessedRaw: schoolAssessedRaw || null,
        schoolAssessedText,
        countyAssessed,
        countyAssessedRaw: countyAssessedRaw || null,
        countyAssessedText,
        taxableH,
        taxableHRaw: taxableHRaw || null,
        taxableHText,
        schoolTaxableH,
        schoolTaxableHRaw: schoolTaxableHRaw || null,
        schoolTaxableHText,
        yearlyH,
        yearlyHRaw: yearlyHRaw || null,
        yearlyHText,
        nonSchoolBenefit,
        nonSchoolBenefitRaw: nonSchoolBenefitRaw || null,
        nonSchoolBenefitText,
        totalAdvTaxesH,
        totalAdvTaxesHRaw: totalAdvTaxesHRaw || null,
        totalAdvTaxesHText,
        otherMillageH,
        otherMillageHRaw: otherMillageHRaw || null,
        otherMillageHText,
      });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const taxObj = {
      parcel_identifier: parcelId,
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.countyAssessed != null
          ? rec.countyAssessed
          : rec.schoolAssessed != null
            ? rec.schoolAssessed
            : rec.justH != null
              ? rec.justH
              : null,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.countyAssessed != null
            ? rec.countyAssessed
            : rec.schoolAssessed != null
              ? rec.schoolAssessed
              : null,
      property_building_amount: rec.imprH != null ? rec.imprH : null,
      property_land_amount: rec.landH != null ? rec.landH : null,
      property_taxable_value_amount:
        rec.taxableH != null
          ? rec.taxableH
          : rec.countyAssessed != null
            ? rec.countyAssessed
            : rec.schoolAssessed != null
              ? rec.schoolAssessed
              : null,
      school_taxable_value_amount:
        rec.schoolTaxableH != null ? rec.schoolTaxableH : null,
      non_school_additional_homestead_exemption_amount:
        rec.nonSchoolBenefit != null ? rec.nonSchoolBenefit : null,
      ad_valorem_tax_total_amount:
        rec.totalAdvTaxesH != null ? rec.totalAdvTaxesH : null,
      other_millage_rate:
        rec.otherMillageH != null ? rec.otherMillageH : null,
      monthly_tax_amount: monthly,
      period_end_date: `${rec.yNum}-12-31`,
      period_start_date: `${rec.yNum}-01-01`,
      yearly_tax_amount: rec.yearlyH != null ? rec.yearlyH : null,
    };
    const historySourceFields = {};
    const landHSource = rec.landHRaw || rec.landHText;
    if (landHSource) {
      historySourceFields.land_just_value_text = landHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryLandJustValue${rec.idx}`,
        landHSource,
      );
    }
    const imprHSource = rec.imprHRaw || rec.imprHText;
    if (imprHSource) {
      historySourceFields.improvements_just_value_text = imprHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryImprovementsJustValue${rec.idx}`,
        imprHSource,
      );
    }
    const justHSource = rec.justHRaw || rec.justHText;
    if (justHSource) {
      historySourceFields.total_just_value_text = justHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalJustValue${rec.idx}`,
        justHSource,
      );
    }
    const schoolAssessedSource = rec.schoolAssessedRaw || rec.schoolAssessedText;
    if (schoolAssessedSource) {
      historySourceFields.school_assessed_value_text = schoolAssessedSource;
    }
    const countyAssessedSource = rec.countyAssessedRaw || rec.countyAssessedText;
    if (countyAssessedSource) {
      historySourceFields.county_assessed_value_text = countyAssessedSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryCountyAssessedValue${rec.idx}`,
        countyAssessedSource,
      );
    }
    const taxableHSource = rec.taxableHRaw || rec.taxableHText;
    if (taxableHSource) {
      historySourceFields.county_taxable_value_text = taxableHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryCountyTaxableValue${rec.idx}`,
        taxableHSource,
      );
    }
    const schoolTaxableHSource =
      rec.schoolTaxableHRaw || rec.schoolTaxableHText;
    if (schoolTaxableHSource) {
      historySourceFields.school_taxable_value_text = schoolTaxableHSource;
      addSelectorSource(
        historySourceFields,
        `#HistorySchoolTaxableValue${rec.idx}`,
        schoolTaxableHSource,
      );
    }
    const yearlyHSource = rec.yearlyHRaw || rec.yearlyHText;
    if (yearlyHSource) {
      historySourceFields.total_tax_amount_text = yearlyHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalTaxes${rec.idx}`,
        yearlyHSource,
      );
    }
    const nonSchoolBenefitSource =
      rec.nonSchoolBenefitRaw || rec.nonSchoolBenefitText;
    if (nonSchoolBenefitSource) {
      historySourceFields.non_school_additional_homestead_exemption_amount_text =
        nonSchoolBenefitSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryNonSchool10PctBenefit${rec.idx}`,
        nonSchoolBenefitSource,
      );
    }
    const totalAdvTaxesHSource =
      rec.totalAdvTaxesHRaw || rec.totalAdvTaxesHText;
    if (totalAdvTaxesHSource) {
      historySourceFields.total_ad_valorem_tax_amount_text =
        totalAdvTaxesHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalAdvTaxes${rec.idx}`,
        totalAdvTaxesHSource,
      );
    }
    const otherMillageHSource =
      rec.otherMillageHRaw || rec.otherMillageHText;
    if (otherMillageHSource) {
      historySourceFields.other_millage_rate_text = otherMillageHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryOtherMillage${rec.idx}`,
        otherMillageHSource,
      );
    }
    if (Object.keys(historySourceFields).length > 0) {
      taxObj.source_fields = historySourceFields;
    }
    const existing = taxRecordMap.get(rec.yNum);
    if (existing) {
      taxRecordMap.set(rec.yNum, mergeTaxRecords(existing, taxObj));
    } else {
      taxRecordMap.set(rec.yNum, taxObj);
    }
  });

  if (summaryTaxRecord) {
    if (summaryTaxRecord.tax_year == null) {
      const knownYears = Array.from(taxRecordMap.keys()).filter((year) =>
        Number.isFinite(year),
      );
      const fallbackYear =
        knownYears.length > 0
          ? Math.max(...knownYears)
          : ty != null
            ? ty
            : null;
      if (fallbackYear != null) {
        summaryTaxRecord.tax_year = fallbackYear;
        if (!summaryTaxRecord.period_start_date) {
          summaryTaxRecord.period_start_date = `${fallbackYear}-01-01`;
        }
        if (!summaryTaxRecord.period_end_date) {
          summaryTaxRecord.period_end_date = `${fallbackYear}-12-31`;
        }
      }
    }
    if (summaryTaxRecord.tax_year != null) {
      const existing = taxRecordMap.get(summaryTaxRecord.tax_year);
      if (existing) {
        taxRecordMap.set(
          summaryTaxRecord.tax_year,
          mergeTaxRecords(summaryTaxRecord, existing),
        );
      } else {
        taxRecordMap.set(summaryTaxRecord.tax_year, summaryTaxRecord);
      }
    }
  }

  fs.readdirSync(dataDir)
    .filter((name) => /^tax_\d+\.json$/.test(name))
    .forEach((name) => {
      try {
        fs.unlinkSync(path.join(dataDir, name));
      } catch (_) {}
    });
  const sortedTaxRecords = Array.from(taxRecordMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, record]) => record);

  sortedTaxRecords.forEach((record, idx) => {
    fs.writeFileSync(
      path.join(dataDir, `tax_${idx + 1}.json`),
      JSON.stringify(record, null, 2),
    );
  });
}

try {
  main();
  console.log("Extraction completed");
} catch (e) {
  try {
    const obj = JSON.parse(e.message);
    if (obj && obj.type === "error") {
      console.error(JSON.stringify(obj));
      process.exit(1);
    }
  } catch (_) {}
  console.error(e.stack || e.message || String(e));
  process.exit(1);
}
