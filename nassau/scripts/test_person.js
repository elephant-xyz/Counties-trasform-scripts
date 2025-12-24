// Test formatMiddleName with various inputs
const MIDDLE_NAME_PATTERN = /^[A-Z][a-zA-Z\s\-',.]*$/;

function formatMiddleName(name) {
  if (!name || name.trim() === "") return null;

  // Remove any characters that don't match the pattern ^[A-Z][a-zA-Z\s\-',.]*$
  const cleaned = name.trim().replace(/[^a-zA-Z\s\-',.]/g, "");

  if (!cleaned || cleaned.length === 0) return null;

  // Remove leading special characters to ensure it starts with a letter
  const startsWithLetter = cleaned.replace(/^[\s\-',.]+/, "");

  if (!startsWithLetter || startsWithLetter.length === 0) return null;

  // Split by whitespace and capitalize first letter of each word
  const result = startsWithLetter
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";

      // Find first letter in the word
      let firstLetterIndex = 0;
      while (
        firstLetterIndex < word.length &&
        !/[a-zA-Z]/.test(word.charAt(firstLetterIndex))
      ) {
        firstLetterIndex++;
      }

      // Skip any leading special characters and capitalize first letter
      const letterPart = word.substring(firstLetterIndex);
      return letterPart.charAt(0).toUpperCase() + letterPart.slice(1);
    })
    .filter(Boolean) // Remove empty strings from array
    .join(" ");

  // Validate against the middle name pattern
  if (!MIDDLE_NAME_PATTERN.test(result)) {
    console.log(`Warning: formatMiddleName produced invalid result: "${result}" from input: "${name}"`);
    return null;
  }

  return result;
}

// Test cases
const testCases = ["E", "M", "e", "m", "GUARDIAN", "(GUARDIAN)", "DEL", "1E", "", " ", "e1"];

console.log("Testing formatMiddleName:");
testCases.forEach(input => {
  const result = formatMiddleName(input);
  const isValid = result === null ? "null" : (MIDDLE_NAME_PATTERN.test(result) ? "VALID" : "INVALID");
  console.log(`Input: "${input}" -> Output: "${result}" (${isValid})`);
});
