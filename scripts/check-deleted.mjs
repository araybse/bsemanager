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

const { data, error } = await supabase
  .from('invoices')
  .select('invoice_number, status, deleted_at, qb_invoice_id')
  .eq('invoice_number', '27-xx-xx')
  .maybeSingle()

if (error) {
  console.log('❌ Error:', error.message)
} else if (!data) {
  console.log('❌ Invoice 27-xx-xx not found in database')
} else {
  console.log('\n✅ Invoice found:')
  console.log('   Number:', data.invoice_number)
  console.log('   Status:', data.status)
  console.log('   Deleted At:', data.deleted_at || 'Not deleted')
  console.log('   QB ID:', data.qb_invoice_id)
  console.log('')
  
  if (data.status === 'deleted' && data.deleted_at) {
    console.log('✅ SUCCESS: Invoice is marked as deleted!\n')
  } else {
    console.log('⚠️  Invoice is NOT marked as deleted. Run sync first.\n')
  }
}
