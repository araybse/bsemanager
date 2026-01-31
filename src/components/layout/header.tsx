'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/contracts': 'Active Contracts',
  '/invoices': 'Invoice Tracker',
  '/unbilled': 'Unbilled Report',
  '/time-entries': 'Time Entries',
  '/reimbursables': 'Reimbursables',
  '/rates': 'Billable Rates Matrix',
  '/clients': 'Clients',
  '/proposals': 'Proposals',
  '/cash-flow': 'Cash Flow',
  '/income': 'Income',
  '/contract-labor': 'Contract Labor',
  '/memberships': 'Memberships',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()
  
  // Get title from exact match or parent path
  const title = pageTitles[pathname] || 
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(path + '/'))?.[1] ||
    'BSE Management Portal'

  return (
    <header className="flex h-16 items-center border-b bg-card px-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
    </header>
  )
}
