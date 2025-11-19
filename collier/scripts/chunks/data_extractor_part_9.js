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
    const issueDate = parseDateToISO(getCellText($, `#IssuedDate${idx}`) || "");
    const coDate = parseDateToISO(getCellText($, `#codate${idx}`) || "");
    const taxYearPermit = toNumberCurrency(getCellText($, `#taxyear${idx}`));

    if (
      !permitNumber &&
      !permitType &&
      !issuer &&
      issueDate == null &&
      coDate == null
    ) {
      return;
    }

    const permitObj = {
      permit_identifier: permitNumber,
      permit_type_description: permitType,
      issuing_authority: issuer,
      permit_issue_date: issueDate,
      certificate_of_occupancy_date: coDate,
      tax_year: taxYearPermit != null ? Math.trunc(taxYearPermit) : null,
      request_identifier: folio,
    };
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
  const landRaw = getRawSelectorText($, "#LandJustValue");
  const land = toNumberCurrency(getCellText($, "#LandJustValue"));
  const imprRaw = getRawSelectorText($, "#ImprovementsJustValue");
  const impr = toNumberCurrency(getCellText($, "#ImprovementsJustValue"));
  const justRaw = getRawSelectorText($, "#TotalJustValue");
  const just = toNumberCurrency(getCellText($, "#TotalJustValue"));
  let assessedRaw = getRawSelectorText($, "#TdDetailCountyAssessedValue");
  let assessed = toNumberCurrency(
    getCellText($, "#TdDetailCountyAssessedValue"),
  );
  if (assessed == null) {
    assessedRaw = getRawSelectorText($, "#HistorySchoolAssessedValue1");
    assessed = toNumberCurrency(
      getCellText($, "#HistorySchoolAssessedValue1"),
    );
  }
  let taxableRaw = getRawSelectorText($, "#CountyTaxableValue");
  let taxable = toNumberCurrency(getCellText($, "#CountyTaxableValue"));
  if (taxable == null) {
    taxableRaw = getRawSelectorText($, "#TdDetailCountyTaxableValue");
    taxable = toNumberCurrency(getCellText($, "#TdDetailCountyTaxableValue"));
  }
  let yearlyRaw = getRawSelectorText($, "#TotalTaxes");
  let yearly = toNumberCurrency(getCellText($, "#TotalTaxes"));
  if (yearly == null) {
    yearlyRaw = getRawSelectorText(
      $,
      "#TblAdValoremAdditionalTotal #TotalAdvTaxes",
    );
    yearly = toNumberCurrency(
      getCellText($, "#TblAdValoremAdditionalTotal #TotalAdvTaxes"),
    );
  }
  if (yearly == null) {
    yearlyRaw = getRawSelectorText(
      $,
      "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
    );
    const altYearly = toNumberCurrency(
      getCellText(
        $,
        "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
      ),
    );
    if (altYearly != null) yearly = altYearly;
  }
  const totalAdValoremRaw = getRawSelectorText($, "#TotalAdvTaxes");
  const totalAdValoremTaxes = toNumberCurrency(getCellText($, "#TotalAdvTaxes"));
  const totalNonAdValoremRaw = getRawSelectorText($, "#TotalNAdvTaxes");
  const totalNonAdValoremTaxes = toNumberCurrency(
    getCellText($, "#TotalNAdvTaxes"),
  );
  const schoolTaxableValueRaw = getRawSelectorText($, "#SchoolTaxableValue");
  const schoolTaxableValue = toNumberCurrency(
    getCellText($, "#SchoolTaxableValue"),
  );
  const nonSchoolAddlHomesteadRaw = getRawSelectorText(
    $,
    "#NonSchoolAddHmstdExemptAmount",
  );
  const nonSchoolAddlHomestead = toNumberCurrency(
    getCellText($, "#NonSchoolAddHmstdExemptAmount"),
  );
  const countyMillageRaw = getRawSelectorText($, "#TdDetailCountyMillage");
  const countyMillage = toNumberCurrency(getCellText($, "#TdDetailCountyMillage"));
  const schoolMillageRaw = getRawSelectorText($, "#TdDetailSchoolMillage");
  const schoolMillage = toNumberCurrency(
    getCellText($, "#TdDetailSchoolMillage"),
  );
  const otherMillageRaw = getRawSelectorText($, "#TdDetailOtherMillage");
  const otherMillage = toNumberCurrency(
    getCellText($, "#TdDetailOtherMillage"),
  );
  const totalMillageRaw = getRawSelectorText($, "#TdDetailTotalMillage");
  const totalMillage = toNumberCurrency(
    getCellText($, "#TdDetailTotalMillage"),
  );
  const sohBenefitAmountRaw = getRawSelectorText($, "#SohBenefit");
  const sohBenefitAmount = toNumberCurrency(getCellText($, "#SohBenefit"));
  let sohLabel = null;
  const sohRow = $("#SohBenefit").closest("tr");
  if (sohRow && sohRow.length) {
    const labelText = sohRow.find("td").first().text();
    if (labelText) sohLabel = labelText.replace(/\s+/g, " ").trim();
  }
  const sohDetailLabel = getCellText(
    $,
    "td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)",
  );
  if (!sohLabel && sohDetailLabel) {
    sohLabel = sohDetailLabel;
  }

  const summarySourceFields = {};
  if (landRaw) summarySourceFields.land_just_value_text = landRaw;
  if (imprRaw) summarySourceFields.improvements_just_value_text = imprRaw;
  if (justRaw) summarySourceFields.total_just_value_text = justRaw;
  if (assessedRaw) summarySourceFields.county_assessed_value_text = assessedRaw;
  const schoolAssessedRaw = getRawSelectorText(
    $,
    "#HistorySchoolAssessedValue1",
  );
  if (schoolAssessedRaw) {
    summarySourceFields.school_assessed_value_text = schoolAssessedRaw;
  }
  if (taxableRaw) {
    summarySourceFields.county_taxable_value_text = taxableRaw;
  }
  if (schoolTaxableValueRaw) {
    summarySourceFields.school_taxable_value_text = schoolTaxableValueRaw;
  }
  if (nonSchoolAddlHomesteadRaw) {
    summarySourceFields.non_school_additional_homestead_exemption_amount_text =
      nonSchoolAddlHomesteadRaw;
  }
  if (totalAdValoremRaw) {
    summarySourceFields.total_ad_valorem_tax_amount_text = totalAdValoremRaw;
  }
  if (totalNonAdValoremRaw) {
    summarySourceFields.non_ad_valorem_tax_total_amount_text =
      totalNonAdValoremRaw;
  }
  if (yearlyRaw) {
    summarySourceFields.total_tax_amount_text = yearlyRaw;
  }
  if (countyMillageRaw) {
    summarySourceFields.county_millage_rate_text = countyMillageRaw;
  }
  if (schoolMillageRaw) {
    summarySourceFields.school_millage_rate_text = schoolMillageRaw;
  }
  if (otherMillageRaw) {
    summarySourceFields.other_millage_rate_text = otherMillageRaw;
  }
  if (totalMillageRaw) {
    summarySourceFields.total_millage_rate_text = totalMillageRaw;
  }
  if (sohBenefitAmountRaw) {
    summarySourceFields.save_our_homes_reduction_amount_text =
      sohBenefitAmountRaw;
  }
  if (sohLabel) {
    summarySourceFields.save_our_homes_reduction_label_text = sohLabel;
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
  if (ty != null && summaryValues.some((val) => val != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    summaryTaxRecord = {
      tax_year: ty,
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
      request_identifier: folio,
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
  if (summaryTaxRecord && summaryTaxRecord.tax_year != null) {
    taxRecordMap.set(summaryTaxRecord.tax_year, summaryTaxRecord);
  }

  // Ad valorem taxing authorities (current year)
  $("#TblAdValoremAdditional tr[id^=TrAdValorem]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrAdValorem(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const name = getCellText($, `#TaName${idx}`);
    const category = getCellText($, `#TaxableType${idx}`);
    const taxableValue = toNumberCurrency(getCellText($, `#Taxable${idx}`));
    const millageRate = toNumberCurrency(getCellText($, `#Millage${idx}`));
    const taxAmount = toNumberCurrency(getCellText($, `#Tax${idx}`));
    if (!name && taxAmount == null && taxableValue == null) return;
    const authObj = {
      tax_authority_name: name,
      tax_category: category,
      taxable_value_amount: taxableValue != null ? taxableValue : null,
      millage_rate: millageRate != null ? millageRate : null,
      tax_amount: taxAmount != null ? taxAmount : null,
      tax_year: ty,
      request_identifier: folio,
    };
    const authSourceFields = {};
    const taxableValueRaw = getRawSelectorText($, `#Taxable${idx}`);
    const millageRateRaw = getRawSelectorText($, `#Millage${idx}`);
    const taxAmountRaw = getRawSelectorText($, `#Tax${idx}`);
    if (taxableValueRaw) {
      authSourceFields.taxable_value_amount_text = taxableValueRaw;
    }
    if (millageRateRaw) {
      authSourceFields.millage_rate_text = millageRateRaw;
    }
    if (taxAmountRaw) {
      authSourceFields.tax_amount_text = taxAmountRaw;
    }
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
    const chargeAmount = toNumberCurrency(getCellText($, `#TAX${idx}`));
    if (!name && chargeAmount == null) return;
    const assessment = {
      assessment_name: name,
      assessment_amount: chargeAmount != null ? chargeAmount : null,
      tax_year: ty,
      request_identifier: folio,
    };
    const assessmentSourceFields = {};
    const nameRaw = getRawSelectorText($, `#LANAME${idx}`);
    const chargeAmountRaw = getRawSelectorText($, `#TAX${idx}`);
    if (nameRaw) {
      assessmentSourceFields.assessment_name_text = nameRaw;
    }
    if (chargeAmountRaw) {
      assessmentSourceFields.assessment_amount_text = chargeAmountRaw;
    }
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

    const landHRaw = getRawSelectorText($, `#HistoryLandJustValue${idx}`);
    const landH = toNumberCurrency(getCellText($, `#HistoryLandJustValue${idx}`));
    const imprHRaw = getRawSelectorText(
      $,
      `#HistoryImprovementsJustValue${idx}`,
    );
    const imprH = toNumberCurrency(
      getCellText($, `#HistoryImprovementsJustValue${idx}`),
    );
    const justHRaw = getRawSelectorText($, `#HistoryTotalJustValue${idx}`);
    const justH = toNumberCurrency(getCellText($, `#HistoryTotalJustValue${idx}`));
    const schoolAssessedRaw = getRawSelectorText(
      $,
      `#HistorySchoolAssessedValue${idx}`,
    );
    const schoolAssessed = toNumberCurrency(
      getCellText($, `#HistorySchoolAssessedValue${idx}`),
    );
    const countyAssessedRaw = getRawSelectorText(
      $,
      `#HistoryCountyAssessedValue${idx}`,
    );
    const countyAssessed = toNumberCurrency(
      getCellText($, `#HistoryCountyAssessedValue${idx}`),
    );
    const taxableHRaw = getRawSelectorText(
      $,
      `#HistoryCountyTaxableValue${idx}`,
    );
    const taxableH = toNumberCurrency(
      getCellText($, `#HistoryCountyTaxableValue${idx}`),
    );
    const schoolTaxableHRaw = getRawSelectorText(
      $,
      `#HistorySchoolTaxableValue${idx}`,
    );
    const schoolTaxableH = toNumberCurrency(
      getCellText($, `#HistorySchoolTaxableValue${idx}`),
    );
    const yearlyHRaw = getRawSelectorText($, `#HistoryTotalTaxes${idx}`);
    const yearlyH = toNumberCurrency(getCellText($, `#HistoryTotalTaxes${idx}`));
    const nonSchoolBenefitRaw = getRawSelectorText(
      $,
      `#HistoryNonSchool10PctBenefit${idx}`,
    );
    const nonSchoolBenefit = toNumberCurrency(
      getCellText($, `#HistoryNonSchool10PctBenefit${idx}`),
    );
    const totalAdvTaxesHRaw = getRawSelectorText(
      $,
      `#HistoryTotalAdvTaxes${idx}`,
    );
    const totalAdvTaxesH = toNumberCurrency(
      getCellText($, `#HistoryTotalAdvTaxes${idx}`),
    );
    const otherMillageHRaw = getRawSelectorText(
      $,
      `#HistoryOtherMillage${idx}`,
    );
    const otherMillageH = toNumberCurrency(
      getCellText($, `#HistoryOtherMillage${idx}`),
    );

    if (yNum && (landH != null || imprH != null || justH != null)) {
      years.push({
        idx,
        yNum,
        landH,
        landHRaw,
        imprH,
        imprHRaw,
        justH,
        justHRaw,
        schoolAssessed,
        schoolAssessedRaw,
        countyAssessed,
        countyAssessedRaw,
        taxableH,
        taxableHRaw,
        schoolTaxableH,
        schoolTaxableHRaw,
        yearlyH,
        yearlyHRaw,
        nonSchoolBenefit,
        nonSchoolBenefitRaw,
        totalAdvTaxesH,
        totalAdvTaxesHRaw,
        otherMillageH,
        otherMillageHRaw,
      });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const taxObj = {
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
      request_identifier: folio,
    };
    const historySourceFields = {};
    if (rec.landHRaw) {
      historySourceFields.land_just_value_text = rec.landHRaw;
    }
    if (rec.imprHRaw) {
      historySourceFields.improvements_just_value_text = rec.imprHRaw;
    }
    if (rec.justHRaw) {
      historySourceFields.total_just_value_text = rec.justHRaw;
    }
    if (rec.schoolAssessedRaw) {
      historySourceFields.school_assessed_value_text = rec.schoolAssessedRaw;
    }
    if (rec.countyAssessedRaw) {
      historySourceFields.county_assessed_value_text = rec.countyAssessedRaw;
    }
    if (rec.taxableHRaw) {
      historySourceFields.county_taxable_value_text = rec.taxableHRaw;
    }
    if (rec.schoolTaxableHRaw) {
      historySourceFields.school_taxable_value_text = rec.schoolTaxableHRaw;
    }
    if (rec.yearlyHRaw) {
      historySourceFields.total_tax_amount_text = rec.yearlyHRaw;
    }
    if (rec.nonSchoolBenefitRaw) {
      historySourceFields.non_school_additional_homestead_exemption_amount_text =
        rec.nonSchoolBenefitRaw;
    }
    if (rec.totalAdvTaxesHRaw) {
      historySourceFields.total_ad_valorem_tax_amount_text =
        rec.totalAdvTaxesHRaw;
    }
    if (rec.otherMillageHRaw) {
      historySourceFields.other_millage_rate_text = rec.otherMillageHRaw;
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
