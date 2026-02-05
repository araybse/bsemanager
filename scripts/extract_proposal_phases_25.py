import os
import re
import json
from pathlib import Path
import pdfplumber

def extract_phases_from_pdf(pdf_path):
    """Extract phase data from the Compensation section of a PDF."""
    phases = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Extract all text from the PDF
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            
            # Find the Compensation section
            compensation_match = re.search(r'Compensation:?\s*\n', full_text, re.IGNORECASE)
            if not compensation_match:
                return phases
            
            # Extract text after "Compensation:"
            compensation_text = full_text[compensation_match.end():]
            
            # Look for phase patterns:
            # - "Phase A1   Preliminary Site Plan   $3,000 Lump Sum"
            # - "C1   Preliminary Site Planning   $2,500 Lump Sum"
            # - "Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates"
            
            # Pattern to match phase lines
            # Matches: optional "Phase", phase code, phase name, dollar amount, billing type
            phase_pattern = r'(?:Phase\s+)?([A-Z0-9]+)\s+(.+?)\s+\$([\d,]+)\s+(Lump\s+Sum|Hourly\s+Rates)'
            
            matches = re.finditer(phase_pattern, compensation_text, re.IGNORECASE | re.MULTILINE)
            
            for match in matches:
                code = match.group(1).strip()
                name = match.group(2).strip()
                amount_str = match.group(3).replace(',', '')
                billing_type_str = match.group(4).strip()
                
                # Convert amount to integer
                try:
                    amount = int(amount_str)
                except ValueError:
                    continue
                
                # Determine billing type
                if 'lump' in billing_type_str.lower() or 'sum' in billing_type_str.lower():
                    billing_type = "L"
                elif 'hourly' in billing_type_str.lower() or 'rate' in billing_type_str.lower():
                    billing_type = "H"
                else:
                    continue
                
                phases.append({
                    "code": code,
                    "name": name,
                    "amount": amount,
                    "billing_type": billing_type
                })
    
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
    
    return phases

def main():
    proposals_dir = Path(r"Z:\Private\aray\Admin\Proposals\25")
    results = []
    
    # Process proposals 25-01 through 25-34
    for i in range(1, 35):
        proposal_num = f"25-{i:02d}"
        
        # Find PDF files matching this proposal number
        pdf_files = list(proposals_dir.glob(f"{proposal_num}*.pdf"))
        
        if not pdf_files:
            print(f"No PDF found for {proposal_num}", file=os.sys.stderr)
            continue
        
        # Prefer signed versions, then regular PDFs
        signed_pdf = next((f for f in pdf_files if "_Signed" in f.name or "Signed" in f.name), None)
        pdf_file = signed_pdf if signed_pdf else pdf_files[0]
        
        print(f"Processing {proposal_num}: {pdf_file.name}", file=os.sys.stderr)
        
        phases = extract_phases_from_pdf(pdf_file)
        
        if phases:
            results.append({
                "proposal_number": proposal_num,
                "phases": phases
            })
        else:
            print(f"  No phases found for {proposal_num}", file=os.sys.stderr)
    
    # Output JSON only (no error messages)
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
