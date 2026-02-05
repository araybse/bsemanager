import os
import re
import json
from pathlib import Path

try:
    import pypdf
except ImportError:
    try:
        import PyPDF2 as pypdf
    except ImportError:
        print("Error: Please install pypdf or PyPDF2: pip install pypdf")
        exit(1)

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            reader = pypdf.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return None

def extract_phases_from_text(text, proposal_number):
    """Extract phase data from PDF text."""
    phases = []
    
    # Find the Compensation section - look for a broader section
    # Find where Compensation starts
    comp_idx = text.find('Compensation:')
    if comp_idx == -1:
        return phases
    
    # Find where to stop - look for TOTAL or section headers
    stop_markers = ['TOTAL', '\nThe following', '\nAdditional', '\nThe proposed work']
    stop_idx = len(text)
    for marker in stop_markers:
        idx = text.find(marker, comp_idx)
        if idx != -1 and idx < stop_idx:
            stop_idx = idx
    
    compensation_section = text[comp_idx:stop_idx]
    
    # Pattern to match phase lines with various formats:
    # - "Phase A1   Preliminary Site Plan   $3,000 Lump Sum"
    # - "C1   Preliminary Site Planning   $2,500 Lump Sum"
    # - "Phase CA   Final Certs and Construction Admin.   $15,000 Hourly Rates"
    # - "Phase C1 PUD Verification $3,000  Hourly, Not-to-Exceed"
    
    # Match phase code (A1, C1, CA, etc.), name, amount, and billing type
    # Handle both "Phase CODE" and just "CODE" formats
    # Handle "Lump Sum", "Hourly Rates", "Hourly, Not-to-Exceed", etc.
    phase_pattern = r'(?:Phase\s+)?([A-Z]+\d*[A-Z]*)\s+(.+?)\s+\$([\d,]+)\s+(Lump\s+Sum|Hourly(?:\s+Rates)?(?:\s*,\s*Not-to-Exceed)?)'
    
    matches = re.finditer(phase_pattern, compensation_section, re.IGNORECASE)
    
    for match in matches:
        code = match.group(1).strip()
        name = match.group(2).strip()
        amount_str = match.group(3).replace(',', '').strip()
        billing_type_str = match.group(4).strip()
        
        # Clean up name - remove extra whitespace and trailing periods/spaces
        name = re.sub(r'\s+', ' ', name).strip()
        name = name.rstrip('.')
        
        try:
            amount = int(amount_str)
        except ValueError:
            continue
        
        # Determine billing type: "L" for Lump Sum, "H" for Hourly (any variant)
        billing_type = "L" if "lump" in billing_type_str.lower() else "H"
        
        phases.append({
            "code": code,
            "name": name,
            "amount": amount,
            "billing_type": billing_type
        })
    
    return phases

def main():
    proposals_dir = Path(r"Z:\Private\aray\Admin\Proposals\25")
    results = []
    
    # Process proposals from 25-01 to 25-34
    for i in range(1, 35):
        proposal_num = f"25-{i:02d}"
        
        # Find PDF files matching this proposal number
        pdf_files = list(proposals_dir.glob(f"{proposal_num}*.pdf"))
        
        if not pdf_files:
            print(f"No PDF found for {proposal_num}")
            continue
        
        # Prefer non-signed versions, but use signed if that's all we have
        pdf_file = None
        for pf in pdf_files:
            if "_Signed" not in pf.name:
                pdf_file = pf
                break
        
        if not pdf_file:
            pdf_file = pdf_files[0]  # Use signed version if no unsigned available
        
        print(f"Processing {pdf_file.name}...")
        
        text = extract_text_from_pdf(pdf_file)
        if text is None:
            continue
        
        phases = extract_phases_from_text(text, proposal_num)
        
        if phases:
            results.append({
                "proposal_number": proposal_num,
                "phases": phases
            })
            print(f"  Found {len(phases)} phases")
        else:
            print(f"  No phases found")
    
    # Output JSON
    print("\n" + json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
