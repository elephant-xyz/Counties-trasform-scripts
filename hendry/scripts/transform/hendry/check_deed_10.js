const fs = require('fs');
const cheerio = require('cheerio');

const deedCodeMap = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  QCD: "Quitclaim Deed",
  QC: "Quitclaim Deed",
  QUITCLAIM: "Quitclaim Deed",
  "QUITCLAIM DEED": "Quitclaim Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TODD: "Transfer on Death Deed",
  SD: "Sheriff's Deed",
  "SHRF'S DEED": "Sheriff's Deed",
  TD: "Tax Deed",
  TRD: "Trustee's Deed",
  "TRUSTEE DEED": "Trustee's Deed",
  TR: "Trustee's Deed",
  TRUST: "Trustee's Deed",
  PRD: "Personal Representative Deed",
  "PERS REP DEED": "Personal Representative Deed",
  CD: "Correction Deed",
  "CORR DEED": "Correction Deed",
  DIL: "Deed in Lieu of Foreclosure",
  DILF: "Deed in Lieu of Foreclosure",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  "GIFT DEED": "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  "WILD D": "Wild Deed",
  SMD: "Special Master's Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  RD: "Receiver's Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ROC: "Release of Contract",
};

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const key = instr.trim().toUpperCase();
  return deedCodeMap[key] || null;
}

const html = fs.readFileSync('/tmp/runtime-workdir/input/1 29 42 32 050 0000-008.0.html', 'utf8');
const $ = cheerio.load(html);
const rows = $('#ctlBodyPane_ctl11_ctl01_grdSales tbody tr');

rows.each((i, tr) => {
  const idx = i + 1;
  const tds = $(tr).find('th, td');
  const instr = $(tds[2]).text().trim();
  const deedType = mapInstrumentToDeedType(instr);
  console.log(`Sale ${idx}: instrument="${instr}" -> deed_type="${deedType || '(not set)'}"`);

  if (idx === 10) {
    console.log(`\nSale 10 details:`);
    console.log(`  instrument raw: "${instr}"`);
    console.log(`  instrument uppercase: "${instr.trim().toUpperCase()}"`);
    console.log(`  deed_type from map: "${deedType || '(null)'}"`);
    console.log(`  Is in map? ${deedCodeMap.hasOwnProperty(instr.trim().toUpperCase())}`);
  }
});
