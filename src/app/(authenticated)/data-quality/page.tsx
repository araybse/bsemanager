import { redirect } from 'next/navigation'

export default function DataQualityPage() {
  redirect('/settings?tab=data-quality&section=review')
}
