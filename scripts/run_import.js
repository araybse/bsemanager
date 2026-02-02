const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://lqlyargzteskhsddbjpa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSV(content) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      if (char === '\r' && content[i + 1] === '\n') {
        i++;
      }
    } else {
      currentLine += char;
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  
  return lines;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

function extractProjectNumber(jobcode2) {
  if (!jobcode2) return null;
  const match = jobcode2.match(/^(\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function isOverhead(jobcode1, jobcode2) {
  const overheadCodes = ['GO', 'Holiday', 'Paid Time Off', 'Business Development', 
                         'General Overhead', 'Training', 'Proposals'];
  return overheadCodes.includes(jobcode1) || overheadCodes.includes(jobcode2);
}

async function main() {
  console.log('Starting data import from CSV...\n');

  // Read CSV directly
  const csvPath = path.join('C:', 'Users', 'AustinRay', 'Desktop', 
                            'timesheet_report_2023-05-01_thru_2025-12-31.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = parseCSV(csvContent);
  
  console.log(`Found ${lines.length} lines in CSV`);
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const headerMap = {};
  header.forEach((col, i) => headerMap[col] = i);
  
  // Parse all entries
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const fname = values[headerMap['fname']] || '';
    const lname = values[headerMap['lname']] || '';
    const employeeName = `${fname} ${lname}`.trim();
    
    const entryDate = values[headerMap['local_date']] || '';
    const jobcode1 = values[headerMap['jobcode_1']] || '';
    const jobcode2 = values[headerMap['jobcode_2']] || '';
    const hours = parseFloat(values[headerMap['hours']] || '0');
    const serviceItem = values[headerMap['service item']] || '';
    const notes = values[headerMap['notes']] || '';
    
    if (!entryDate || hours <= 0) continue;
    
    const projectNumber = extractProjectNumber(jobcode2);
    const isBillable = !isOverhead(jobcode1, jobcode2);
    
    entries.push({
      employee_name: employeeName,
      entry_date: entryDate,
      project_number: projectNumber || jobcode2 || jobcode1,
      phase_name: serviceItem || 'General',
      hours: hours,
      notes: notes.replace(/\n/g, ' ').replace(/\r/g, '').trim() || null,
      is_billable: isBillable,
      is_billed: false
    });
  }
  
  console.log(`Parsed ${entries.length} time entries\n`);

  // Step 1: Delete existing manual time entries
  console.log('Step 1: Clearing existing manual time entries...');
  const { error: deleteError } = await supabase
    .from('time_entries')
    .delete()
    .is('qb_time_id', null);
  
  if (deleteError) {
    console.log(`  Error deleting: ${deleteError.message}`);
  } else {
    console.log(`  Cleared existing manual entries`);
  }

  // Step 2: Insert time entries in batches
  console.log('\nStep 2: Importing time entries...');
  
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const { error } = await supabase.from('time_entries').insert(batch);
    if (error) {
      console.log(`  Batch ${Math.floor(i/batchSize) + 1} error: ${error.message}`);
      errors++;
    } else {
      inserted += batch.length;
      process.stdout.write(`  Inserted ${inserted}/${entries.length} entries\r`);
    }
  }
  
  console.log(`\n  Completed: ${inserted} entries inserted, ${errors} batch errors`);

  // Step 3: Link time entries to projects
  console.log('\nStep 3: Linking time entries to projects...');
  const { data: projects } = await supabase.from('projects').select('id, project_number');
  
  let linked = 0;
  if (projects) {
    for (const project of projects) {
      const { count } = await supabase
        .from('time_entries')
        .update({ project_id: project.id })
        .eq('project_number', project.project_number)
        .is('project_id', null);
      
      linked++;
    }
    console.log(`  Processed ${linked} projects`);
  }

  console.log('\n✓ Import complete!');
  console.log(`  Total entries: ${inserted}`);
}

main().catch(console.error);
