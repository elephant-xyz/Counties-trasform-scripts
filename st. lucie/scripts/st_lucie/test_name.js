const name = "Gandolfini (LF EST) Michael";
const cleaned = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
console.log("Original:", name);
console.log("After removing parens:", cleaned);
console.log("Tokens:", cleaned.split(/\s+/));
