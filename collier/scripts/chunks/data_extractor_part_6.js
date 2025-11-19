      bookPage,
    };
    saleRows.push(row);
  });

  const parseBookAndPage = (value) => {
    if (!value) {
      return { bookNumber: null, pageNumber: null };
    }
    const tokens = value.split(/[-/]/).map((part) => part.trim()).filter(Boolean);
    let bookNumber = null;
    let pageNumber = null;
    if (tokens.length >= 2) {
      const bookCandidate = Number(tokens[0].replace(/[^\d]/g, ""));
      const pageCandidate = Number(tokens[1].replace(/[^\d]/g, ""));
      bookNumber = Number.isFinite(bookCandidate) && !Number.isNaN(bookCandidate) ? bookCandidate : null;
      pageNumber = Number.isFinite(pageCandidate) && !Number.isNaN(pageCandidate) ? pageCandidate : null;
    }
    return { bookNumber, pageNumber };
  };

  // Create deed files for every sale row (even $0)
  saleRows.forEach((row, idx) => {
    const { bookNumber, pageNumber } = parseBookAndPage(row.bookPage);
    const deedObj = {
      document_identifier: row.bookPage || null,
      recording_book_number: bookNumber,
      recording_page_number: pageNumber,
    };
    fs.writeFileSync(
      path.join(dataDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
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

      curr.forEach((owner) => {
        if (owner.type === "company") {
          const comp = { name: owner.name || null };
          const filename = `company_${companyIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(comp, null, 2),
          );
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
          personIdx++;
        }
      });
