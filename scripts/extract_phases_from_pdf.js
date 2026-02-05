const fs = require('fs');

async function extractPhases() {
  const pdfPath = 'Z:\\Private\\aray\\Admin\\Proposals\\26\\26-01 Tier1 Nocatee.pdf';
  
  try {
    // Use dynamic import for ES module
    const pdfParseModule = await import('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    await parser.load();
    const result = await parser.getText();
    
    // Combine all pages' text
    const text = result.pages.map(page => page.text).join('\n');
    
    // Find the Compensation section - look for it and capture everything until "TOTAL" or end of section
    const compensationIndex = text.indexOf('Compensation:');
    if (compensationIndex === -1) {
      console.error('Could not find Compensation section');
      return;
    }
    
    // Find the end of the compensation section (look for "TOTAL" or a new major section)
    let compensationText = text.substring(compensationIndex);
    
    // Look for common section endings
    const endPatterns = [
      /TOTAL[\s\S]*?Estimated Maximum/i,
      /The proposed work's expenses/i,
      /The following services are not included/i,
      /Additional Miscellaneous Services:/i
    ];
    
    let endIndex = compensationText.length;
    for (const pattern of endPatterns) {
      const match = compensationText.match(pattern);
      if (match && match.index !== undefined) {
        // Find the start of the line containing this pattern
        const lineStart = compensationText.lastIndexOf('\n', match.index);
        if (lineStart !== -1 && lineStart < endIndex) {
          endIndex = lineStart;
        }
      }
    }
    
    compensationText = compensationText.substring(0, endIndex);
    
    // Extract proposal number from filename
    const proposalNumber = '26-01';
    
    // Parse phases - looking for patterns like:
    // Phase Code: Name - Amount (Lump Sum or Hourly Rates)
    // or similar patterns
    
    const phases = [];
    
    // Try to match phase patterns
    // Common patterns:
    // - "A1: Phase Name - $1,500 (Lump Sum)"
    // - "A1 Phase Name $1,500 Lump Sum"
    // - "A1 - Phase Name: $1,500 (L)"
    
    // Split by lines and look for phase entries
    const lines = compensationText.split('\n').filter(line => line.trim());
    
    // Pattern to match: Code Tab/Spaces Name Tab/Spaces $Amount BillingType
    // Example: C1 	Master Development Plan 	$5,000 Lump Sum
    // Example: CA 	Final Certifications & Construction Observation $13,000 Hourly Rates
    // Match lines that start with a phase code (C1, C2, CA, etc.) followed by name, amount, and billing type
    const phasePattern = /^([A-Z]+\d*)[\s\t]+(.+?)[\s\t]+\$?([\d,]+\.?\d*)[\s\t]+(Lump\s+Sum|Hourly\s+Rates)$/i;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip TOTAL line
      if (line.includes('TOTAL')) continue;
      
      const match = line.match(phasePattern);
      
      if (match) {
        const code = match[1].trim();
        const name = match[2].trim();
        const amount = parseFloat(match[3].replace(/,/g, ''));
        const billingTypeRaw = (match[4] || '').toUpperCase();
        const billingType = billingTypeRaw.includes('LUMP') ? 'L' : 'H';
        
        phases.push({
          code,
          name,
          amount,
          billing_type: billingType
        });
      }
    }
    
    // If still no phases found, try a more flexible pattern that handles variations
    if (phases.length === 0) {
      // More flexible: code, then name (until $), then amount, then billing type
      const flexiblePattern = /^([A-Z]+\d*)[\s\t]+(.+?)\s+\$?([\d,]+\.?\d*)\s+(Lump\s+Sum|Hourly\s+Rates)$/i;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('TOTAL')) continue;
        
        const match = line.match(flexiblePattern);
        
        if (match) {
          const code = match[1].trim();
          const name = match[2].trim();
          const amount = parseFloat(match[3].replace(/,/g, ''));
          const billingTypeRaw = (match[4] || '').toUpperCase();
          const billingType = billingTypeRaw.includes('LUMP') ? 'L' : 'H';
          
          phases.push({
            code,
            name,
            amount,
            billing_type: billingType
          });
        }
      }
    }
    
    const output = {
      proposal_number: proposalNumber,
      phases: phases
    };
    
    console.log(JSON.stringify(output, null, 2));
    
  } catch (error) {
    console.error('Error reading PDF:', error);
  }
}

extractPhases();
