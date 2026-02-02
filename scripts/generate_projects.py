import csv
import re

def escape_sql(text):
    """Escape single quotes for SQL"""
    if text is None:
        return None
    return text.replace("'", "''").replace("\n", " ").replace("\r", "")

def extract_project_info(jobcode1, jobcode2):
    """Extract project number and name from jobcode fields"""
    if not jobcode2:
        return None, None
    
    # Check if it's an overhead code
    overhead_codes = ['GO', 'Holiday', 'Paid Time Off', 'Business Development', 
                      'General Overhead', 'Training', 'Proposals']
    if jobcode1 in overhead_codes or jobcode2 in overhead_codes:
        return None, None
    
    # Extract project number (e.g., 24-12)
    match = re.match(r'^(\d{2}-\d{2})\s+(.+)$', jobcode2)
    if match:
        return match.group(1), match.group(2).strip()
    
    # Check for hourly support projects
    if 'Hourly' in jobcode2 or 'Support' in jobcode2:
        return None, None
    
    return None, None

def main():
    csv_path = r'C:\Users\AustinRay\Desktop\timesheet_report_2023-05-01_thru_2025-12-31.csv'
    output_path = r'C:\Users\AustinRay\Desktop\projects_import.sql'
    
    projects = {}  # project_number -> name
    clients = {}   # client_name -> set of project_numbers
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            jobcode1 = row.get('jobcode_1', '').strip()
            jobcode2 = row.get('jobcode_2', '').strip()
            
            project_number, project_name = extract_project_info(jobcode1, jobcode2)
            
            if project_number and project_name:
                if project_number not in projects:
                    projects[project_number] = project_name
                    
                    # Track client
                    client_name = jobcode1
                    if client_name and client_name not in ['GO']:
                        if client_name not in clients:
                            clients[client_name] = set()
                        clients[client_name].add(project_number)
    
    # Generate SQL
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("-- Projects and Clients Import\n")
        f.write("-- Generated from QuickBooks Time export\n")
        f.write(f"-- Total projects: {len(projects)}\n")
        f.write(f"-- Total clients: {len(clients)}\n\n")
        
        # Insert clients (only if they don't exist)
        f.write("-- Insert clients (skip if already exists)\n")
        for client_name in sorted(clients.keys()):
            escaped_name = escape_sql(client_name)
            f.write(f"INSERT INTO clients (name) SELECT '{escaped_name}' WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = '{escaped_name}');\n")
        
        f.write("\n")
        
        # Insert projects (only if they don't exist)
        f.write("-- Insert projects (skip if already exists)\n")
        
        # Build a reverse lookup of project -> client
        project_to_client = {}
        for client_name, proj_nums in clients.items():
            for pn in proj_nums:
                project_to_client[pn] = client_name
        
        for proj_num in sorted(projects.keys()):
            proj_name = projects[proj_num]
            client_name = project_to_client.get(proj_num)
            
            escaped_name = escape_sql(proj_name)
            escaped_num = escape_sql(proj_num)
            
            if client_name:
                escaped_client = escape_sql(client_name)
                f.write(f"""INSERT INTO projects (project_number, name, client_id, status)
SELECT '{escaped_num}', '{escaped_name}', c.id, 'active'
FROM clients c
WHERE c.name = '{escaped_client}'
AND NOT EXISTS (SELECT 1 FROM projects WHERE project_number = '{escaped_num}');\n\n""")
            else:
                f.write(f"""INSERT INTO projects (project_number, name, status)
SELECT '{escaped_num}', '{escaped_name}', 'active'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project_number = '{escaped_num}');\n\n""")
    
    print(f"Generated SQL with {len(projects)} projects and {len(clients)} clients")
    print(f"Output saved to: {output_path}")
    
    # Summary
    print(f"\nProjects found:")
    for pn in sorted(projects.keys()):
        print(f"  {pn}: {projects[pn]}")

if __name__ == '__main__':
    main()
