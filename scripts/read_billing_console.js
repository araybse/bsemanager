const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
console.log('Reading file:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('\n=== Sheet Names ===');
  console.log(workbook.SheetNames);
  
  // For each sheet, show the first few rows
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n=== Sheet: ${sheetName} ===`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Show first 5 rows
    console.log('First 5 rows:');
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`Row ${i}:`, JSON.stringify(data[i]));
    }
    console.log(`Total rows: ${data.length}`);
  }
} catch (error) {
  console.error('Error reading file:', error.message);
}
