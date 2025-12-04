const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

const SUFFIXES_IGNORE = /^(jr|sr|ii|iii|iv|v|vi|vii|viii|ix|x|md|phd|esq|esquire)$/i;

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
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

  let last = workingTokens[0];
  let first = workingTokens[1] || null;
  let middle = workingTokens.length > 2 ? workingTokens.slice(2).join(" ") : null;

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

let salesTable = null;
$('section').each((_, section) => {
  if (salesTable) return;
  const title = $(section).find('div.title').first().text().trim().toLowerCase();
  if (title === 'sales') {
    const candidate = $(section).find('table').first();
    if (candidate && candidate.length) {
      salesTable = candidate;
    }
  }
});

if (salesTable && salesTable.length) {
  const rows = salesTable.find('tbody tr');
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find('td');
    if (tds && tds.length >= 9) {
      const grantee = cleanText($(tds.eq(8)).text());
      console.log('Row ' + i + ': grantee="' + grantee + '"');

      const tokens = tokenizeNamePart(grantee);
      console.log('  tokens:', tokens);

      const person = buildPersonFromTokens(tokens);
      console.log('  person:', JSON.stringify(person, null, 2));
      console.log('');
    }
  });
}
