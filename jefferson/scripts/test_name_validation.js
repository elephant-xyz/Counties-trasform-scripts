// Test the name validation pattern
const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

const testNames = [
  "John",
  "Jane",
  "O'Brien",
  "McDonald",
  "Mary-Anne",
  "Jean-Pierre",
  "JOHN",
  "john",
  "McDoNald",
  "John,",
  "De La Cruz",
];

testNames.forEach(name => {
  const trimmed = name.trim();
  const isValid = namePattern.test(trimmed);
  console.log(name + " -> " + (isValid ? "VALID" : "INVALID"));
});
