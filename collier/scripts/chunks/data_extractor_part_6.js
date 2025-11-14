      bookPage,
    };
    saleRows.push(row);
  });

  const deedRecords = [];
  const fileRecords = [];

  const saleCleanupPatterns = [
    /^sales_\d+\.json$/,
    /^sales_history_\d+\.json$/,
    /^relationship_sales_deed_\d+\.json$/,
    /^relationship_sales_history_has_deed_\d+\.json$/,
    /^relationship_sales_person_/,
    /^relationship_sales_company_/,
    /^relationship_sales_history_has_person_/,
    /^relationship_sales_history_has_company_/,
    /^relationship_sales_history_has_fact_sheet_/,
  ];
  fs.readdirSync(dataDir).forEach((fileName) => {
    if (saleCleanupPatterns.some((re) => re.test(fileName))) {
      try {
        fs.unlinkSync(path.join(dataDir, fileName));
      } catch (_) {}
    }
  });

  // Create deed and file files for every sale row (even $0)
  saleRows.forEach((row, idx) => {
    const cleanedBookPage = row.bookPage ? String(row.bookPage).trim() : "";
    let book = null;
    let page = null;
    if (cleanedBookPage) {
      const separatorMatch = cleanedBookPage.match(/(\w+)\s*[/\-]\s*(\w+)/);
      if (separatorMatch) {
        book = separatorMatch[1];
        page = separatorMatch[2];
      } else {
        const bookMatch = cleanedBookPage.match(/\b(?:book|bk)\s*([0-9a-zA-Z]+)/i);
        const pageMatch = cleanedBookPage.match(/\b(?:page|pg)\s*([0-9a-zA-Z]+)/i);
        if (bookMatch) book = bookMatch[1];
        if (pageMatch) page = pageMatch[1];
        if (!book || !page) {
          const tokens = cleanedBookPage.split(/[^0-9a-zA-Z]+/).filter(Boolean);
          if (tokens.length >= 2) {
            if (!book) book = tokens[0];
            if (!page) page = tokens[1];
          }
          if (!book) book = cleanedBookPage;
        }
      }
    }

    const deedObj = {};
    if (book) deedObj.book = book;
    if (page) deedObj.page = page;
    fs.writeFileSync(
      path.join(dataDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
    );
    deedRecords.push(deedObj);

    const fileObj = {};
    const fileNameParts = [];
    if (book) fileNameParts.push(`Book ${book}`);
    if (page) fileNameParts.push(`Page ${page}`);
    if (fileNameParts.length > 0) {
      fileObj.name = fileNameParts.join(" ");
    } else if (row.bookPage) {
      fileObj.name = row.bookPage;
    }
    fs.writeFileSync(
      path.join(dataDir, `file_${idx + 1}.json`),
      JSON.stringify(fileObj, null, 2),
    );
    fileRecords.push(fileObj);

    const relDf = {
      from: { "/": `./deed_${idx + 1}.json` },
      to: { "/": `./file_${idx + 1}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_deed_file_${idx + 1}.json`),
      JSON.stringify(relDf, null, 2),
    );
  });

  // Create sales files for all valid sales (including $0 amounts)
  const validSales = saleRows.filter(
    (r) => r.amount != null && r.iso,
  );
  validSales.sort((a, b) => a.iso.localeCompare(b.iso));
  const salesRecords = [];
  validSales.forEach((s, idx) => {
    const saleObj = {
      ownership_transfer_date: s.iso,
    };
    if (s.amount != null) {
      saleObj.purchase_price_amount = s.amount;
    }
    const saleFilename = `sales_history_${idx + 1}.json`;
    salesRecords.push(saleFilename);
    fs.writeFileSync(
      path.join(dataDir, saleFilename),
      JSON.stringify(saleObj, null, 2),
    );
  });

  // Relationship: sales_history -> deed for all valid sales (map to original row index)
  const factSheetExists = fs.existsSync(path.join(dataDir, "fact_sheet.json"));
  validSales.forEach((s, idx) => {
    const deedIdx = s.rowIndex;
    const saleRef = { "/": `./sales_history_${idx + 1}.json` };
    if (deedIdx != null) {
      const rel = {
        from: saleRef,
        to: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_sales_history_has_deed_${idx + 1}.json`),
        JSON.stringify(rel, null, 2),
      );
    }
    if (factSheetExists) {
      const relFactSheet = {
        from: saleRef,
        to: { "/": "./fact_sheet.json" },
      };
      fs.writeFileSync(
        path.join(
          dataDir,
          `relationship_sales_history_has_fact_sheet_${idx + 1}.json`,
        ),
        JSON.stringify(relFactSheet, null, 2),
      );
    }
  });

  // Owners (company/person) from owners/owner_data.json
  const ownerKey = `property_${folio}`;
  const ownerEntry = owners[ownerKey];
  if (
    ownerEntry &&
    ownerEntry.owners_by_date &&
    Array.isArray(ownerEntry.owners_by_date.current)
  ) {
    const curr = ownerEntry.owners_by_date.current;
    if (curr.length > 0) {
      // Handle mixed owner types (persons and companies)
      let personIdx = 1;
      let companyIdx = 1;
      let personRelIdx = 1;
      let companyRelIdx = 1;
      const personFiles = [];
      const companyFiles = [];

      curr.forEach((owner) => {
        if (owner.type === "company") {
          const comp = { name: owner.name || null };
          const filename = `company_${companyIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(comp, null, 2),
          );
          companyFiles.push(filename);
          companyIdx++;
        } else if (owner.type === "person") {
          const person = {
            birth_date: owner.birth_date || null,
            first_name: capitalizeProperName(owner.first_name) || "",
            last_name: capitalizeProperName(owner.last_name) || "",
            middle_name: owner.middle_name ? capitalizeProperName(owner.middle_name) : null,
            prefix_name: owner.prefix_name || null,
            suffix_name: owner.suffix_name || null,
            us_citizenship_status: owner.us_citizenship_status || null,
            veteran_status: owner.veteran_status != null ? owner.veteran_status : null,
          };
          const filename = `person_${personIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(person, null, 2),
          );
          personFiles.push(filename);
          personIdx++;
        }
      });

      // Create relationships for valid sales
      if (validSales.length > 0) {
        validSales.forEach((s, si) => {
          // Link to all person files
          personFiles.forEach((personFile) => {
            const rel = {
              from: { "/": `./sales_history_${si + 1}.json` },
              to: { "/": `./${personFile}` },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_history_has_person_${personRelIdx}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
            personRelIdx++;
          });

          // Link to all company files
          companyFiles.forEach((companyFile) => {
            const rel = {
              from: { "/": `./sales_history_${si + 1}.json` },
              to: { "/": `./${companyFile}` },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_history_has_company_${companyRelIdx}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
            companyRelIdx++;
          });
        });
      }
    }
  });
