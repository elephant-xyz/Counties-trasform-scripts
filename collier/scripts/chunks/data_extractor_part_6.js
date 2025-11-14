      bookPage,
    };
    saleRows.push(row);
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
  validSales.forEach((s, idx) => {
    const saleObj = {
      ownership_transfer_date: s.iso,
      purchase_price_amount: s.amount || 0, // Use 0 if amount is 0
    };
    fs.writeFileSync(
      path.join(dataDir, `sales_${idx + 1}.json`),
      JSON.stringify(saleObj, null, 2),
    );
  });

  // Relationship: sales -> deed for all valid sales (map to original row index)
  validSales.forEach((s, idx) => {
    const orig = saleRows.findIndex(
      (r) => r.iso === s.iso && r.amount === s.amount,
    );
    if (orig !== -1) {
      const deedIdx = orig + 1;
      const rel = {
        from: { "/": `./sales_${idx + 1}.json` },
        to: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`),
        JSON.stringify(rel, null, 2),
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
      // Cleanup any legacy duplicate relationship files
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("relationship_sales_company"));
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dataDir, f));
        } catch (_) {}
      }

      // Handle mixed owner types (persons and companies)
      let personIdx = 1;
      let companyIdx = 1;
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
          personFiles.forEach((personFile, pi) => {
            const rel = {
              from: { "/": `./${personFile}` },
              to: { "/": `./sales_${si + 1}.json` },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_person_${pi + 1}_${si + 1}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
          });

          // Link to all company files
          companyFiles.forEach((companyFile, ci) => {
            const rel = {
              from: { "/": `./${companyFile}` },
              to: { "/": `./sales_${si + 1}.json` },
            };
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
  });
