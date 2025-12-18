const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

function extractOwnerInfo(ownershipHtml) {
  if (!ownershipHtml) return [];

  // Remove content within <p></p> tags (addresses)
  const htmlWithoutAddresses = ownershipHtml.replace(/<p>.*?<\/p>/gs, '');

  // Split by <br> tags to get individual owner lines
  const ownerLines = htmlWithoutAddresses.split(/<br\s*\/?>/i)
    .map(line => line.replace(/<[^>]*>/g, '').trim())
    .filter(line => line.length > 0);

  const owners = [];
  const companyIndicators = /\b(LLC|INC|CORP|CORPORATION|LTD|LIMITED|LP|COMPANY|CO\.|TRUST|TRUSTEE|ESTATE|BANK|ASSOCIATION|ASSOC|PARTNERSHIP|STATE|COUNTY|CITY|GOVERNMENT|FEDERAL|PUBLIC|MUNICIPAL|DISTRICT|AUTHORITY|COMMISSION|AGENCY|DEPARTMENT|BOARD|LANDS)\b/i;

  for (const line of ownerLines) {
    let cleanName = line.trim();
    if (cleanName && cleanName.length > 2) {
      // Decode HTML entities like &amp; to &
      cleanName = cleanName.replace(/&amp;/g, '&');

      // Remove legal designations that are not part of the person's name
      cleanName = cleanName
        .replace(/\s*\([^)]*\)\s*/g, ' ') // Remove parenthetical content like (GUARDIAN), (TRUSTEE), etc.
        .replace(/\s+L\/E\s*$/i, '')
        .replace(/\s+JT\/RS\s*$/i, '')
        .replace(/\s+JTWROS\s*$/i, '')
        .replace(/\s+JT\s+W\/RS\s*$/i, '')
        .replace(/\s+TENANTS?\s+IN\s+COMMON\s*$/i, '')
        .replace(/\s+TIC\s*$/i, '')
        .replace(/\s+ET\s+AL\.?\s*$/i, '')
        .replace(/\s+TTEE\s*$/i, '')
        .replace(/\s+AS\s+TRUSTEE.*$/i, '')
        .replace(/\s+CUSTODIAN.*$/i, '')
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim();

      console.log(`Line: "${line}" -> Cleaned: "${cleanName}"`);

      const ownerType = companyIndicators.test(cleanName) ? 'Company' : 'Person';
      owners.push({ name: cleanName, type: ownerType });
    }
  }

  return owners;
}

const ownershipHtml = $('.parcel-info .parcel-detail .ownership').html();
const owners = extractOwnerInfo(ownershipHtml);
console.log('\nExtracted owners:');
console.log(JSON.stringify(owners, null, 2));
