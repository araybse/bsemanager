import { createAdminClient } from '@/lib/supabase/admin'
import { qboQuery } from '../qbo-client'
import type { QBSettings } from '../types'

export async function syncCustomers(
  supabase: ReturnType<typeof createAdminClient>,
  settings: QBSettings
) {
  const data = await qboQuery(settings, 'SELECT * FROM Customer MAXRESULTS 1000')
  const customers = data.QueryResponse?.Customer || []

  let imported = 0
  let updated = 0
  let skipped = 0

  for (const customer of customers) {
    try {
      if (customer.ParentRef) {
        skipped++
        continue
      }

      const qbId = customer.Id
      const clientData = {
        name: customer.DisplayName || customer.CompanyName || 'Unknown',
        address_line_1: customer.BillAddr?.Line1 || null,
        address_line_2: [customer.BillAddr?.City, customer.BillAddr?.CountrySubDivisionCode, customer.BillAddr?.PostalCode]
          .filter(Boolean)
          .join(', ') || null,
        email: customer.PrimaryEmailAddr?.Address || null,
        qb_customer_id: qbId,
      }

      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('qb_customer_id' as never, qbId as never)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('clients')
          .update(clientData as never)
          .eq('id' as never, (existing as { id: number }).id as never)
        updated++
      } else {
        const { data: nameMatch } = await supabase
          .from('clients')
          .select('id')
          .eq('name' as never, clientData.name as never)
          .maybeSingle()

        if (nameMatch) {
          await supabase
            .from('clients')
            .update({ ...clientData, qb_customer_id: qbId } as never)
            .eq('id' as never, (nameMatch as { id: number }).id as never)
          updated++
        } else {
          await supabase.from('clients').insert(clientData as never)
          imported++
        }
      }
    } catch (err) {
      console.error('Error syncing customer:', err)
    }
  }

  return { imported, updated, skipped, total: customers.length }
}
