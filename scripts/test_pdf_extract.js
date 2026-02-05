const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'Z:\\Private\\aray\\Admin\\Proposals\\24\\24-01 Glen Kernan Estate Lots.pdf';

async function test() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse(dataBuffer);
    const text = await parser.getText();
    
    console.log('=== Full text length:', text.length);
    console.log('=== First 2000 chars:');
    console.log(text.substring(0, 2000));
    console.log('\n=== Looking for Compensation section:');
    
    const compMatch = text.match(/Compensation:?\s*([\s\S]*?)(?:The proposed work|Additional Miscellaneous|Terms and Conditions|TOTAL|Total)/i);
    if (compMatch) {
      console.log('Found Compensation section!');
      console.log('Section length:', compMatch[1].length);
      console.log('Section content:');
      console.log(compMatch[1].substring(0, 1000));
    } else {
      console.log('Compensation section NOT found');
      // Try to find it with a simpler pattern
      const simpleMatch = text.match(/Compensation/i);
      if (simpleMatch) {
        const idx = text.indexOf('Compensation');
        console.log('Found "Compensation" at index:', idx);
        console.log('Context around it:');
        console.log(text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 500)));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
