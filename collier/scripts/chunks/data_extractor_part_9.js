  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

  // Building permits and certificates of occupancy
  $("#PermitAdditional tr[id^=TrPermit]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrPermit(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const permitNumber = $(`#permitno${idx}`).text().trim() || null;
    const permitType = $(`#permittype${idx}`).text().trim() || null;
    const issuer = $(`#issuer${idx}`).text().trim() || null;
    const issueDate = parseDateToISO($(`#IssuedDate${idx}`).text().trim());
    const coDate = parseDateToISO($(`#codate${idx}`).text().trim());
    const taxYearPermit = toNumberCurrency($(`#taxyear${idx}`).text());

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
  const land = toNumberCurrency($("#LandJustValue").first().text());
  const impr = toNumberCurrency($("#ImprovementsJustValue").first().text());
  const just = toNumberCurrency($("#TotalJustValue").first().text());
  let assessed = toNumberCurrency(
    $("#TdDetailCountyAssessedValue").first().text(),
  );
  if (assessed == null) {
    assessed = toNumberCurrency(
      $("#HistorySchoolAssessedValue1").first().text(),
    );
  }
  let taxable = toNumberCurrency($("#CountyTaxableValue").first().text());
  if (taxable == null) {
    taxable = toNumberCurrency($("#TdDetailCountyTaxableValue").first().text());
  }
  let yearly = toNumberCurrency($("#TotalTaxes").first().text());
  if (yearly == null) {
    yearly = toNumberCurrency(
      $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text(),
    );
  }
  const totalAdValoremTaxes = toNumberCurrency(
    $("#TotalAdvTaxes").first().text(),
  );
  const totalNonAdValoremTaxes = toNumberCurrency(
    $("#TotalNAdvTaxes").first().text(),
  );
  const schoolTaxableValue = toNumberCurrency(
    $("#SchoolTaxableValue").first().text(),
  );
  const nonSchoolAddlHomestead = toNumberCurrency(
    $("#NonSchoolAddHmstdExemptAmount").first().text(),
  );
  const countyMillage = toNumberCurrency(
    $("#TdDetailCountyMillage").first().text(),
  );
  const schoolMillage = toNumberCurrency(
    $("#TdDetailSchoolMillage").first().text(),
  );
  const otherMillage = toNumberCurrency(
    $("#TdDetailOtherMillage").first().text(),
  );
  const totalMillage = toNumberCurrency(
    $("#TdDetailTotalMillage").first().text(),
  );
  const sohBenefitAmount = toNumberCurrency($("#SohBenefit").first().text());
  let sohLabel = null;
  const sohRow = $("#SohBenefit").closest("tr");
  if (sohRow && sohRow.length) {
    const labelText = sohRow.find("td").first().text();
    if (labelText) sohLabel = labelText.replace(/\s+/g, " ").trim();
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
    const name = $(`#TaName${idx}`).text().trim() || null;
    const category = $(`#TaxableType${idx}`).text().trim() || null;
    const taxableValue = toNumberCurrency($(`#Taxable${idx}`).text());
    const millageRate = toNumberCurrency($(`#Millage${idx}`).text());
    const taxAmount = toNumberCurrency($(`#Tax${idx}`).text());
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
    const name = $(`#LANAME${idx}`).text().trim() || null;
    const chargeAmount = toNumberCurrency($(`#TAX${idx}`).text());
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

    const landH = toNumberCurrency($(`#HistoryLandJustValue${idx}`).text());
    const imprH = toNumberCurrency(
      $(`#HistoryImprovementsJustValue${idx}`).text(),
    );
    const justH = toNumberCurrency($(`#HistoryTotalJustValue${idx}`).text());
    const schoolAssessed = toNumberCurrency(
      $(`#HistorySchoolAssessedValue${idx}`).text(),
    );
    const countyAssessed = toNumberCurrency(
      $(`#HistoryCountyAssessedValue${idx}`).text(),
    );
    const taxableH = toNumberCurrency(
      $(`#HistoryCountyTaxableValue${idx}`).text(),
    );
    const schoolTaxableH = toNumberCurrency(
      $(`#HistorySchoolTaxableValue${idx}`).text(),
    );
    const yearlyH = toNumberCurrency($(`#HistoryTotalTaxes${idx}`).text());
    const nonSchoolBenefit = toNumberCurrency(
      $(`#HistoryNonSchool10PctBenefit${idx}`).text(),
    );
    const totalAdvTaxesH = toNumberCurrency(
      $(`#HistoryTotalAdvTaxes${idx}`).text(),
    );
    const otherMillageH = toNumberCurrency(
      $(`#HistoryOtherMillage${idx}`).text(),
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
