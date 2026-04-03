import { createClient } from '@supabase/supabase-js'
import { QuickBooksClient } from '../src/lib/qbo/sync/qbo-client.js'
import * as dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Verifying Cash Flow Data: IRIS vs QuickBooks\n')

// Get QB tokens from Supabase
const { data: settings } = await supabase
  .from('settings')
  .select('qb_realm_id, qb_access_token, qb_refresh_token, qb_token_expires_at')
  .single()

if (!settings?.qb_realm_id || !settings?.qb_access_token) {
  console.error('❌ QuickBooks not connected in IRIS')
  process.exit(1)
}

const qbo = new QuickBooksClient({
  realmId: settings.qb_realm_id,
  accessToken: settings.qb_access_token,
  refreshToken: settings.qb_refresh_token,
  expiresAt: settings.qb_token_expires_at
})

// Test February 2026
console.log('📅 Testing February 2026 P&L (Cash Basis)\n')

// Get from IRIS snapshot
const { data: snapshot } = await supabase
  .from('accounting_snapshots')
  .select('id')
  .eq('report_type', 'profit_and_loss')
  .eq('basis', 'cash')
  .gte('period_start', '2026-02-01')
  .lte('period_start', '2026-02-01')
  .order('fetched_at', { ascending: false })
  .limit(1)
  .single()

const { data: irisLines } = await supabase
  .from('accounting_snapshot_lines')
  .select('account_name, amount')
  .eq('snapshot_id', snapshot.id)
  .in('account_name', ['Gross Profit', 'Total Expenses', 'Net Income'])

console.log('📊 IRIS Data (from snapshot):')
irisLines.forEach(line => {
  console.log(`   ${line.account_name}: $${parseFloat(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
})

// Get from QuickBooks directly
console.log('\n📊 QuickBooks Data (direct API):')
try {
  const qbReport = await qbo.getProfitAndLoss('2026-02-01', '2026-02-28', 'Cash')
  
  // QuickBooks P&L structure varies, let's find the values
  const findValue = (rows, targetName) => {
    if (!rows) return null
    for (const row of rows) {
      // Check if this is a Summary row with the target name
      if (row.Summary?.ColData?.[0]?.value === targetName) {
        return parseFloat(row.Summary.ColData[1]?.value || 0)
      }
      // Check regular row
      if (row.ColData?.[0]?.value === targetName) {
        return parseFloat(row.ColData[1]?.value || 0)
      }
      // Check nested rows
      if (row.Rows?.Row) {
        const nested = findValue(row.Rows.Row, targetName)
        if (nested !== null) return nested
      }
    }
    return null
  }
  
  const rows = qbReport.Rows?.Row || []
  const grossProfit = findValue(rows, 'Gross Profit')
  const totalExpenses = findValue(rows, 'Total Expenses')
  const netIncome = findValue(rows, 'Net Income')
  
  console.log(`   Gross Profit: $${(grossProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  console.log(`   Total Expenses: $${(totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  console.log(`   Net Income: $${(netIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  
  console.log('\n✅ Comparison:')
  const irisGP = parseFloat(irisLines.find(l => l.account_name === 'Gross Profit')?.amount || 0)
  const irisTE = parseFloat(irisLines.find(l => l.account_name === 'Total Expenses')?.amount || 0)
  const irisNI = parseFloat(irisLines.find(l => l.account_name === 'Net Income')?.amount || 0)
  
  const gpMatch = Math.abs(irisGP - (grossProfit || 0)) < 0.01
  const teMatch = Math.abs(irisTE - (totalExpenses || 0)) < 0.01
  const niMatch = Math.abs(irisNI - (netIncome || 0)) < 0.01
  
  console.log(`   Gross Profit: ${gpMatch ? '✅ Match' : `❌ Mismatch (IRIS: $${irisGP.toFixed(2)}, QB: $${(grossProfit || 0).toFixed(2)})`}`)
  console.log(`   Total Expenses: ${teMatch ? '✅ Match' : `❌ Mismatch (IRIS: $${irisTE.toFixed(2)}, QB: $${(totalExpenses || 0).toFixed(2)})`}`)
  console.log(`   Net Income: ${niMatch ? '✅ Match' : `❌ Mismatch (IRIS: $${irisNI.toFixed(2)}, QB: $${(netIncome || 0).toFixed(2)})`}`)
  
  if (gpMatch && teMatch && niMatch) {
    console.log('\n🎉 All values match! Cash Flow data is accurate.')
  } else {
    console.log('\n⚠️  Some values do not match. May need to re-sync accounting data.')
  }
  
} catch (error) {
  console.error('❌ Error querying QuickBooks:', error.message)
  if (error.stack) console.error(error.stack)
  process.exit(1)
}
