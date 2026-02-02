const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lqlyargzteskhsddbjpa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Labor rates by employee and date range
const laborRates = [
  {
    employee: 'Austin Ray',
    rates: [
      { from: '2000-01-01', to: '2099-12-31', rate: 74.28 }
    ]
  },
  {
    employee: 'Austin Burke',
    rates: [
      { from: '2000-01-01', to: '2025-12-31', rate: 59.51 },
      { from: '2026-01-01', to: '2099-12-31', rate: 68.60 }
    ]
  },
  {
    employee: 'Wesley Koning',
    rates: [
      { from: '2000-01-01', to: '2025-12-31', rate: 65.19 },
      { from: '2026-01-01', to: '2099-12-31', rate: 68.60 }
    ]
  },
  {
    employee: 'Arber Meta',
    rates: [
      { from: '2026-01-01', to: '2099-12-31', rate: 57.24 }
    ]
  }
];

async function main() {
  console.log('Updating labor costs...\n');

  let totalUpdated = 0;

  for (const emp of laborRates) {
    console.log(`Processing ${emp.employee}...`);
    
    for (const period of emp.rates) {
      // Get all time entries for this employee in this date range
      const { data: entries, error: fetchError } = await supabase
        .from('time_entries')
        .select('id, hours, entry_date')
        .eq('employee_name', emp.employee)
        .gte('entry_date', period.from)
        .lte('entry_date', period.to);
      
      if (fetchError) {
        console.log(`  Error fetching entries: ${fetchError.message}`);
        continue;
      }
      
      if (!entries || entries.length === 0) {
        console.log(`  No entries for ${period.from} to ${period.to}`);
        continue;
      }
      
      console.log(`  Found ${entries.length} entries @ $${period.rate}/hr (${period.from} to ${period.to})`);
      
      // Update each entry with labor_cost = hours * rate
      let updated = 0;
      for (const entry of entries) {
        const laborCost = Math.round(entry.hours * period.rate * 100) / 100;
        
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({ labor_cost: laborCost })
          .eq('id', entry.id);
        
        if (!updateError) {
          updated++;
        }
      }
      
      console.log(`  Updated ${updated} entries`);
      totalUpdated += updated;
    }
  }

  // Get summary stats
  const { data: stats } = await supabase
    .from('time_entries')
    .select('employee_name, hours, labor_cost');
  
  if (stats) {
    const byEmployee = {};
    stats.forEach(e => {
      if (!byEmployee[e.employee_name]) {
        byEmployee[e.employee_name] = { hours: 0, cost: 0 };
      }
      byEmployee[e.employee_name].hours += e.hours || 0;
      byEmployee[e.employee_name].cost += e.labor_cost || 0;
    });
    
    console.log('\n--- Summary ---');
    let totalHours = 0;
    let totalCost = 0;
    
    for (const [name, data] of Object.entries(byEmployee)) {
      const avgRate = data.hours > 0 ? (data.cost / data.hours).toFixed(2) : '0.00';
      console.log(`${name}: ${data.hours.toFixed(2)} hrs, $${data.cost.toFixed(2)} cost (avg $${avgRate}/hr)`);
      totalHours += data.hours;
      totalCost += data.cost;
    }
    
    console.log(`\nTotal: ${totalHours.toFixed(2)} hours, $${totalCost.toFixed(2)} labor cost`);
  }

  console.log(`\n✓ Updated ${totalUpdated} time entries with labor costs`);
}

main().catch(console.error);
