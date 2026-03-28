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

const { error } = await supabase
  .from('invoices')
  .delete()
  .eq('invoice_number', '27-xx-xx')

if (error) {
  console.log('❌ Error:', error.message)
} else {
  console.log('✅ Test invoice 27-xx-xx deleted')
}
