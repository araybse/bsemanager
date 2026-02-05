const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const proposalsDir = 'Z:\\Private\\aray\\Admin\\Proposals\\23';

// Extract phase data from text
function extractPhases(text) {
  const phases = [];
  
  // Find the Compensation section - stop at "Terms and Conditions" or end
  const compensationMatch = text.match(/Compensation:[\s\S]*?(?=Terms and Conditions|$)/i);
  if (!compensationMatch) {
    return phases;
  }
  
  const compensationText = compensationMatch[0];
  
  // Pattern to match phase lines:
  // - "Phase A1   Preliminary Site Plan   $3,000 Lump Sum"
  // - "A1   Engineering Plan Preparation   $5,000 Lump Sum"
  // - "Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates"
  
  // Split by lines and process each
  const lines = compensationText.split('\n');
  
  for (const line of lines) {
    // Match patterns like:
    // - Phase A1 	Preliminary Site Planning and Meetings 	$2,000 Lump Sum
    // - A1   Engineering Plan Preparation   $5,000 Lump Sum
    // - Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates
    
    // Try to match phase code (A1, CA, A1.1, etc.) - can be letters, numbers, and dots
    // Handle both tabs and spaces as separators
    // Pattern: (optional "Phase ") CODE (tabs/spaces) Name (tabs/spaces) $amount (tabs/spaces) Lump Sum/Hourly Rates
    const phasePattern = /(?:Phase\s+)?([A-Z0-9.]+)[\t\s]+(.+?)[\t\s]+\$([\d,]+)[\t\s]+(Lump\s+Sum|Hourly\s+Rates?)/i;
    const match = line.match(phasePattern);
    
    if (match) {
      const code = match[1].trim();
      const name = match[2].trim();
      const amount = parseInt(match[3].replace(/,/g, ''), 10);
      const billingType = match[4].toLowerCase().includes('lump') ? 'L' : 'H';
      
      phases.push({
        code,
        name,
        amount,
        billing_type: billingType
      });
    }
  }
  
  return phases;
}

async function extractProposalPhases(proposalNumber) {
  // Find the actual PDF file (might have additional text in filename)
  let actualPath = null;
  try {
    const files = fs.readdirSync(proposalsDir);
    const matchingFile = files.find(f => 
      f.startsWith(`${proposalNumber}.pdf`) || 
      (f.startsWith(`${proposalNumber} `) && f.endsWith('.pdf'))
    );
    
    if (matchingFile) {
      actualPath = path.join(proposalsDir, matchingFile);
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
  
  try {
    const dataBuffer = fs.readFileSync(actualPath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    const text = data.text;
    
    const phases = extractPhases(text);
    
    if (phases.length > 0) {
      return {
        proposal_number: proposalNumber,
        phases: phases
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  const results = [];
  
  // Process proposals 23-10 through 23-30
  for (let i = 10; i <= 30; i++) {
    const proposalNumber = `23-${i.toString().padStart(2, '0')}`;
    
    const result = await extractProposalPhases(proposalNumber);
    if (result && result.phases.length > 0) {
      results.push(result);
    }
  }
  
  // Output only JSON
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
