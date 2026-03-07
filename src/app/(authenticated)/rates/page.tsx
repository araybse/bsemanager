import { redirect } from 'next/navigation'

export default function RatesPage() {
  redirect('/settings?tab=schedule-of-rates')
}
