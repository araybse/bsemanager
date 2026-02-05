import os
import re
import json
import sys
from pathlib import Path
import pdfplumber

# Suppress pdfplumber warnings
import warnings
warnings.filterwarnings('ignore')

def extract_phases_from_pdf(pdf_path):
    """Extract phase data from the Compensation section of a PDF."""
    phases = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Extract all text from the PDF
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            
            # Find the Compensation section - stop at "Terms and Conditions" or similar
            compensation_match = re.search(r'Compensation:?\s*\n', full_text, re.IGNORECASE)
            if not compensation_match:
                return phases
            
            # Extract text after "Compensation:" until "Terms and Conditions" or end
            compensation_start = compensation_match.end()
            compensation_text = full_text[compensation_start:]
            
            # Stop at "Terms and Conditions" or similar markers
            stop_match = re.search(r'(?:Terms and Conditions|TOTAL|Total|Additional Miscellaneous)', compensation_text, re.IGNORECASE)
            if stop_match:
                compensation_text = compensation_text[:stop_match.start()]
            
            # Pattern to match phase lines:
            # - "Phase A1   Preliminary Site Plan   $3,000 Lump Sum"
            # - "A1   Engineering Plan Preparation   $5,000 Lump Sum"
            # - "Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates"
            # - "Phase A1 Preliminary Site Planning & Analysis $5,000 Lump Sum"
            
            # Pattern matches: optional "Phase", phase code, phase name, dollar amount, billing type
            # Handle tabs and spaces as separators - use greedy match for name to capture everything up to $
            phase_pattern = r'(?:Phase\s+)?([A-Z0-9.]+)[\t\s]+(.+?)[\t\s]+\$([\d,]+)[\t\s]+(Lump\s+Sum|Hourly\s+Rates?)'
            
            # Also try a more flexible pattern that handles minimal whitespace
            phase_pattern_alt = r'(?:Phase\s+)?([A-Z0-9.]+)\s+(.+?)\s+\$([\d,]+)\s+(Lump\s+Sum|Hourly\s+Rates?)'
            
            matches = list(re.finditer(phase_pattern, compensation_text, re.IGNORECASE | re.MULTILINE))
            if not matches:
                matches = list(re.finditer(phase_pattern_alt, compensation_text, re.IGNORECASE | re.MULTILINE))
            
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
        # Silently skip errors - just return empty phases
        pass
    
    return phases

def main():
    proposals_dir = Path(r"Z:\Private\aray\Admin\Proposals\24")
    results = []
    
    # Process proposals 24-01 through 24-35
    for i in range(1, 36):
        proposal_num = f"24-{i:02d}"
        
        # Find PDF files matching this proposal number
        pdf_files = list(proposals_dir.glob(f"{proposal_num}*.pdf"))
        
        if not pdf_files:
            continue
        
        # Try signed versions first, then regular PDFs
        signed_pdfs = [f for f in pdf_files if "_Signed" in f.name or "Signed" in f.name]
        regular_pdfs = [f for f in pdf_files if f not in signed_pdfs]
        
        # Try signed PDFs first, then regular PDFs
        pdfs_to_try = signed_pdfs + regular_pdfs
        
        phases = []
        for pdf_file in pdfs_to_try:
            phases = extract_phases_from_pdf(pdf_file)
            if phases:
                break  # Use the first PDF that has phases
        
        if phases:
            results.append({
                "proposal_number": proposal_num,
                "phases": phases
            })
    
    # Output JSON only (no error messages)
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
