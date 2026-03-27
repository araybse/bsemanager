#!/usr/bin/env node
/**
 * IRIS Data Integrity Validator
 * 
 * Validates internal consistency of all 90 projects.
 * Checks for common data quality issues without needing QB API access.
 * 
 * Checks:
 * - Projects with $0 revenue but time entries
 * - Time entries with $0 billable amount
 * - Invoices with mismatched totals
 * - Orphaned records (missing foreign keys)
 * - Duplicate entries
 * 
 * Usage:
 *   node scripts/audit/validate-data-integrity.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load environment
const envPath = path.join(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 IRIS Data Integrity Check')
console.log('============================\n')

const issues = []

async function checkOrphanedTimeEntries() {
  console.log('1️⃣ Checking for orphaned time entries...')
  
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, entry_date')
    .is('project_id', null)
    .limit(10)

  if (error) throw error

  if (data.length > 0) {
    issues.push({
      severity: 'high',
      category: 'orphaned_data',
      count: data.length,
      message: `${data.length} time entries without project_id`,
      sample: data.slice(0, 3).map(te => te.id)
    })
    console.log(`   ❌ Found ${data.length} orphaned time entries\n`)
  } else {
    console.log(`   ✅ No orphaned time entries\n`)
  }
}

async function checkZeroBillableRates() {
  console.log('2️⃣ Checking for $0 billable rates...')
  
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, project_id, entry_date, hours')
    .eq('billable_amount', 0)
    .gt('hours', 0)
    .limit(10)

  if (error) throw error

  if (data.length > 0) {
    issues.push({
      severity: 'medium',
      category: 'zero_rates',
      count: data.length,
      message: `${data.length} time entries with hours but $0 billable amount`,
      sample: data.slice(0, 3)
    })
    console.log(`   ⚠️  Found ${data.length} entries with $0 rates\n`)
  } else {
    console.log(`   ✅ All time entries have proper rates\n`)
  }
}

async function checkProjectFinancials() {
  console.log('3️⃣ Checking project financial consistency...')
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      project_number,
      name,
      invoices (total_amount),
      time_entries (hours, billable_amount)
    `)

  if (error) throw error

  let projectsWithIssues = 0

  for (const project of projects) {
    const timeEntries = project.time_entries || []
    const invoices = project.invoices || []

    const totalHours = timeEntries.reduce((sum, te) => sum + parseFloat(te.hours || 0), 0)
    const totalBillable = timeEntries.reduce((sum, te) => sum + parseFloat(te.billable_amount || 0), 0)
    const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)

    // Check: Has time but no revenue
    if (totalHours > 0 && totalInvoiced === 0) {
      projectsWithIssues++
      if (projectsWithIssues <= 5) {
        console.log(`   ⚠️  ${project.project_number}: ${totalHours}hrs worked, $0 invoiced`)
      }
    }

    // Check: Invoiced more than billable amount
    if (totalInvoiced > totalBillable * 1.5) { // Allow 50% markup for reimbursables
      projectsWithIssues++
      if (projectsWithIssues <= 5) {
        console.log(`   ⚠️  ${project.project_number}: Invoiced ($${totalInvoiced}) >> Billable ($${totalBillable})`)
      }
    }
  }

  if (projectsWithIssues > 0) {
    issues.push({
      severity: 'low',
      category: 'financial_consistency',
      count: projectsWithIssues,
      message: `${projectsWithIssues} projects with potential financial inconsistencies`
    })
    console.log(`   ⚠️  ${projectsWithIssues} projects with potential issues\n`)
  } else {
    console.log(`   ✅ All projects financially consistent\n`)
  }
}

async function checkDuplicateInvoices() {
  console.log('4️⃣ Checking for duplicate invoices...')
  
  const { data, error } = await supabase.rpc('check_duplicate_invoices', {
    query: `
      SELECT invoice_number, COUNT(*) as count
      FROM invoices
      WHERE invoice_number IS NOT NULL
      GROUP BY invoice_number
      HAVING COUNT(*) > 1
    `
  }).catch(() => {
    // If RPC doesn't exist, do a simpler check
    return supabase
      .from('invoices')
      .select('invoice_number')
      .not('invoice_number', 'is', null)
  })

  // Simple duplicate check (since RPC might not exist)
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('invoice_number')
    .not('invoice_number', 'is', null)

  if (allInvoices) {
    const numbers = allInvoices.map(inv => inv.invoice_number)
    const duplicates = numbers.filter((num, idx) => numbers.indexOf(num) !== idx)

    if (duplicates.length > 0) {
      issues.push({
        severity: 'high',
        category: 'duplicates',
        count: duplicates.length,
        message: `${duplicates.length} duplicate invoice numbers found`
      })
      console.log(`   ❌ Found ${duplicates.length} duplicate invoice numbers\n`)
    } else {
      console.log(`   ✅ No duplicate invoices\n`)
    }
  }
}

async function checkLastSyncDates() {
  console.log('5️⃣ Checking sync freshness...')
  
  const { data: settings } = await supabase
    .from('qb_settings')
    .select('*')
    .single()

  if (settings) {
    const now = new Date()
    const lastInvoiceSync = settings.last_invoice_sync_at ? new Date(settings.last_invoice_sync_at) : null
    const lastTimeSync = settings.last_time_sync_at ? new Date(settings.last_time_sync_at) : null

    if (lastInvoiceSync) {
      const hoursSince = (now - lastInvoiceSync) / (1000 * 60 * 60)
      if (hoursSince > 48) {
        issues.push({
          severity: 'low',
          category: 'stale_data',
          message: `Invoices not synced in ${hoursSince.toFixed(0)} hours`
        })
        console.log(`   ⚠️  Invoices last synced ${hoursSince.toFixed(0)} hours ago\n`)
      } else {
        console.log(`   ✅ Invoices synced ${hoursSince.toFixed(1)} hours ago\n`)
      }
    } else {
      console.log(`   ⚠️  No invoice sync recorded\n`)
    }
  }
}

async function runValidation() {
  try {
    await checkOrphanedTimeEntries()
    await checkZeroBillableRates()
    await checkProjectFinancials()
    await checkDuplicateInvoices()
    await checkLastSyncDates()

    console.log('\n📊 Validation Summary')
    console.log('════════════════════')

    if (issues.length === 0) {
      console.log('✅ All checks passed! Data integrity looks good.\n')
      return 0
    }

    // Group by severity
    const high = issues.filter(i => i.severity === 'high')
    const medium = issues.filter(i => i.severity === 'medium')
    const low = issues.filter(i => i.severity === 'low')

    console.log(`High Priority:   ${high.length}`)
    console.log(`Medium Priority: ${medium.length}`)
    console.log(`Low Priority:    ${low.length}\n`)

    if (high.length > 0) {
      console.log('🚨 High Priority Issues:')
      high.forEach(issue => console.log(`   • ${issue.message}`))
      console.log('')
    }

    if (medium.length > 0) {
      console.log('⚠️  Medium Priority Issues:')
      medium.forEach(issue => console.log(`   • ${issue.message}`))
      console.log('')
    }

    // Overall recommendation
    if (high.length > 0) {
      console.log('❌ Critical issues found. Fix before deployment.\n')
      return 1
    } else if (medium.length > 0) {
      console.log('⚠️  Some issues found. Review and fix when possible.\n')
      return 0
    } else {
      console.log('✅ Minor issues only. Safe to proceed.\n')
      return 0
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message)
    return 1
  }
}

// Run validation
runValidation()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
