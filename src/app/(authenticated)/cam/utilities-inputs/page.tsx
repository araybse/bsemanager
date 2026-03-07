import { redirect } from 'next/navigation'

export default function CamUtilitiesInputsPage() {
  redirect('/settings?tab=data-quality&section=utilities-inputs')
}
