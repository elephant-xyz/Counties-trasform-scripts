const fs = require('fs');

// Test if the values are accessible at tax creation time
const hmstdExemptAmount = 25000;
const nonSchoolAddHmstdExemptAmount = 25722;

let totalExemption = null;
if (hmstdExemptAmount !== null || nonSchoolAddHmstdExemptAmount !== null) {
  totalExemption = (hmstdExemptAmount || 0) + (nonSchoolAddHmstdExemptAmount || 0);
}

console.log('hmstdExemptAmount:', hmstdExemptAmount);
console.log('nonSchoolAddHmstdExemptAmount:', nonSchoolAddHmstdExemptAmount);
console.log('totalExemption:', totalExemption);
console.log('condition:', totalExemption !== null && totalExemption > 0);
console.log('result:', totalExemption !== null && totalExemption > 0 ? totalExemption : null);
