function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const testNames = ["MCDONALD", "O'BRIEN", "DE LA CRUZ", "JEAN-PIERRE", "JOHN"];

testNames.forEach(name => {
  const result = titleCaseName(name);
  console.log(name + " -> " + result);
});
