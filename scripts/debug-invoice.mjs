import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

console.log('Checking invoice 27-xx-xx details...\n')

const { data, error } = await supabase
  .from('invoices')
  .select('*')
  .eq('invoice_number', '27-xx-xx')
  .single()

if (error) {
  console.log('Error:', error.message)
} else if (!data) {
  console.log('Invoice not found')
} else {
  console.log('Invoice found:')
  console.log('  Invoice Number:', data.invoice_number)
  console.log('  QB Invoice ID:', data.qb_invoice_id || 'NULL ❌')
  console.log('  Date Issued:', data.date_issued)
  console.log('  Status:', data.status)
  console.log('  Deleted At:', data.deleted_at || 'NULL')
  console.log('  Amount:', data.amount)
  console.log('')
  
  if (!data.qb_invoice_id) {
    console.log('⚠️  PROBLEM: Invoice has no qb_invoice_id!')
    console.log('   The delete detection only works for invoices synced from QB.')
    console.log('   This invoice was probably created manually in IRIS.')
  }
}
