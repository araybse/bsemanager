'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Tables, UserRole } from '@/lib/types/database'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  Receipt,
  Clock,
  FileSpreadsheet,
  Settings,
  CreditCard,
  Briefcase,
  TrendingUp,
  Hammer,
  Landmark,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PAGE_VISIBILITY, type PageVisibility } from '@/lib/auth/permissions'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  pageKey: string // Key for PAGE_VISIBILITY lookup
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, pageKey: 'dashboard' },
  { title: 'Proposals', href: '/proposals', icon: Briefcase, pageKey: 'proposals' },
  { title: 'Projects', href: '/projects', icon: FolderKanban, pageKey: 'projects' },
  // { title: 'Timesheet', href: '/timesheet', icon: Clock, pageKey: 'timesheet' }, // Hidden - Phase 2
  { title: 'Time', href: '/time', icon: Clock, pageKey: 'time' },
  { title: 'Billables Report', href: '/billable', icon: FileSpreadsheet, pageKey: 'billables-report' },
  { title: 'Invoices', href: '/invoices', icon: Receipt, pageKey: 'invoices' },
  { title: 'Accounting', href: '/accounting', icon: Landmark, pageKey: 'accounting' },
  { title: 'Cash Flow', href: '/cash-flow', icon: TrendingUp, pageKey: 'cash-flow' },
  { title: 'Expenses', href: '/reimbursables', icon: CreditCard, pageKey: 'expenses' },
  { title: 'Contract Labor', href: '/contract-labor', icon: Hammer, pageKey: 'contract-labor' },
  { title: 'Contracts', href: '/contracts', icon: FileSpreadsheet, pageKey: 'contracts' },
  { title: 'Settings', href: '/settings', icon: Settings, pageKey: 'settings' },
]

interface SidebarProps {
  initialProfile: Tables<'profiles'> | null
}

const SIDEBAR_COLLAPSED_KEY = 'bse.sidebar.collapsed'

export function Sidebar({ initialProfile }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true'
  })
  
  const role = initialProfile?.role as UserRole | undefined

  const filteredNavItems = navItems.filter((item) => {
    // If role not loaded yet, don't show items
    if (!role) return false
    
    // Check visibility based on role and pageKey
    const visibility = PAGE_VISIBILITY[item.pageKey]?.[role] as PageVisibility | undefined
    return visibility === 'visible'
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!isOpen))
  }, [isOpen])

  const toggleSidebar = () => setIsOpen((prev) => !prev)

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-card transition-all duration-300 ease-in-out",
      isOpen ? "w-64" : "w-16"
    )}>
      <div className={cn(
        "flex h-16 items-center border-b",
        isOpen ? "justify-between px-4" : "justify-center"
      )}>
        {isOpen && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logos/iris-logo-simple.svg" alt="IRIS" className="h-10" />
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
          aria-label="Toggle sidebar"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {filteredNavItems.map((item, index) => {
            let isActive = false
            if (item.href.includes('?tab=')) {
              const [itemPath, queryString] = item.href.split('?')
              const tab = new URLSearchParams(queryString).get('tab')
              isActive = pathname === itemPath && searchParams.get('tab') === tab
            } else if (item.href === '/settings') {
              isActive = pathname === '/settings' && !searchParams.get('tab')
            } else {
              isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            }
            return (
              <Link
                key={`${item.href}-${item.title}-${index}`}
                href={item.href}
                title={!isOpen ? item.title : ''}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {isOpen && <span className="truncate">{item.title}</span>}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className={cn(
        "transition-all duration-300",
        isOpen ? "p-4" : "p-2"
      )}>
        {isOpen ? (
          <>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium flex-shrink-0">
                {initialProfile?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{initialProfile?.full_name || 'User'}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {initialProfile?.title || role || 'User'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 mt-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign Out
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full p-0"
            title="Sign Out"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
