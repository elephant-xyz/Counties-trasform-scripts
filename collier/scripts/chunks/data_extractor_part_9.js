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
  const land = toNumberCurrency(getCellText($, "#LandJustValue"));
  const impr = toNumberCurrency(getCellText($, "#ImprovementsJustValue"));
  const just = toNumberCurrency(getCellText($, "#TotalJustValue"));
  let assessed = toNumberCurrency(
    getCellText($, "#TdDetailCountyAssessedValue"),
  );
  if (assessed == null) {
    assessed = toNumberCurrency(
      getCellText($, "#HistorySchoolAssessedValue1"),
    );
  }
  let taxable = toNumberCurrency(getCellText($, "#CountyTaxableValue"));
  if (taxable == null) {
    taxable = toNumberCurrency(getCellText($, "#TdDetailCountyTaxableValue"));
  }
  let yearly = toNumberCurrency(getCellText($, "#TotalTaxes"));
  if (yearly == null) {
    yearly = toNumberCurrency(
      getCellText($, "#TblAdValoremAdditionalTotal #TotalAdvTaxes"),
    );
  }
  if (yearly == null) {
    const altYearly = toNumberCurrency(
      getCellText(
        $,
        "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
      ),
    );
    if (altYearly != null) yearly = altYearly;
  }
  const totalAdValoremTaxes = toNumberCurrency(getCellText($, "#TotalAdvTaxes"));
  const totalNonAdValoremTaxes = toNumberCurrency(
    getCellText($, "#TotalNAdvTaxes"),
  );
  const schoolTaxableValue = toNumberCurrency(
    getCellText($, "#SchoolTaxableValue"),
  );
  const nonSchoolAddlHomestead = toNumberCurrency(
    getCellText($, "#NonSchoolAddHmstdExemptAmount"),
  );
  const countyMillage = toNumberCurrency(getCellText($, "#TdDetailCountyMillage"));
  const schoolMillage = toNumberCurrency(
    getCellText($, "#TdDetailSchoolMillage"),
  );
  const otherMillage = toNumberCurrency(
    getCellText($, "#TdDetailOtherMillage"),
  );
  const totalMillage = toNumberCurrency(
    getCellText($, "#TdDetailTotalMillage"),
  );
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

    const landH = toNumberCurrency(getCellText($, `#HistoryLandJustValue${idx}`));
    const imprH = toNumberCurrency(
      getCellText($, `#HistoryImprovementsJustValue${idx}`),
    );
    const justH = toNumberCurrency(getCellText($, `#HistoryTotalJustValue${idx}`));
    const schoolAssessed = toNumberCurrency(
      getCellText($, `#HistorySchoolAssessedValue${idx}`),
    );
    const countyAssessed = toNumberCurrency(
      getCellText($, `#HistoryCountyAssessedValue${idx}`),
    );
    const taxableH = toNumberCurrency(
      getCellText($, `#HistoryCountyTaxableValue${idx}`),
    );
    const schoolTaxableH = toNumberCurrency(
      getCellText($, `#HistorySchoolTaxableValue${idx}`),
    );
    const yearlyH = toNumberCurrency(getCellText($, `#HistoryTotalTaxes${idx}`));
    const nonSchoolBenefit = toNumberCurrency(
      getCellText($, `#HistoryNonSchool10PctBenefit${idx}`),
    );
    const totalAdvTaxesH = toNumberCurrency(
      getCellText($, `#HistoryTotalAdvTaxes${idx}`),
    );
    const otherMillageH = toNumberCurrency(
      getCellText($, `#HistoryOtherMillage${idx}`),
    );

    if (yNum && (landH != null || imprH != null || justH != null)) {
      years.push({
        idx,
        yNum,
        landH,
        imprH,
        justH,
        schoolAssessed,
        countyAssessed,
        taxableH,
        schoolTaxableH,
        yearlyH,
        nonSchoolBenefit,
        totalAdvTaxesH,
        otherMillageH,
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
    const existing = taxRecordMap.get(rec.yNum);
    if (existing) {
      const merged = { ...existing };
      for (const [key, value] of Object.entries(taxObj)) {
        if ((merged[key] === null || merged[key] === undefined) && value != null) {
          merged[key] = value;
        }
      }
      taxRecordMap.set(rec.yNum, merged);
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
