const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function collectValuesByKeyPattern(obj, regex, results = []) {
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) collectValuesByKeyPattern(item, regex, results);
    } else {
      for (const [k, v] of Object.entries(obj)) {
        if (regex.test(k)) {
          results.push(v);
        }
        collectValuesByKeyPattern(v, regex, results);
      }
    }
  }
  return results;
}

function flattenToStrings(values) {
  const out = [];
  const stack = Array.isArray(values) ? [...values] : [values];
  while (stack.length) {
    const v = stack.pop();
    if (v == null) continue;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) stack.push(...v);
    else if (typeof v === "object") {
      if (typeof v.name === "string") out.push(v.name);
      for (const val of Object.values(v)) {
        if (typeof val === "string") out.push(val);
        else if (Array.isArray(val) || (val && typeof val === "object"))
          stack.push(val);
      }
    }
  }
  return out;
}

const COMPANY_RE =
  /\b(inc\.?|incorporated|llc\.?|l\.l\.c\.?|ltd\.?|limited|corp\.?|corporation|co\.?\b|company|companies|trust\b|trustee|trusts|tr\b|foundation|foundations|fdn\.?|alliance|solutions|services|svc\.?|svcs\.?|assn\.?|association|associations|partners\b|partnership|ptnrs\.?|holdings\b|hldgs\.?|group\b|groups|grp\.?|bank\b|banking|bnk\.?|church\b|churches|ministries\b|ministry|min\.?|management\b|mgmt\.?|properties\b|property|prop\.?|props\.?|enterprises?|enterprise|ent\.?|investments?|investment|inv\.?|invs\.?|advisors?|advisor|adv\.?|consultants?|consultant|cons\.?|contractors?|contractor|contr\.?|developers?|developer|dev\.?|devs\.?|builders?|builder|bldr\.?|realty|real\s+estate|estates?|estate|est\.?|ventures?|venture|vent\.?|systems?|system|sys\.?|technologies|technology|tech\.?|networks?|network|net\.?|communications?|communication|comm\.?|comms\.?|industries|industry|ind\.?|inds\.?|manufacturing|mfg\.?|operations|ops\.?|capital|capitals|cap\.?|caps\.?|financial|finance|fin\.?|insurance|ins\.?|legal|law|medical|healthcare|health|care|retail|rtl\.?|wholesale|whsl\.?|trading|trdg\.?|imports?|exports?|logistics|transport|shipping|shpg\.?|construction|const\.?|constr\.?|engineering|eng\.?|engr\.?|architects?|architecture|arch\.?|design|dsgn\.?|marketing|mktg\.?|advertising|adv\.?|advt\.?|media|publishing|pub\.?|entertainment|ent\.?|hospitality|hosp\.?|restaurants?|restaurant|rest\.?|hotels?|hotel|resorts?|resort|clubs?|club|organizations?|organization|orgs?|org\.?|nonprofits?|nonprofit|npo\.?|charities|charity|schools?|school|sch\.?|universities|university|univ\.?|colleges?|college|coll\.?|institutes?|institute|inst\.?|academies|academy|acad\.?|centers?|center|ctr\.?|ctrs\.?|facilities|facility|fac\.?|clinics?|clinic|hospitals?|hospital|hosp\.?|laboratories|laboratory|labs?|lab\.?)\b/i;

const PREFIX_MAPPING = {
  "mr": "Mr.", "mr.": "Mr.", "mrs": "Mrs.", "mrs.": "Mrs.", "ms": "Ms.", "ms.": "Ms.",
  "miss": "Miss", "mx": "Mx.", "mx.": "Mx.", "dr": "Dr.", "dr.": "Dr.",
  "prof": "Prof.", "prof.": "Prof.", "rev": "Rev.", "rev.": "Rev.",
  "fr": "Fr.", "fr.": "Fr.", "sr": "Sr.", "sr.": "Sr.", "br": "Br.", "br.": "Br.",
  "capt": "Capt.", "capt.": "Capt.", "col": "Col.", "col.": "Col.",
  "maj": "Maj.", "maj.": "Maj.", "lt": "Lt.", "lt.": "Lt.",
  "sgt": "Sgt.", "sgt.": "Sgt.", "hon": "Hon.", "hon.": "Hon.",
  "judge": "Judge", "rabbi": "Rabbi", "imam": "Imam", "sheikh": "Sheikh",
  "sir": "Sir", "dame": "Dame"
};

const SUFFIX_MAPPING = {
  "jr": "Jr.", "jr.": "Jr.", "sr": "Sr.", "sr.": "Sr.",
  "ii": "II", "iii": "III", "iv": "IV", "phd": "PhD", "md": "MD",
  "esq": "Esq.", "esq.": "Esq.", "jd": "JD", "llm": "LLM", "mba": "MBA",
  "rn": "RN", "dds": "DDS", "dvm": "DVM", "cfa": "CFA", "cpa": "CPA",
  "pe": "PE", "pmp": "PMP", "emeritus": "Emeritus", "ret": "Ret.", "ret.": "Ret."
};

const SUFFIX_RE =
  /^(jr\.?|sr\.?|ii|iii|iv|v|vi|phd|md|esq\.?|jd|llm|mba|rn|dds|dvm|cfa|cpa|pe|pmp|emeritus|ret\.?)$/i;

function cleanName(raw) {
  let s = (raw || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\t]+/g, " ")
    .trim();
  s = s.replace(/^[;:,]+|[;:,]+$/g, "").trim();
  return s;
}

function splitCandidates(rawStr) {
  // Split first, then clean each part
  let parts = (rawStr || "")
    .split(/[;\n\r\|]+/)
    .map((t) => cleanName(t))
    .filter(Boolean);
  return parts.length > 1 ? parts : rawStr ? [cleanName(rawStr)] : [];
}

function isAllCaps(str) {
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const caps = letters.replace(/[^A-Z]/g, "").length;
  return caps / letters.length > 0.9;
}

function parsePerson(name, pin) {
  let s = cleanName(name);
  s = s.replace(/&/g, " ").replace(/\s+/g, " ").trim();

  let tokens = s.split(" ").filter(Boolean);
  let prefix_name = null;
  let suffix_name = null;

  if (tokens.length > 0 && PREFIX_MAPPING[tokens[0].toLowerCase()]) {
    prefix_name = PREFIX_MAPPING[tokens[0].toLowerCase()];
    tokens.shift();
  }

  while (tokens.length && SUFFIX_RE.test(tokens[tokens.length - 1])) {
    const suffixToken = tokens.pop().toLowerCase();
    suffix_name = SUFFIX_MAPPING[suffixToken] || null;
  }

  if (tokens.length < 2) return null;

  let first = "", middle = "", last = "";

  if (s.includes(",")) {
    const [left, right] = s.split(",", 2).map((t) => t.trim());
    const rightTokens = right.split(" ").filter(Boolean);
    last = left;
    first = rightTokens.shift() || "";
    middle = rightTokens.join(" ");
  } else if (isAllCaps(s)) {
    last = tokens[0] || "";
    first = tokens[1] || "";
    middle = tokens.slice(2).join(" ");
  } else {
    first = tokens[0] || "";
    last = tokens[tokens.length - 1] || "";
    middle = tokens.slice(1, -1).join(" ");
  }

  if (!first.trim() || !last.trim()) return null;

  return {
    type: "person",
    source_http_request: {
      method: "GET",
      url: "https://gis.hcpafl.org/propertysearch/"
    },
    request_identifier: pin || null,
    birth_date: null,
    first_name: toTitleCase(first.trim()),
    last_name: toTitleCase(last.trim()),
    middle_name: middle.trim() ? toTitleCase(middle.trim()) : null,
    prefix_name,
    suffix_name,
    us_citizenship_status: null,
    veteran_status: null
  };
}

function classifyOwner(raw, pin) {
  const s = cleanName(raw);
  if (!s) return { invalid: { raw, reason: "empty_string" } };

  if (COMPANY_RE.test(s)) {
    return { owner: { type: "company", name: s.trim() } };
  }

  if (s.includes("&")) {
    const parts = s
      .split("&")
      .map((p) => p.trim())
      .filter(Boolean);
    const owners = [];
    const invalids = [];
    for (const p of parts) {
      const person = parsePerson(p, pin);
      if (person) owners.push(person);
      else
        invalids.push({ raw: p, reason: "unparseable_person_with_ampersand" });
    }
    if (owners.length) return { owners, invalids };
    return { invalid: { raw: s, reason: "unparseable_ampersand_name" } };
  }

  const person = parsePerson(s, pin);
  if (person) return { owner: person };

  return { invalid: { raw: s, reason: "unclassified_name" } };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let key = "";
    if (o.type === "company")
      key = `c:${o.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
    else {
      const middle = o.middle_name ? ` ${o.middle_name.toLowerCase()}` : "";
      key =
        `p:${(o.first_name || "").toLowerCase()}${middle} ${(o.last_name || "").toLowerCase()}`
          .replace(/\s+/g, " ")
          .trim();
    }
    if (!seen.has(key) && key) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

function main() {
  const html = fs.readFileSync("input.html", "utf8");
  const htmlWithNewlines = html.replace(/<br\s*\/?>/gi, '\n');
  const $ = cheerio.load(htmlWithNewlines);
  
  const ownerName = $("h4[data-bind*='publicOwner']").html() || 
                   $("[data-bind*='publicOwner']").html() || "";
  const cleanedOwnerName = ownerName.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();
  
  const pin = $("td[data-bind*='displayStrap']").text().trim();
  
  const dataObj = { owner: cleanedOwnerName, pin: pin };
  const text = cleanedOwnerName;

  const ownerValues = collectValuesByKeyPattern(dataObj, /owner/i);
  const ownerStrings = flattenToStrings(ownerValues)
    .map(cleanName)
    .filter(Boolean);

  if (ownerStrings.length === 0) {
    const labelMatches = [];
    const ownerLabelRe = /(owner[^:]*):?\s*([^\n\r]+)/gi;
    let m;
    while ((m = ownerLabelRe.exec(text)) !== null) {
      labelMatches.push(m[2].trim());
    }
    ownerStrings.push(...labelMatches);
  }

  let candidates = [];
  
  // First try splitting the raw cleaned owner name directly (preserves newlines)
  if (cleanedOwnerName) {
    const directParts = splitCandidates(cleanedOwnerName);
    if (directParts.length > 1) {
      // If we successfully split into multiple parts, use those
      candidates.push(...directParts);
    } else {
      // Otherwise, fall back to the original logic
      for (const s of ownerStrings) {
        const parts = splitCandidates(s);
        for (const p of parts) {
          if (p) candidates.push(p);
        }
      }
    }
  } else {
    // Fallback to original logic if no cleanedOwnerName
    for (const s of ownerStrings) {
      const parts = splitCandidates(s);
      for (const p of parts) {
        if (p) candidates.push(p);
      }
    }
  }

  const validOwners = [];
  const invalidOwners = [];
  for (const c of candidates) {
    const res = classifyOwner(c, pin);
    if (res.owner) validOwners.push(res.owner);
    else if (res.owners) validOwners.push(...res.owners);
    if (res.invalid) invalidOwners.push(res.invalid);
    if (res.invalids) invalidOwners.push(...res.invalids);
  }

  const deduped = dedupeOwners(validOwners);
  const propertyIdSafe = pin || "unknown_id";
  const ownersByDate = { current: deduped };

  const output = {
    [`property_${propertyIdSafe}`]: {
      owners_by_date: ownersByDate,
      invalid_owners: invalidOwners,
    },
  };

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "owner_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify(output));
}

main();
