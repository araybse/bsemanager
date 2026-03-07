import { redirect } from 'next/navigation'

export default function CamReconciliationPage() {
  redirect('/settings?tab=data-quality&section=reconciliation')
}
