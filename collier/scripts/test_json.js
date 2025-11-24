const fs = require('fs');
const path = require('path');

const taxObj = {
  tax_year: 2025,
  property_assessed_value_amount: 1195036,
  property_market_value_amount: 1495039,
  property_building_amount: 683514,
  property_land_amount: 811525,
  property_taxable_value_amount: 1144314,
  property_exemption_amount: 50722,
  millage_rate: 9.6,
  monthly_tax_amount: 915.58,
  period_end_date: "2025-12-31",
  period_start_date: "2025-01-01",
  yearly_tax_amount: 10986.91
};

console.log('Object keys:', Object.keys(taxObj));
console.log('has property_exemption_amount:', 'property_exemption_amount' in taxObj);
console.log('value:', taxObj.property_exemption_amount);
console.log('\nJSON output:');
console.log(JSON.stringify(taxObj, null, 2));
