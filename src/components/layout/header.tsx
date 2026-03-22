'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/contracts': 'Active Contracts',
  '/invoices': 'Invoice Tracker',
  '/unbilled': 'Billables Report',
  '/time-entries': 'Time Entries',
  '/reimbursables': 'Reimbursables',
  '/rates': 'Schedule of Rates',
  '/clients': 'Clients',
  '/proposals': 'Proposals',
  '/cash-flow': 'Cash Flow',
  '/contract-labor': 'Contract Labor',
  '/data-quality': 'Data Quality',
  '/cam/utilities-inputs': 'CAM Utilities Inputs',
  '/cam/reconciliation': 'CAM Reconciliation',
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
