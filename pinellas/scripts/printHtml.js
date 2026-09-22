/**
 * Pinellas print-page HTML helpers.
 *
 * Drupal `property-details` IDs stay primary. When those are missing (PCPAO
 * print HTML), these fallbacks read span labels and print table ids.
 */

/**
 * @param {string} rawHtml - Raw capture HTML.
 * @returns {string | null} 18-digit STRAP, or null when none is present.
 */
function extractStrapFromRawHtml(rawHtml) {
  if (typeof rawHtml !== "string" || rawHtml.length === 0) return null;
  const printQuery = rawHtml.match(/is_print=1[&;]s=(\d{18})/i);
  if (printQuery) return printQuery[1];
  const query = rawHtml.match(/[?&]s=(\d{18})\b/);
  if (query) return query[1];
  const mapDiv = rawHtml.match(/div-parcel-map(\d{18})/);
  if (mapDiv) return mapDiv[1];
  const gStrap = rawHtml.match(/var\s+g_strap\s*=\s*"(\d{18})"/);
  if (gStrap) return gStrap[1];
  return null;
}

/**
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @param {string} rawHtml - Raw capture HTML.
 * @returns {string} STRAP or `unknown_id`.
 */
function extractStrap($, rawHtml) {
  const fromHtml = extractStrapFromRawHtml(rawHtml);
  if (fromHtml) return fromHtml;
  const scriptsText = $("script")
    .map((_, el) => $(el).html() || "")
    .get()
    .join("\n");
  const match = scriptsText.match(/var\s+g_strap\s*=\s*"(\d+)"/);
  if (match) return match[1];
  const parcelNo = $("#pacel_no").text().trim();
  // Display PARCELIDs contain dashes; stripping them yields the wrong 18-digit id.
  if (parcelNo && /^\d{18}$/.test(parcelNo)) return parcelNo;
  return "unknown_id";
}

/**
 * Read the value that follows a print-page `<span>Label</span>`.
 *
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @param {string} labelText - Exact span label, e.g. `Property Use`.
 * @returns {string | null} Trimmed value or null.
 */
function getLabeledValue($, labelText) {
  const span = $("span")
    .filter((_, el) => $(el).text().replace(/\s+/g, " ").trim() === labelText)
    .first();
  if (!span.length) return null;
  const cell = span.closest("td");
  const fromLink = cell.find("a").first().text().replace(/\s+/g, " ").trim();
  if (fromLink) return fromLink;
  const fromHeading = cell.find("h3").first().text().replace(/\s+/g, " ").trim();
  if (fromHeading) return fromHeading;
  const label = cell.find("label").first();
  if (label.length) {
    const html = String(label.html() || "");
    const text = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }
  return null;
}

/**
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @param {string} labelText - Exact span label.
 * @returns {string | null} Owner-style multiline text.
 */
function getLabeledMultiline($, labelText) {
  const span = $("span")
    .filter((_, el) => $(el).text().replace(/\s+/g, " ").trim() === labelText)
    .first();
  if (!span.length) return null;
  const label = span.closest("td").find("label").first();
  if (!label.length) return null;
  const html = String(label.html() || "");
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .trim();
  return text || null;
}

/**
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @param {readonly string[]} selectors - Row selectors in priority order.
 * @returns {cheerio.Cheerio} First non-empty data-row collection.
 */
function firstDataRows($, selectors) {
  for (const selector of selectors) {
    const rows = $(selector).filter(
      (_, el) => $(el).children("td").length > 0 && $(el).children("th").length === 0,
    );
    if (rows.length > 0) return rows;
  }
  return $(".__pinellas_no_rows__");
}

/**
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @returns {cheerio.Cheerio} Building structure panels (details or print).
 */
function structurePanels($) {
  const details = $("div.panel-body[id^='structural_']");
  if (details.length > 0) return details;
  return $("table[id^='structure_']");
}

/**
 * @param {cheerio.CheerioAPI} $ - Cheerio API.
 * @param {cheerio.Cheerio} $panel - Building panel.
 * @param {string} label - Structural-element label.
 * @returns {string | null} Cell value.
 */
function structuralValue($, $panel, label) {
  const lowerLabel = label.toLowerCase();
  const bordered = $panel
    .find("table.table-bordered")
    .filter((_, tbl) => {
      const header = $(tbl).find("thead th").first().text().trim().toLowerCase();
      return header.includes("structural elements");
    })
    .first();
  if (bordered.length) {
    let found = null;
    bordered.find("tbody tr").each((_, tr) => {
      if (found) return;
      const key = $(tr).find("td").eq(0).text().trim().replace(/:$/, "");
      if (key.toLowerCase() === lowerLabel) {
        found = $(tr).find("td").eq(1).text().trim() || null;
      }
    });
    if (found) return found;
  }
  let printFound = null;
  $panel.find("tr").each((_, tr) => {
    if (printFound) return;
    const cells = $(tr).children("td");
    if (cells.length < 2) return;
    const key = cells.eq(0).text().trim().replace(/:$/, "");
    if (key.toLowerCase() === lowerLabel) {
      printFound = cells.eq(1).text().trim() || null;
    }
  });
  return printFound;
}

module.exports = {
  extractStrapFromRawHtml,
  extractStrap,
  getLabeledValue,
  getLabeledMultiline,
  firstDataRows,
  structurePanels,
  structuralValue,
};
