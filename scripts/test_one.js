const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const pdfPath = 'Z:\\Private\\aray\\Admin\\Proposals\\24\\24-01 Glen Kernan Estate Lots.pdf';

async function test() {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse();
    await parser.load(uint8Array);
    const text = await parser.getText();
    
    console.log('Text length:', text.length);
    console.log('\n=== Searching for Compensation ===');
    
    const compIdx = text.indexOf('Compensation');
    if (compIdx >= 0) {
      console.log('Found at index:', compIdx);
      const section = text.substring(compIdx, compIdx + 1000);
      console.log('\nSection:');
      console.log(section);
      
      // Try regex
      const compMatch = text.match(/Compensation:?\s*([\s\S]*?)(?:The proposed work|Additional Miscellaneous|Terms and Conditions|TOTAL|Total)/i);
      if (compMatch) {
        console.log('\n=== Regex matched ===');
        const sectionText = compMatch[1];
        console.log('Section length:', sectionText.length);
        console.log('\nFirst 500 chars:');
        console.log(sectionText.substring(0, 500));
        
        // Try to match phases
        const lines = sectionText.split('\n');
        console.log('\n=== Testing phase patterns ===');
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i].trim();
          if (!line) continue;
          console.log(`Line ${i}: "${line}"`);
          
          // Test both patterns
          const match1 = line.match(/^(?:Phase\s+)?([A-Z]+\d*|[A-Z]+)[\s\t]+(.+?)[\s\t]+\$([0-9,]+)[\s\t]+(Lump Sum|Hourly Rates?)/i);
          const match2 = line.match(/^(?:Phase\s+)?([A-Z]+\d*|[A-Z]+)\s+(.+?)\s+\$([0-9,]+)\s+(Lump Sum|Hourly Rates?)/i);
          
          if (match1) {
            console.log('  MATCHED with tabs/spaces pattern!');
            console.log('  Code:', match1[1]);
            console.log('  Name:', match1[2]);
            console.log('  Amount:', match1[3]);
            console.log('  Billing:', match1[4]);
          } else if (match2) {
            console.log('  MATCHED with spaces pattern!');
          }
        }
      } else {
        console.log('\nRegex did not match');
      }
    } else {
      console.log('"Compensation" not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

test();
