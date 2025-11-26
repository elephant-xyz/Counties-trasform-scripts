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

  const firstTokenShort = workingTokens[0].length <= 2;
  const secondTokenShort = workingTokens.length > 1 && workingTokens[1].length <= 2;
  const useFirstMiddleLast = firstTokenShort || (firstTokenShort && secondTokenShort);

  let last, first, middle;

  console.log('  useFirstMiddleLast:', useFirstMiddleLast, '(first len:', workingTokens[0].length, ')');

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

  first = stripTrailingPeriod(first);
  last = stripTrailingPeriod(last);
  middle = middle ? stripTrailingPeriod(middle) : null;

  const titleCasedFirst = titleCase(first || "");
  const titleCasedLast = titleCase(last || "");
  const titleCasedMiddleRaw = middle ? titleCase(middle) : null;

  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  const isValidName = (name) => name && /[a-zA-Z]/.test(name) && namePattern.test(name);

  console.log('  Names: first="' + titleCasedFirst + '", middle="' + titleCasedMiddleRaw + '", last="' + titleCasedLast + '"');
  console.log('  Valid: first=' + isValidName(titleCasedFirst) + ', last=' + isValidName(titleCasedLast));

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

const testNames = [
  "W C DAWKINS JR.",
  "W C DAWKINS JR",
  "MARY WELLS DAWKINS"
];

testNames.forEach(name => {
  console.log('\nTesting:', name);
  const tokens = tokenizeNamePart(name);
  console.log('Tokens:', tokens);
  const person = buildPersonFromTokens(tokens);
  console.log('Result:', JSON.stringify(person, null, 2));
});
