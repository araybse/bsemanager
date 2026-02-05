const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const proposalsDir = 'Z:\\Private\\aray\\Admin\\Proposals\\24';

async function readPDFText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array, {});
    const text = await parser.getText();
    return text;
  } catch (err) {
    // Silently skip errors - we'll just return empty array for this proposal
    return null;
  }
}

function extractPhases(text) {
  const phases = [];
  
  // Find the Compensation section
  const compMatch = text.match(/Compensation:?\s*([\s\S]*?)(?:The proposed work|Additional Miscellaneous|Terms and Conditions|TOTAL|Total)/i);
  if (!compMatch) {
    return phases;
  }
  
  const section = compMatch[1];
  const lines = section.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Pattern 1: "Phase A1   Preliminary Site Plan   $3,000 Lump Sum"
    // Pattern 2: "A1   Engineering Plan Preparation   $5,000 Lump Sum"
    // Pattern 3: "Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates"
    // Also handle tabs: "Phase A1 \tPreliminary Site Planning \t$2,000 Lump Sum"
    // Use [\s\t]+ to match spaces or tabs
    const match = trimmed.match(/^(?:Phase\s+)?([A-Z]+\d*|[A-Z]+)[\s\t]+(.+?)[\s\t]+\$([0-9,]+)[\s\t]+(Lump Sum|Hourly Rates?)/i);
    
    if (match) {
      const code = match[1].toUpperCase();
      const name = match[2].trim();
      const amount = parseFloat(match[3].replace(/,/g, ''));
      const billingType = match[4].toLowerCase().includes('hourly') ? 'H' : 'L';
      
      // Skip if phase name looks like TOTAL or is too short
      if (name.length > 2 && !name.match(/^TOTAL$/i)) {
        phases.push({
          code: code,
          name: name,
          amount: amount,
          billing_type: billingType
        });
      }
    }
  }
  
  return phases;
}

async function findPDFForProposal(proposalNumber) {
  if (!fs.existsSync(proposalsDir)) {
    return null;
  }
  
  const files = fs.readdirSync(proposalsDir);
  
  // Look for the proposal PDF (prefer non-signed version first)
  const exactMatch = files.find(f => 
    f.startsWith(proposalNumber) && 
    f.endsWith('.pdf') && 
    !f.includes('_Signed') &&
    !f.includes('Work Agreement') &&
    !f.includes('Master')
  );
  
  if (exactMatch) {
    return path.join(proposalsDir, exactMatch);
  }
  
  // Try signed version
  const signedMatch = files.find(f => 
    f.startsWith(proposalNumber) && 
    f.endsWith('.pdf') &&
    !f.includes('Work Agreement') &&
    !f.includes('Master')
  );
  
  return signedMatch ? path.join(proposalsDir, signedMatch) : null;
}

async function main() {
  const results = [];
  
  // Process proposals 24-01 through 24-35
  for (let i = 1; i <= 35; i++) {
    const proposalNumber = `24-${String(i).padStart(2, '0')}`;
    const pdfPath = await findPDFForProposal(proposalNumber);
    
    if (!pdfPath) {
      // Skip if PDF not found
      continue;
    }
    
    const text = await readPDFText(pdfPath);
    if (!text) {
      continue;
    }
    
    const phases = extractPhases(text);
    
    if (phases.length > 0) {
      results.push({
        proposal_number: proposalNumber,
        phases: phases
      });
    }
  }
  
  // Output ONLY the JSON array
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
