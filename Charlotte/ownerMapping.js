const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

function cleanText(t) {
  return (t || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPropertyId($) {
  let id = null;
  $("h1, h2, title").each((i, el) => {
    const txt = $(el).text();
    const m = txt.match(/\b(\d{8,})\b/);
    if (m && !id) id = m[1];
  });
  if (!id) {
    $("a[href], input[onclick], button[onclick]").each((i, el) => {
      const attrs =
        ($(el).attr("href") || "") + " " + ($(el).attr("onclick") || "");
      const m = attrs.match(
        /(?:defAccount|acct|navLink\()=?(?:'|\"|)(\d{8,})/i,
      );
      if (m && !id) id = m[1];
      const q = attrs.match(/(?:defAccount|acct)=([0-9]{8,})/i);
      if (q && !id) id = q[1];
      const p = attrs.match(/navLink\('(\d{8,})'\)/i);
      if (p && !id) id = p[1];
    });
  }
  if (!id) {
    const bodyTxt = $("body").text();
    const m = bodyTxt.match(/\b(\d{8,})\b/);
    if (m) id = m[1];
  }
  return id || "unknown_id";
}

function extractOwnerCandidates($) {
  const candidates = [];
  const root = $("section.maincontent");

  // Owner block immediately after Owner heading
  root.find("h1,h2,h3,h4,h5,h6").each((i, el) => {
    const txt = cleanText($(el).text());
    if (/^owner:?$/i.test(txt) || /\bowner\b/i.test(txt)) {
      const block = $(el).nextAll("div").first();
      if (block && block.length) {
        const clone = block.clone();
        clone.find("br").replaceWith("\n");
        const text = clone.text();
        const lines = text.split(/\n+/).map(cleanText).filter(Boolean);
        if (lines.length) {
          candidates.push(lines[0]);
        }
      }
    }
  });

  // Deduplicate
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = c.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

function isCompany(raw) {
  const s = cleanText(raw);
  const re =
    /(\binc\.?\b|\bllc\b|\bl\.l\.c\.?\b|\bltd\.?\b|\bcorp\.?\b|\bcorporation\b|\bcompany\b|\bco\.?\b|\bservices?\b|\bsolutions?\b|\bfoundation\b|\btrust(?:ee)?\b|\bass(?:ociation|n)\b|\bpartners?\b|\bholdings?\b|\blp\b|\bllp\b|\bplc\b|\bp\.?c\.?\b|\bp\.?a\.?\b|\bbank\b|\bn\.?a\.?\b)/i;
  return re.test(s);
}

function toTitleCase(s) {
  return s.replace(/\S+/g, (w) => {
    if (w.length <= 3 && w === w.toUpperCase()) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

function stripDescriptors(raw) {
  let s = " " + raw + " ";
  s = s.replace(
    /\b(TRUSTEE|TTE|ET\s*AL|ETAL|DEC'D|DECEASED|C\/O|CARE OF|ESTATE OF|EST OF|TR\.)\b/gi,
    " ",
  );
  s = s.replace(/[.,]/g, " ");
  return cleanText(s);
}

function parsePerson(raw) {
  const original = cleanText(raw);
  const s = stripDescriptors(original);
  if (!s) return null;

  if (/,/.test(original)) {
    const parts = original.split(",").map(cleanText).filter(Boolean);
    if (parts.length >= 2) {
      const last = cleanText(parts[0]);
      const rest = parts.slice(1).join(" ");
      const tokens = rest.split(/\s+/).filter(Boolean);
      if (tokens.length >= 1) {
        const first = tokens[0];
        const middle = tokens.slice(1).join(" ") || null;
        return {
          type: "person",
          first_name: toTitleCase(first),
          last_name: toTitleCase(last),
          middle_name: middle ? toTitleCase(middle) : null,
        };
      }
    }
  }

  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const upperRatio =
    tokens.filter((t) => /[A-Z]/.test(t) && t === t.toUpperCase()).length /
    tokens.length;
  if (upperRatio >= 0.6) {
    const last = tokens[0];
    const first = tokens[1];
    const middle = tokens.slice(2).join(" ") || null;
    return {
      type: "person",
      first_name: toTitleCase(first),
      last_name: toTitleCase(last),
      middle_name: middle ? toTitleCase(middle) : null,
    };
  }

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(" ") || null;
  return {
    type: "person",
    first_name: toTitleCase(first),
    last_name: toTitleCase(last),
    middle_name: middle ? toTitleCase(middle) : null,
  };
}

function buildOwner(raw) {
  const cleaned = cleanText(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) return { valid: false, reason: "empty", raw };

  if (cleaned.includes("&")) {
    const parts = cleaned
      .split("&")
      .map((s) => cleanText(s))
      .filter(Boolean);
    const owners = [];
    const invalids = [];
    for (const seg of parts) {
      const person = parsePerson(seg);
      if (person) owners.push(person);
      else
        invalids.push({
          raw: seg,
          reason: "unparseable_person_with_ampersand",
        });
    }
    if (owners.length > 0)
      return { valid: true, multiple: owners, raw: cleaned, invalids };
    return { valid: false, reason: "ampersand_unparsed", raw: cleaned };
  }

  if (isCompany(cleaned)) {
    return {
      valid: true,
      single: { type: "company", name: toTitleCase(cleaned) },
      raw: cleaned,
    };
  }

  const person = parsePerson(cleaned);
  if (person) return { valid: true, single: person, raw: cleaned };

  return { valid: false, reason: "cannot_classify", raw: cleaned };
}

function ownerKey(o) {
  if (!o) return null;
  if (o.type === "company")
    return "company|" + (o.name || "").toLowerCase().trim();
  if (o.type === "person") {
    const f = (o.first_name || "").toLowerCase().trim();
    const m = (o.middle_name || "").toLowerCase().trim();
    const l = (o.last_name || "").toLowerCase().trim();
    return "person|" + f + "|" + m + "|" + l;
  }
  return null;
}

function extractHistoricalGroups($) {
  return [];
}

const propertyId = extractPropertyId($);
const rawCandidates = extractOwnerCandidates($);
const owners = [];
const invalid_owners = [];
const seenKeys = new Set();

for (const raw of rawCandidates) {
  const result = buildOwner(raw);
  if (result.valid) {
    if (result.multiple) {
      for (const o of result.multiple) {
        const key = ownerKey(o);
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          owners.push(o);
        }
      }
      if (result.invalids && result.invalids.length) {
        for (const inv of result.invalids)
          invalid_owners.push({ raw: inv.raw, reason: inv.reason });
      }
    } else if (result.single) {
      const key = ownerKey(result.single);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        owners.push(result.single);
      }
    }
  } else {
    invalid_owners.push({ raw: result.raw, reason: result.reason });
  }
}

if (owners.length === 0) {
  const nextDiv = $("section.maincontent")
    .find('h2:contains("Owner")')
    .nextAll("div")
    .first();
  if (nextDiv && nextDiv.length) {
    const clone = nextDiv.clone();
    clone.find("br").replaceWith("\n");
    const candidate = cleanText(clone.text().split(/\n+/)[0] || "");
    if (candidate) {
      const res = buildOwner(candidate);
      if (res.valid && res.single) owners.push(res.single);
      else invalid_owners.push({ raw: candidate, reason: "fallback_unparsed" });
    }
  }
}

const historyGroups = extractHistoricalGroups($);
const owners_by_date = {};

historyGroups
  .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  .forEach((g) => {
    owners_by_date[g.dateKey] = g.owners;
  });

owners_by_date["current"] = owners;

const out = {};
out[`property_${propertyId}`] = {
  owners_by_date,
  invalid_owners,
};

const outputPath = "owners/owner_data.json";
fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify(out, null, 2));
