const XLSX = require('xlsx');

const filePath = 'Z:\\Private\\aray\\Admin\\Invoices\\Billing Console.xlsm';
const workbook = XLSX.readFile(filePath);

const sheet = workbook.Sheets['Active Contracts'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('=== Active Contracts Sheet Structure ===');
console.log('Headers:', data[0]);
console.log('\nFirst 20 rows:');
for (let i = 1; i < Math.min(21, data.length); i++) {
  const row = data[i];
  if (row[0]) {
    console.log(`${row[0]} | ${row[1]} | Phase: ${row[2]} | Name: ${row[3]} | Type: ${row[4]} | Fee: ${row[5]}`);
  }
}

console.log('\nTotal rows:', data.length);
