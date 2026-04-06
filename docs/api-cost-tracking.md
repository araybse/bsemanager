# API Cost Tracking - Documentation

**Status:** ✅ Operational  
**Last Backfill:** April 6, 2026  
**Data Source:** Claude Console CSV exports  

---

## Overview

Historical Claude API costs are now tracked in IRIS (`api_costs` table) with automated backfill scripts and analysis tools.

## Database

**Table:** `api_costs`

```sql
-- Schema
CREATE TABLE api_costs (
  id SERIAL PRIMARY KEY,
  usage_date DATE NOT NULL,
  model VARCHAR(50) NOT NULL,
  workspace VARCHAR(50),
  api_key VARCHAR(50),
  token_type VARCHAR(50) NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL,
  source VARCHAR(20) DEFAULT 'claude_console',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast querying
CREATE INDEX idx_api_costs_date_model 
  ON api_costs(usage_date, model, token_type);
```

**Current data:** Feb 1 - Apr 6, 2026 (331 records, $1,969.02)

## Usage

### Query Total Costs

```javascript
const result = await supabase
  .from('api_costs')
  .select('cost_usd')
  .gte('usage_date', '2026-02-01')
  .lte('usage_date', '2026-04-06');

const total = result.data.reduce((sum, row) => sum + parseFloat(row.cost_usd), 0);
console.log(`Total: $${total.toFixed(2)}`);
```

### Query Monthly Breakdown

```sql
SELECT 
  TO_CHAR(usage_date, 'YYYY-MM') as month,
  SUM(cost_usd) as total_cost,
  COUNT(*) as charge_count
FROM api_costs
GROUP BY month
ORDER BY month;
```

### Query by Model

```sql
SELECT 
  model,
  SUM(cost_usd) as total_cost,
  COUNT(*) as charge_count
FROM api_costs
WHERE usage_date >= '2026-04-01'
GROUP BY model
ORDER BY total_cost DESC;
```

### Query Top Cost Days

```sql
SELECT 
  usage_date,
  SUM(cost_usd) as daily_cost
FROM api_costs
GROUP BY usage_date
ORDER BY daily_cost DESC
LIMIT 10;
```

## Backfill Script

**Location:** `scripts/backfill_api_costs.mjs`

### Running a Backfill

1. **Export CSV from Claude Console**
   - Go to console.anthropic.com → Usage
   - Select date range
   - Click "Export CSV"
   - Save to `~/.openclaw/media/inbound/`

2. **Update script with new file paths**

```javascript
const CSV_FILES = [
  '/Users/austinray/.openclaw/media/inbound/claude_api_cost_YYYY_MM_DD_to_YYYY_MM_DD.csv',
  // Add more files as needed
];
```

3. **Run the backfill**

```bash
cd ~/.openclaw/workspace/bsemanager
node scripts/backfill_api_costs.mjs
```

### What the Script Does

1. ✅ Parses all CSV files
2. ✅ Aggregates by date, model, token type
3. ✅ Creates/updates `api_costs` table
4. ✅ Clears existing data for date range (prevents duplicates)
5. ✅ Inserts all records
6. ✅ Generates analysis report (`API_COST_ANALYSIS_REPORT.md`)
7. ✅ Creates JSON summary (`data/api_cost_summary.json`)

### Script Output

```
🚀 Starting API Cost Backfill & Analysis...

📊 Phase 1: Parsing CSV files...
  📄 Reading: claude_api_cost_2026_02_01_to_2026_02_28.csv
     ➜ 183 rows
  ...
✅ Parsed 331 total records

🗄️  Phase 2: Setting up database table...
  ✓ Table api_costs ready
✅ Table ready

💾 Phase 3: Backfilling IRIS database...
  ✓ Cleared existing data for date range
  ✓ Inserted: 331 rows (all CSV records)
✅ Data inserted

📈 Phase 4: Generating analysis report...
  ✓ Report written to API_COST_ANALYSIS_REPORT.md
  ✓ Summary JSON written to data/api_cost_summary.json
✅ Report generated

🎉 Mission complete!
```

## Reports

### Generated Files

After each backfill, the following files are generated:

1. **`API_COST_ANALYSIS_REPORT.md`** — Comprehensive analysis
   - Monthly breakdown
   - Top 10 highest cost days
   - Model usage breakdown
   - Token type breakdown
   - Cache effectiveness analysis
   - Trends and insights
   - Recommendations

2. **`data/api_cost_summary.json`** — Programmatic access
   - All totals and breakdowns in JSON format
   - Top days, models, token types
   - Spike analysis

3. **`COST_SNAPSHOT.md`** — Quick reference
   - At-a-glance summary
   - Hot spots and alerts
   - Immediate action items

### Report Refresh

To regenerate reports from existing database data:

```bash
# Re-run the backfill (it won't duplicate data)
node scripts/backfill_api_costs.mjs
```

Or create a standalone report generator:

```javascript
// scripts/generate_cost_report.mjs
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function generateReport() {
  // Query database
  const totals = await pool.query(`
    SELECT 
      TO_CHAR(usage_date, 'YYYY-MM') as month,
      SUM(cost_usd) as total
    FROM api_costs
    GROUP BY month
    ORDER BY month
  `);
  
  // Generate markdown report
  // ... (similar to backfill script Phase 4)
}

generateReport();
```

## Maintenance

### Monthly Backfill

**Recommended schedule:** 1st of each month

1. Export previous month's data from Claude console
2. Save CSV to inbound folder
3. Update backfill script with new file path
4. Run backfill
5. Review report
6. Share insights with team

### Cost Alerts

Set up automated monitoring:

```javascript
// scripts/check_daily_costs.mjs
import pg from 'pg';

const ALERT_THRESHOLD = 150; // $150/day

async function checkDailyCosts() {
  const result = await pool.query(`
    SELECT 
      usage_date,
      SUM(cost_usd) as daily_cost
    FROM api_costs
    WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY usage_date
    HAVING SUM(cost_usd) > $1
    ORDER BY daily_cost DESC
  `, [ALERT_THRESHOLD]);
  
  if (result.rows.length > 0) {
    console.log('⚠️ High cost days detected:');
    result.rows.forEach(row => {
      console.log(`  ${row.usage_date}: $${row.daily_cost}`);
    });
    // Send notification (email, Slack, etc.)
  }
}
```

### Data Retention

Currently keeping all historical data. Consider:

- **Archive old data** after 1 year (move to cold storage)
- **Aggregate very old data** (daily → monthly summaries)
- **Backup regularly** (Supabase automatic backups should cover this)

## Integration

### Link to Budget Tracking

```javascript
// Example: Check budget vs actual
async function checkBudget(month) {
  const actual = await pool.query(`
    SELECT SUM(cost_usd) as total
    FROM api_costs
    WHERE TO_CHAR(usage_date, 'YYYY-MM') = $1
  `, [month]);
  
  const budget = 1000; // $1000/month budget
  const spent = parseFloat(actual.rows[0].total);
  const remaining = budget - spent;
  
  console.log(`Budget: $${budget}`);
  console.log(`Spent: $${spent.toFixed(2)} (${(spent/budget*100).toFixed(1)}%)`);
  console.log(`Remaining: $${remaining.toFixed(2)}`);
}
```

### Estimate Tracking

To enable estimate vs actual comparison:

1. Add estimates when creating tasks/projects
2. Store in separate table or same table with `source='estimated'`
3. Compare in monthly reports

```sql
-- Example: Insert estimate
INSERT INTO api_costs (usage_date, model, token_type, cost_usd, source, workspace)
VALUES ('2026-04-15', 'Claude Sonnet 4.5', 'estimated', 50.00, 'estimate', 'project-xyz');

-- Compare
SELECT 
  usage_date,
  SUM(CASE WHEN source = 'estimate' THEN cost_usd ELSE 0 END) as estimated,
  SUM(CASE WHEN source = 'claude_console' THEN cost_usd ELSE 0 END) as actual
FROM api_costs
GROUP BY usage_date
HAVING SUM(CASE WHEN source = 'estimate' THEN cost_usd ELSE 0 END) > 0;
```

## Troubleshooting

### Database Connection Issues

```javascript
// Test connection
const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection error:', err);
  } else {
    console.log('Connected:', res.rows[0].now);
  }
  pool.end();
});
```

### CSV Parsing Issues

**Error:** Unexpected columns

**Fix:** Check CSV format matches expected schema:
```
usage_date_utc,model,workspace,api_key,usage_type,context_window,token_type,cost_usd,list_price_usd,cost_type,inference_geo,speed
```

**Error:** Duplicate entries

**Fix:** Script automatically clears date range before inserting. If you want to preserve existing data, modify the `insertData()` function.

### Report Generation Fails

**Error:** Unable to write file

**Fix:** Check write permissions in workspace directory:
```bash
chmod +w API_COST_ANALYSIS_REPORT.md
```

**Error:** Missing data in report

**Fix:** Verify database query results:
```sql
SELECT COUNT(*), MIN(usage_date), MAX(usage_date) 
FROM api_costs;
```

## Reference

### Environment Variables

Required in `.env.local`:

```env
SUPABASE_DB_URL="postgresql://postgres.xxx:password@host:6543/postgres"
```

### Dependencies

```json
{
  "dependencies": {
    "csv-parse": "^5.x",
    "pg": "^8.x",
    "dotenv": "^17.x"
  }
}
```

Install:
```bash
npm install csv-parse pg dotenv --save-dev
```

---

**Last Updated:** April 6, 2026  
**Maintained By:** Max (AI Assistant)  
**Contact:** austin@example.com
