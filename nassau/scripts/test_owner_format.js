// Test ownerMapping.js formatMiddleName
function formatMiddleName(str) {
  if (!str || str.trim() === "") return "";

  // Remove any characters that don't match the allowed pattern
  const cleaned = str.trim().replace(/[^a-zA-Z\s\-',.]/g, "");
  if (!cleaned || cleaned.length === 0) return "";

  // Remove leading special characters to ensure it starts with a letter
  const startsWithLetter = cleaned.replace(/^[\s\-',.]+/, "");
  if (!startsWithLetter || startsWithLetter.length === 0) return "";

  // Normalize spacing: collapse multiple spaces into one
  const normalizedSpacing = startsWithLetter.replace(/\s+/g, " ").trim();
  if (!normalizedSpacing) return "";

  // Title case each word: capitalize first letter of each word, lowercase the rest
  const result = normalizedSpacing
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Find the first letter in the word and capitalize it
      const firstLetterIndex = word.search(/[a-z]/);
      if (firstLetterIndex === -1) return ""; // No letters found, skip this word

      // Skip leading special characters and capitalize first letter
      const letterPart = word.substring(firstLetterIndex);
      return letterPart.charAt(0).toUpperCase() + letterPart.slice(1);
    })
    .filter(Boolean) // Remove empty strings
    .join(" ");

  // Validate against the middle name pattern ^[A-Z][a-zA-Z\s\-',.]*$
  if (!result || !/^[A-Z][a-zA-Z\s\-',.]*$/.test(result)) {
    return "";
  }

  return result;
}

const MIDDLE_NAME_PATTERN = /^[A-Z][a-zA-Z\s\-',.]*$/;

// Test cases
const testCases = ["E", "M", "e", "m", "GUARDIAN", "(GUARDIAN)", "DEL", "1E", "", " ", "e1", "e ", " e"];

console.log("Testing ownerMapping.js formatMiddleName:");
testCases.forEach(input => {
  const result = formatMiddleName(input);
  const isValid = result === "" ? "empty string" : (MIDDLE_NAME_PATTERN.test(result) ? "VALID" : "INVALID");
  console.log(`Input: "${input}" -> Output: "${result}" (${isValid})`);
});
