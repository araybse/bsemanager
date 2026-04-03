import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('Deleting invoice 27-xx-xx (ID 923)...')

// Delete line items first
const { error: lineError } = await supabase
  .from('invoice_line_items')
  .delete()
  .eq('invoice_id', 923)

if (lineError) {
  console.error('Error deleting line items:', lineError)
  process.exit(1)
}
console.log('✓ Deleted invoice line items')

// Delete invoice
const { error: invError } = await supabase
  .from('invoices')
  .delete()
  .eq('id', 923)

if (invError) {
  console.error('Error deleting invoice:', invError)
  process.exit(1)
}
console.log('✓ Deleted invoice 27-xx-xx')
console.log('✅ Test invoice successfully removed!')
