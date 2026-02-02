import csv
import re
import sys

def escape_sql(text):
    """Escape single quotes for SQL"""
    if text is None:
        return None
    return text.replace("'", "''").replace("\n", " ").replace("\r", "")

def extract_project_number(jobcode2):
    """Extract project number like 24-12 from '24-12 North Main Street Residential'"""
    if not jobcode2:
        return None
    match = re.match(r'^(\d{2}-\d{2})', jobcode2)
    if match:
        return match.group(1)
    return None

def is_overhead(jobcode1, jobcode2):
    """Check if this is overhead/non-billable time"""
    overhead_codes = ['GO', 'Holiday', 'Paid Time Off', 'Business Development', 
                      'General Overhead', 'Training', 'Proposals']
    if jobcode1 in overhead_codes:
        return True
    if jobcode2 in overhead_codes:
        return True
    return False

def main():
    csv_path = r'C:\Users\AustinRay\Desktop\timesheet_report_2023-05-01_thru_2025-12-31.csv'
    output_path = r'C:\Users\AustinRay\Desktop\time_entries_import.sql'
    
    entries = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fname = row.get('fname', '').strip()
            lname = row.get('lname', '').strip()
            employee_name = f"{fname} {lname}".strip()
            
            entry_date = row.get('local_date', '').strip()
            jobcode1 = row.get('jobcode_1', '').strip()
            jobcode2 = row.get('jobcode_2', '').strip()
            hours = row.get('hours', '0').strip()
            service_item = row.get('service item', '').strip()
            notes = row.get('notes', '').strip()
            
            # Skip if no date or hours
            if not entry_date or not hours:
                continue
            
            try:
                hours_float = float(hours)
            except:
                continue
            
            if hours_float <= 0:
                continue
            
            # Extract project number
            project_number = extract_project_number(jobcode2)
            
            # Determine billable status
            is_billable = not is_overhead(jobcode1, jobcode2)
            
            # Use jobcode2 as project name if no project number found
            if project_number:
                display_project = project_number
            else:
                display_project = jobcode2 if jobcode2 else jobcode1
            
            # Phase name from service item
            phase_name = service_item if service_item else 'General'
            
            entries.append({
                'employee_name': employee_name,
                'entry_date': entry_date,
                'project_number': display_project,
                'phase_name': phase_name,
                'hours': hours_float,
                'notes': notes,
                'is_billable': is_billable,
            })
    
    # Generate SQL
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("-- Historical time entries import\n")
        f.write("-- Generated from QuickBooks Time export\n")
        f.write(f"-- Total entries: {len(entries)}\n\n")
        
        # First, delete any existing non-QBO entries to avoid duplicates
        f.write("-- Delete any manual entries first (keep QBO synced entries)\n")
        f.write("DELETE FROM time_entries WHERE qb_time_id IS NULL;\n\n")
        
        # Batch insert
        f.write("-- Insert all historical entries\n")
        f.write("INSERT INTO time_entries (employee_name, entry_date, project_number, phase_name, hours, notes, is_billable, is_billed, labor_cost)\n")
        f.write("VALUES\n")
        
        for i, entry in enumerate(entries):
            emp = escape_sql(entry['employee_name'])
            date = entry['entry_date']
            proj = escape_sql(entry['project_number'])
            phase = escape_sql(entry['phase_name'])
            hours = entry['hours']
            notes = escape_sql(entry['notes']) if entry['notes'] else None
            billable = 'true' if entry['is_billable'] else 'false'
            
            notes_sql = f"'{notes}'" if notes else 'NULL'
            
            separator = "," if i < len(entries) - 1 else ";"
            
            f.write(f"  ('{emp}', '{date}', '{proj}', '{phase}', {hours}, {notes_sql}, {billable}, false, 0){separator}\n")
        
        f.write("\n")
        
        # Update project_id based on project_number
        f.write("-- Link entries to existing projects\n")
        f.write("UPDATE time_entries te\n")
        f.write("SET project_id = p.id\n")
        f.write("FROM projects p\n")
        f.write("WHERE te.project_number = p.project_number\n")
        f.write("AND te.project_id IS NULL;\n")
    
    print(f"Generated SQL with {len(entries)} entries")
    print(f"Output saved to: {output_path}")
    
    # Summary stats
    employees = set(e['employee_name'] for e in entries)
    projects = set(e['project_number'] for e in entries)
    total_hours = sum(e['hours'] for e in entries)
    
    print(f"\nSummary:")
    print(f"  Employees: {len(employees)}")
    print(f"  Projects: {len(projects)}")
    print(f"  Total hours: {total_hours:.2f}")

if __name__ == '__main__':
    main()
