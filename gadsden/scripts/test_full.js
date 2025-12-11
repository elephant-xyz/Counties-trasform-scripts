const COMPANY_KEYWORDS =
  /(\b|\s)(inc\.?|l\.l\.c\.|llc|ltd\.?|foundation|alliance|solutions|corp\.?|co\.?|services|trust\b|trustee\b|trustees\b|tr\b|associates|partners|partnership|investment|investments|lp\b|llp\b|bank\b|n\.a\.|na\b|pllc\b|company|enterprises|properties|holdings|estate)(\b|\s)/i;
const SUFFIXES_IGNORE =
  /^(jr|sr|ii|iii|iv|v|vi|vii|viii|ix|x|md|phd|esq|esquire)$/i;

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function isCompanyName(txt) {
  if (!txt) return false;
  return COMPANY_KEYWORDS.test(txt);
}

function titleCase(str) {
  if (!str) return str;
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function tokenizeNamePart(part) {
  return cleanText(part)
    .replace(/^\*+/, "")
    .replace(/[^A-Za-z&'\-\s\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function buildPersonFromTokens(tokens, fallbackLastName) {
  if (!tokens || !tokens.length) return null;
  if (tokens.length === 1) return null;

  const stripTrailingPeriod = (str) => {
    if (!str) return str;
    return str.replace(/\.$/, '');
  };

  const suffixMap = {
    'jr': 'Jr.',
    'sr': 'Sr.',
    'ii': 'II',
    'iii': 'III',
    'iv': 'IV',
  };

  let suffix = null;
  let workingTokens = [...tokens];

  if (workingTokens.length > 2) {
    const lastToken = workingTokens[workingTokens.length - 1];
    const stripped = stripTrailingPeriod(lastToken).toLowerCase();
    if (suffixMap[stripped]) {
      suffix = suffixMap[stripped];
      workingTokens.pop();
    }
  }

  if (workingTokens.length < 2) return null;

  const firstTokenLen = workingTokens[0].length;
  const lastTokenLen = workingTokens[workingTokens.length - 1].length;
  const firstTokenShort = firstTokenLen <= 2;
  const lastTokenLongest = lastTokenLen >= firstTokenLen;
  const useFirstMiddleLast = firstTokenShort || lastTokenLongest;

  let last, first, middle;

  if (useFirstMiddleLast) {
    first = workingTokens[0];
    if (workingTokens.length === 2) {
      last = workingTokens[1];
      middle = null;
    } else {
      last = workingTokens[workingTokens.length - 1];
      middle = workingTokens.slice(1, -1).join(" ") || null;
    }
  } else {
    last = workingTokens[0];
    first = workingTokens[1] || null;
    middle = workingTokens.length > 2 ? workingTokens.slice(2).join(" ") : null;
  }

  if (
    fallbackLastName &&
    workingTokens.length <= 2 &&
    workingTokens[0] &&
    workingTokens[0] === workingTokens[0].toUpperCase() &&
    workingTokens[1]
  ) {
    first = workingTokens[0];
    middle = workingTokens[1] || null;
    last = fallbackLastName;
  }

  first = stripTrailingPeriod(first);
  last = stripTrailingPeriod(last);
  middle = middle ? stripTrailingPeriod(middle) : null;

  const titleCasedFirst = titleCase(first || "");
  const titleCasedLast = titleCase(last || "");
  const titleCasedMiddleRaw = middle ? titleCase(middle) : null;

  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  const isValidName = (name) => name && /[a-zA-Z]/.test(name) && namePattern.test(name);

  if (!isValidName(titleCasedFirst) || !isValidName(titleCasedLast)) {
    return null;
  }

  const titleCasedMiddle = titleCasedMiddleRaw && isValidName(titleCasedMiddleRaw) ? titleCasedMiddleRaw : null;

  return {
    type: "person",
    first_name: titleCasedFirst,
    last_name: titleCasedLast,
    middle_name: titleCasedMiddle,
    suffix_name: suffix,
  };
}

function parseOwnersFromText(rawText) {
  const invalids = [];
  const owners = [];
  if (!rawText) return { owners, invalids };
  let text = cleanText(rawText)
    .replace(/^\*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const commaSegments = text.split(/\s*,\s*/).filter(Boolean);
  let lastSurname = null;

  const pushOwnerOrInvalid = (segment) => {
    const seg = cleanText(segment).replace(/^\*/, "").trim();
    if (!seg) return;

    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: titleCase(seg) });
      return;
    }

    const andParts = seg.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
    let localLastSurname = null;

    andParts.forEach((part, idx) => {
      const tokens = tokenizeNamePart(part);
      if (!tokens.length) return;

      const stripTrailingPeriod = (str) => {
        if (!str) return str;
        return str.replace(/\.$/, '');
      };
      const lastToken = tokens[tokens.length - 1];
      const lastTokenStripped = stripTrailingPeriod(lastToken).toLowerCase();
      const isLastTokenSuffix = SUFFIXES_IGNORE.test(lastTokenStripped);

      console.log('  Part:', part, '-> tokens:', tokens, '-> isLastTokenSuffix:', isLastTokenSuffix);

      let person = buildPersonFromTokens(
        tokens,
        idx > 0 ? localLastSurname || lastSurname : null,
      );

      console.log('  -> person:', JSON.stringify(person));

      if (person) {
        owners.push(person);
        if (person.last_name) {
          lastSurname = person.last_name.toUpperCase();
        }
      } else {
        invalids.push({
          raw: part,
          reason: "ambiguous_or_incomplete_person_name",
        });
      }
    });
  };

  commaSegments.forEach((seg) => pushOwnerOrInvalid(seg));

  return { owners, invalids };
}

// Test
const testNames = [
  "W C DAWKINS JR.",
  "MARY WELLS DAWKINS",
  "CAPITAL CITY BANK INC"
];

testNames.forEach(name => {
  console.log('\nTesting:', name);
  const result = parseOwnersFromText(name);
  console.log('Result:', JSON.stringify(result, null, 2));
});
