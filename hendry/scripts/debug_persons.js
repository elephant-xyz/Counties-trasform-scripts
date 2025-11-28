const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Copy relevant functions from data_extractor.js
const VALID_SUFFIXES = new Set([
  "JR", "SR", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "ESQ", "MD", "PHD", "DDS"
]);

function validateSuffix(suffix) {
  if (!suffix) return null;
  const cleaned = String(suffix).toUpperCase().replace(/[.,\s]/g, "");
  return VALID_SUFFIXES.has(cleaned) ? cleaned : null;
}

function normalizeWhitespace(str) {
  return str ? String(str).replace(/\s+/g, " ").trim() : "";
}

function buildPersonKey(first, middle, last, suffix) {
  const f = normalizeWhitespace(first || "").toLowerCase();
  const m = middle ? normalizeWhitespace(middle).toLowerCase() : "";
  const l = normalizeWhitespace(last || "").toLowerCase();
  const s = validateSuffix(suffix) || "";
  return `${f}|${m}|${l}|${s}`;
}

function cleanRawName(raw) {
  return normalizeWhitespace(raw || "");
}

function classifyOwner(raw) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty", raw: cleaned };
  }

  // Skip placeholders like **Multiple Buyers**
  if (/\*\*/.test(cleaned)) {
    return { valid: false, reason: "placeholder", raw: cleaned };
  }

  // Pattern 1: LAST FIRST MIDDLE SUFFIX
  let match = cleaned.match(
    /^([A-Z\-']+)\s+([A-Z][A-Z\-'\s]*?)\s+([A-Z])\s*(JR|SR|II|III|IV|V|ESQ|MD|PHD)?$/i,
  );
  if (match) {
    const [, last, first, middle, suffix] = match;
    if (!last || !first) {
      return { valid: false, reason: "person_missing_last_name", raw: cleaned };
    }
    const person = {
      type: "person",
      first_name: first.trim(),
      middle_name: middle ? middle.trim() : null,
      last_name: last.trim(),
      suffix_name: validateSuffix(suffix),
    };
    return { valid: true, owner: person };
  }

  // Pattern 2: LAST FIRST MIDDLE_INITIAL
  match = cleaned.match(/^([A-Z\-']+)\s+([A-Z][A-Z\-'\s]*?)\s+([A-Z])$/i);
  if (match) {
    const [, last, first, middle] = match;
    if (!last || !first) {
      return { valid: false, reason: "person_missing_last_name", raw: cleaned };
    }
    const person = {
      type: "person",
      first_name: first.trim(),
      middle_name: middle ? middle.trim() : null,
      last_name: last.trim(),
    };
    return { valid: true, owner: person };
  }

  // Pattern 3: LAST FIRST SUFFIX
  match = cleaned.match(
    /^([A-Z\-']+)\s+([A-Z][A-Z\-'\s]+?)\s+(JR|SR|II|III|IV|V|ESQ|MD|PHD)$/i,
  );
  if (match) {
    const [, last, first, suffix] = match;
    if (!last || !first) {
      return { valid: false, reason: "person_missing_last_name", raw: cleaned };
    }
    const person = {
      type: "person",
      first_name: first.trim(),
      last_name: last.trim(),
      suffix_name: validateSuffix(suffix),
    };
    return { valid: true, owner: person };
  }

  // Pattern 4: LAST FIRST
  match = cleaned.match(/^([A-Z\-']+)\s+([A-Z][A-Z\-'\s]+)$/i);
  if (match) {
    const [, last, first] = match;
    if (!last || !first) {
      return {
        reason: "person_missing_first_or_last",
        raw: cleaned,
        valid: false,
      };
    }
    const person = {
      type: "person",
      first_name: first.trim(),
      last_name: last.trim(),
    };
    return { valid: true, owner: person };
  }

  return { valid: false, reason: "no_match", raw: cleaned };
}

function splitCompositeNames(raw) {
  const cleaned = normalizeWhitespace(raw || "");
  if (!cleaned) return [];
  // Common patterns: "NAME1 & NAME2", "NAME1, NAME2", etc.
  const delimiters = /(?:\s+&\s+|\s*,\s*|\s+AND\s+)/i;
  const parts = cleaned.split(delimiters).filter((p) => p.trim());
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i].trim();
    if (!part) continue;
    // Remove trailing ownership indicators
    part = part.replace(/\s+(L\/E|TR|ET AL|ETAL|TRUSTEE)$/i, "");
    if (part) {
      out.push(part);
    }
  }
  return out;
}

function parseSaleParties(raw) {
  if (!raw) return [];
  if (/\*\*?\s*none\s*\*\*/i.test(raw)) return [];
  const parts = splitCompositeNames(raw);
  const parties = [];
  parts.forEach((part) => {
    const result = classifyOwner(part);
    if (result.valid) {
      parties.push(result.owner);
    } else {
      console.log(`  -> Not parsed as person: "${part}" (${result.reason})`);
      const fallback = cleanRawName(part);
      if (fallback && !/\*\*/.test(fallback)) {
        parties.push({ type: "company", name: fallback });
      }
    }
  });
  return parties;
}

// Load HTML
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== PARSING SALE PARTIES ===\n');

let saleIndex = 0;
$('table.tabletextadv tr').each((i, tr) => {
  const grantorSpan = $(tr).find('[id*=sprGrantor]');
  const granteeSpan = $(tr).find('[id*=sprGrantee]');
  if (grantorSpan.length > 0 || granteeSpan.length > 0) {
    saleIndex++;
    const grantorText = grantorSpan.text().trim();
    const granteeText = granteeSpan.text().trim();

    console.log(`Sale ${saleIndex}:`);
    console.log(`Grantor raw: "${grantorText}"`);
    if (grantorText) {
      const grantors = parseSaleParties(grantorText);
      console.log(`Grantor parsed:`, grantors);
    }

    console.log(`Grantee raw: "${granteeText}"`);
    if (granteeText) {
      const grantees = parseSaleParties(granteeText);
      console.log(`Grantee parsed:`, grantees);
    }
    console.log('');
  }
});

console.log('\n=== PARSING OWNER NAMES ===\n');
$('span[id*="sprOwnerName"]').each((i, span) => {
  const ownerText = $(span).text().trim();
  if (ownerText) {
    console.log(`Owner ${i + 1} raw: "${ownerText}"`);
    const owners = parseSaleParties(ownerText);
    console.log(`Owner ${i + 1} parsed:`, owners);
    console.log('');
  }
});
