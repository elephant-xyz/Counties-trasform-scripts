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
  const land = toNumberCurrency($("#LandJustValue").first().text());
  const impr = toNumberCurrency($("#ImprovementsJustValue").first().text());
  const just = toNumberCurrency($("#TotalJustValue").first().text());
  const nonSchoolExemption = toNumberCurrency(
    $("#NonSchoolWhollyExemptAmount").first().text(),
  );
  let assessed = toNumberCurrency(
    $("#TdDetailCountyAssessedValue").first().text(),
  );
  if (assessed == null) {
    assessed = toNumberCurrency(
      $("#HistorySchoolAssessedValue1").first().text(),
    );
  }
  let taxable = toNumberCurrency($("#CountyTaxableValue").first().text());
  if (taxable == null)
    taxable = toNumberCurrency($("#TdDetailCountyTaxableValue").first().text());
  let yearly = toNumberCurrency($("#TotalTaxes").first().text());
  if (yearly == null)
    yearly = toNumberCurrency(
      $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text(),
    );

  if (ty != null && (land != null || impr != null || just != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
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
    };
    fs.writeFileSync(
      path.join(dataDir, "tax_1.json"),
      JSON.stringify(taxObj, null, 2),
    );
  }

  const adValoremRows = [];
  for (let idx = 1; idx <= 50; idx++) {
    const name = $(`#TaName${idx}`).text().trim();
    const taxableVal = toNumberCurrency($(`#Taxable${idx}`).text());
    const millageText = $(`#Millage${idx}`).text().trim();
    const millage = millageText ? Number(millageText) : null;
    const taxAmount = toNumberCurrency($(`#Tax${idx}`).text());
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
      millage: millage != null && !Number.isNaN(millage) ? millage : null,
      taxAmount,
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
    if (row.millage != null) identifierParts.push(`millage:${row.millage}`);
    const taxObj = {
      tax_year: ty,
      property_taxable_value_amount: row.taxableVal != null ? row.taxableVal : null,
      yearly_tax_amount: row.taxAmount != null ? row.taxAmount : null,
      monthly_tax_amount: monthly,
      request_identifier: identifierParts.join("|"),
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

  const totalAdValorem = toNumberCurrency(
    $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text(),
  );
  if (totalAdValorem != null) {
    const detailCountyMillage = parseFloat(
      $("#TdDetailCountyMillage").first().text().replace(/[^0-9.]+/g, ""),
    );
    const detailSchoolMillage = parseFloat(
      $("#TdDetailSchoolMillage").first().text().replace(/[^0-9.]+/g, ""),
    );
    const detailMunicipalMillage = parseFloat(
      $("#TdDetailMunicipalMillage").first().text().replace(/[^0-9.]+/g, ""),
    );
    const detailOtherMillage = parseFloat(
      $("#TdDetailOtherMillage").first().text().replace(/[^0-9.]+/g, ""),
    );
    const identifierParts = ["AdValorem", "Total"];
    if (!Number.isNaN(detailCountyMillage)) {
      identifierParts.push(`county:${detailCountyMillage}`);
    }
    if (!Number.isNaN(detailSchoolMillage)) {
      identifierParts.push(`school:${detailSchoolMillage}`);
    }
    if (!Number.isNaN(detailMunicipalMillage)) {
      identifierParts.push(`municipal:${detailMunicipalMillage}`);
    }
    if (!Number.isNaN(detailOtherMillage)) {
      identifierParts.push(`other:${detailOtherMillage}`);
    }
    const taxObj = {
      tax_year: ty,
      yearly_tax_amount: totalAdValorem,
      monthly_tax_amount: round2(totalAdValorem / 12),
      request_identifier: identifierParts.join("|"),
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

    const landH = toNumberCurrency($(`#HistoryLandJustValue${idx}`).text());
    const imprH = toNumberCurrency(
      $(`#HistoryImprovementsJustValue${idx}`).text(),
    );
    const justH = toNumberCurrency($(`#HistoryTotalJustValue${idx}`).text());
    const assessedH = toNumberCurrency(
      $(`#HistorySchoolAssessedValue${idx}`).text(),
    );
    const taxableH = toNumberCurrency(
      $(`#HistoryCountyTaxableValue${idx}`).text(),
    );
    const yearlyH = toNumberCurrency($(`#HistoryTotalTaxes${idx}`).text());
    const benefitH = toNumberCurrency(
      $(`#HistoryNonSchool10PctBenefit${idx}`).text(),
    );
    const schoolMillage = parseFloat(
      $(`#HistorySchoolMillage${idx}`).text().trim(),
    );
    const countyMillage = parseFloat(
      $(`#HistoryCountyMillage${idx}`).text().trim(),
    );
    const municipalMillage = parseFloat(
      $(`#HistoryMunicipalMillage${idx}`).text().trim(),
    );
    const otherMillage = parseFloat(
      $(`#HistoryOtherMillage${idx}`).text().trim(),
    );

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
        countyMillage,
        municipalMillage,
        otherMillage,
      });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const identifierParts = ["History", rec.yNum];
    if (Number.isFinite(rec.schoolMillage)) {
      identifierParts.push(`school:${rec.schoolMillage}`);
    }
    if (Number.isFinite(rec.countyMillage)) {
      identifierParts.push(`county:${rec.countyMillage}`);
    }
    if (Number.isFinite(rec.municipalMillage)) {
      identifierParts.push(`municipal:${rec.municipalMillage}`);
    }
    if (Number.isFinite(rec.otherMillage)) {
      identifierParts.push(`other:${rec.otherMillage}`);
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
      request_identifier: identifierParts.join("|"),
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
