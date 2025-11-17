  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

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
  const landText = $("#LandJustValue").first().text().trim();
  const land = toNumberCurrency(landText);
  const imprText = $("#ImprovementsJustValue").first().text().trim();
  const impr = toNumberCurrency(imprText);
  const justText = $("#TotalJustValue").first().text().trim();
  const just = toNumberCurrency(justText);
  const nonSchoolExemptionText = $("#NonSchoolWhollyExemptAmount")
    .first()
    .text()
    .trim();
  const nonSchoolExemption = toNumberCurrency(nonSchoolExemptionText);
  const assessedCandidates = [
    $("#TdDetailCountyAssessedValue").first().text().trim(),
    $("#HistorySchoolAssessedValue1").first().text().trim(),
  ];
  let assessedText = assessedCandidates.find((txt) => txt);
  let assessed =
    assessedText && assessedText !== ""
      ? toNumberCurrency(assessedText)
      : null;
  const taxableCandidates = [
    $("#CountyTaxableValue").first().text().trim(),
    $("#TdDetailCountyTaxableValue").first().text().trim(),
  ];
  let taxableText = taxableCandidates.find((txt) => txt);
  let taxable =
    taxableText && taxableText !== ""
      ? toNumberCurrency(taxableText)
      : null;
  const yearlyCandidates = [
    $("#TotalTaxes").first().text().trim(),
    $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text().trim(),
  ];
  let yearlyText = yearlyCandidates.find((txt) => txt);
  let yearly =
    yearlyText && yearlyText !== ""
      ? toNumberCurrency(yearlyText)
      : null;

  if (ty != null && (land != null || impr != null || just != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    const identifierParts = [];
    if (rollType) identifierParts.push(rollType);
    if (justText) identifierParts.push(`TotalJustValue=${justText}`);
    if (landText) identifierParts.push(`LandJustValue=${landText}`);
    if (imprText) identifierParts.push(`ImprovementsJustValue=${imprText}`);
    if (nonSchoolExemptionText) {
      identifierParts.push(
        `NonSchoolWhollyExemptAmount=${nonSchoolExemptionText}`,
      );
    }
    if (assessedText) identifierParts.push(`AssessedValue=${assessedText}`);
    if (taxableText) identifierParts.push(`CountyTaxableValue=${taxableText}`);
    if (yearlyText) identifierParts.push(`TotalTaxes=${yearlyText}`);
    const taxObj = {
      tax_year: ty,
      property_assessed_value_amount:
        assessed != null ? assessed : just != null ? just : null,
      property_market_value_amount:
        just != null ? just : assessed != null ? assessed : null,
      property_building_amount: impr != null ? impr : null,
      property_land_amount: land != null ? land : null,
      property_taxable_value_amount:
        taxable != null ? taxable : assessed != null ? assessed : null,
      property_exemption_amount:
        nonSchoolExemption != null ? nonSchoolExemption : null,
      monthly_tax_amount: monthly,
      period_end_date: ty ? `${ty}-12-31` : null,
      period_start_date: ty ? `${ty}-01-01` : null,
      yearly_tax_amount: yearly != null ? yearly : null,
      request_identifier:
        identifierParts.length > 0 ? identifierParts.join("|") : null,
    };
    fs.writeFileSync(
      path.join(dataDir, "tax_1.json"),
      JSON.stringify(taxObj, null, 2),
    );
  }

  const adValoremRows = [];
  for (let idx = 1; idx <= 50; idx++) {
    const name = $(`#TaName${idx}`).text().trim();
    const taxableText = $(`#Taxable${idx}`).text().trim();
    const taxableVal = toNumberCurrency(taxableText);
    const millageText = $(`#Millage${idx}`).text().trim();
    const millage = millageText ? Number(millageText) : null;
    const taxAmountText = $(`#Tax${idx}`).text().trim();
    const taxAmount = toNumberCurrency(taxAmountText);
    const taxableType = $(`#TaxableType${idx}`).text().trim();

    if (
      !name &&
      taxableVal == null &&
      (millage == null || Number.isNaN(millage)) &&
      taxAmount == null &&
      !taxableType
    ) {
      continue;
    }

    adValoremRows.push({
      name: name || null,
      taxableVal,
      taxableText: taxableText || null,
      millage: millage != null && !Number.isNaN(millage) ? millage : null,
      millageText: millageText || null,
      taxAmount,
      taxAmountText: taxAmountText || null,
      type: taxableType || null,
    });
  }

  adValoremRows.forEach((row, idx) => {
    if (row.taxableVal == null && row.taxAmount == null && row.millage == null) {
      return;
    }
    const monthly = row.taxAmount != null ? round2(row.taxAmount / 12) : null;
    const identifierParts = ["AdValorem"];
    if (row.type) identifierParts.push(row.type);
    if (row.name) identifierParts.push(row.name);
    if (row.millageText) identifierParts.push(`Millage=${row.millageText}`);
    if (row.taxAmountText) identifierParts.push(`Tax=${row.taxAmountText}`);
    if (row.taxableText) identifierParts.push(`Taxable=${row.taxableText}`);
    const taxObj = {
      tax_year: ty,
      property_taxable_value_amount: row.taxableVal != null ? row.taxableVal : null,
      yearly_tax_amount: row.taxAmount != null ? row.taxAmount : null,
      monthly_tax_amount: monthly,
      request_identifier:
        identifierParts.length > 1 ? identifierParts.join("|") : null,
      property_assessed_value_amount: null,
      property_market_value_amount: null,
      property_building_amount: null,
      property_land_amount: null,
      property_exemption_amount: null,
      period_start_date: ty ? `${ty}-01-01` : null,
      period_end_date: ty ? `${ty}-12-31` : null,
    };
    const filename = `tax_breakdown_${idx + 1}.json`;
    fs.writeFileSync(
      path.join(dataDir, filename),
      JSON.stringify(taxObj, null, 2),
    );
  });

  const totalAdValoremText = $("#TblAdValoremAdditionalTotal #TotalAdvTaxes")
    .first()
    .text()
    .trim();
  const totalAdValorem = toNumberCurrency(totalAdValoremText);
  if (totalAdValorem != null) {
    const detailCountyMillageText = $("#TdDetailCountyMillage")
      .first()
      .text()
      .trim();
    const detailSchoolMillageText = $("#TdDetailSchoolMillage")
      .first()
      .text()
      .trim();
    const detailMunicipalMillageText = $("#TdDetailMunicipalMillage")
      .first()
      .text()
      .trim();
    const detailNonSchoolMillageText = $("#TdDetailNonSchoolMillage")
      .first()
      .text()
      .trim();
    const detailOtherMillageText = $("#TdDetailOtherMillage")
      .first()
      .text()
      .trim();
    const identifierParts = ["AdValorem", "Total"];
    if (detailCountyMillageText) {
      identifierParts.push(`county:${detailCountyMillageText}`);
    }
    if (detailSchoolMillageText) {
      identifierParts.push(`school:${detailSchoolMillageText}`);
    }
    if (detailMunicipalMillageText) {
      identifierParts.push(`municipal:${detailMunicipalMillageText}`);
    }
    if (detailNonSchoolMillageText) {
      identifierParts.push(`nonschool:${detailNonSchoolMillageText}`);
    }
    if (detailOtherMillageText) {
      identifierParts.push(`other:${detailOtherMillageText}`);
    }
    if (totalAdValoremText) {
      identifierParts.push(`TotalAdvTaxes=${totalAdValoremText}`);
    }
    const taxObj = {
      tax_year: ty,
      yearly_tax_amount: totalAdValorem,
      monthly_tax_amount: round2(totalAdValorem / 12),
      request_identifier:
        identifierParts.length > 2 ? identifierParts.join("|") : null,
      property_taxable_value_amount: null,
      property_assessed_value_amount: null,
      property_market_value_amount: null,
      property_building_amount: null,
      property_land_amount: null,
      property_exemption_amount: null,
      period_start_date: ty ? `${ty}-01-01` : null,
      period_end_date: ty ? `${ty}-12-31` : null,
    };
    fs.writeFileSync(
      path.join(dataDir, "tax_breakdown_total.json"),
      JSON.stringify(taxObj, null, 2),
    );
  }

  // From History (Tab6) for multiple years
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = $(`#HistoryTaxYear${idx}`).text().trim();
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);
    if (!yNum) continue;

    const landHText = $(`#HistoryLandJustValue${idx}`).text().trim();
    const landH = toNumberCurrency(landHText);
    const imprHText = $(`#HistoryImprovementsJustValue${idx}`)
      .text()
      .trim();
    const imprH = toNumberCurrency(imprHText);
    const justHText = $(`#HistoryTotalJustValue${idx}`).text().trim();
    const justH = toNumberCurrency(justHText);
    const assessedHText = $(`#HistorySchoolAssessedValue${idx}`)
      .text()
      .trim();
    const assessedH = toNumberCurrency(assessedHText);
    const taxableHText = $(`#HistoryCountyTaxableValue${idx}`)
      .text()
      .trim();
    const taxableH = toNumberCurrency(taxableHText);
    const yearlyHText = $(`#HistoryTotalTaxes${idx}`).text().trim();
    const yearlyH = toNumberCurrency(yearlyHText);
    const benefitHText = $(`#HistoryNonSchool10PctBenefit${idx}`)
      .text()
      .trim();
    const benefitH = toNumberCurrency(benefitHText);
    const schoolMillageText = $(`#HistorySchoolMillage${idx}`)
      .text()
      .trim();
    const schoolMillage =
      schoolMillageText && schoolMillageText !== ""
        ? Number(schoolMillageText)
        : null;
    const countyMillageText = $(`#HistoryCountyMillage${idx}`)
      .text()
      .trim();
    const countyMillage =
      countyMillageText && countyMillageText !== ""
        ? Number(countyMillageText)
        : null;
    const municipalMillageText = $(`#HistoryMunicipalMillage${idx}`)
      .text()
      .trim();
    const municipalMillage =
      municipalMillageText && municipalMillageText !== ""
        ? Number(municipalMillageText)
        : null;
    const otherMillageText = $(`#HistoryOtherMillage${idx}`).text().trim();
    const otherMillage =
      otherMillageText && otherMillageText !== ""
        ? Number(otherMillageText)
        : null;

    if (yNum && (landH != null || imprH != null || justH != null)) {
      years.push({
        idx,
        yNum,
      landH,
      imprH,
      justH,
      assessedH,
      taxableH,
      yearlyH,
      benefitH,
      schoolMillage,
      schoolMillageText,
      countyMillage,
      countyMillageText,
      municipalMillage,
      municipalMillageText,
      otherMillage,
      otherMillageText,
      yearlyHText,
      taxableHText,
      assessedHText,
      justHText,
    });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const identifierParts = ["History", rec.yNum];
    if (rec.schoolMillageText) {
      identifierParts.push(`school:${rec.schoolMillageText}`);
    }
    if (rec.countyMillageText) {
      identifierParts.push(`county:${rec.countyMillageText}`);
    }
    if (rec.municipalMillageText) {
      identifierParts.push(`municipal:${rec.municipalMillageText}`);
    }
    if (rec.otherMillageText) {
      identifierParts.push(`other:${rec.otherMillageText}`);
    }
    if (rec.yearlyHText) {
      identifierParts.push(`TotalTaxes=${rec.yearlyHText}`);
    }
    if (rec.taxableHText) {
      identifierParts.push(`CountyTaxableValue=${rec.taxableHText}`);
    }
    if (rec.assessedHText) {
      identifierParts.push(`AssessedValue=${rec.assessedHText}`);
    }
    if (rec.justHText) {
      identifierParts.push(`TotalJustValue=${rec.justHText}`);
    }
    const taxObj = {
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.assessedH != null
          ? rec.assessedH
          : rec.justH != null
            ? rec.justH
            : null,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.assessedH != null
            ? rec.assessedH
            : null,
      property_building_amount: rec.imprH != null ? rec.imprH : null,
      property_land_amount: rec.landH != null ? rec.landH : null,
      property_taxable_value_amount:
        rec.taxableH != null
          ? rec.taxableH
          : rec.assessedH != null
            ? rec.assessedH
            : null,
      property_exemption_amount: rec.benefitH != null ? rec.benefitH : null,
      monthly_tax_amount: monthly,
      period_end_date: `${rec.yNum}-12-31`,
      period_start_date: `${rec.yNum}-01-01`,
      yearly_tax_amount: rec.yearlyH != null ? rec.yearlyH : null,
      request_identifier:
        identifierParts.length > 1 ? identifierParts.join("|") : null,
    };
    const outIdx = rec.idx; // 1..5 corresponds to 2025..2021
    fs.writeFileSync(
      path.join(dataDir, `tax_${outIdx}.json`),
      JSON.stringify(taxObj, null, 2),
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
