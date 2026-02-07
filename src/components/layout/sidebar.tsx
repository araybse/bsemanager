'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/types/database'
import { useState } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Receipt,
  Clock,
  DollarSign,
  Building2,
  FileSpreadsheet,
  Settings,
  CreditCard,
  Briefcase,
  TrendingUp,
  Hammer,
  CalendarDays,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ('admin' | 'project_manager' | 'employee')[]
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Projects', href: '/projects', icon: FolderKanban },
  { title: 'Contracts', href: '/contracts', icon: FileText },
  { title: 'Invoices', href: '/invoices', icon: Receipt },
  { title: 'Unbilled Report', href: '/unbilled', icon: FileSpreadsheet, roles: ['admin', 'project_manager'] },
  { title: 'Time Entries', href: '/time-entries', icon: Clock },
  { title: 'Reimbursables', href: '/reimbursables', icon: CreditCard, roles: ['admin', 'project_manager'] },
  { title: 'Rates Matrix', href: '/rates', icon: DollarSign, roles: ['admin'] },
  { title: 'Clients', href: '/clients', icon: Building2, roles: ['admin'] },
  { title: 'Proposals', href: '/proposals', icon: Briefcase },
  { title: 'Cash Flow', href: '/cash-flow', icon: TrendingUp, roles: ['admin'] },
  { title: 'Income', href: '/income', icon: DollarSign, roles: ['admin', 'project_manager'] },
  { title: 'Contract Labor', href: '/contract-labor', icon: Hammer, roles: ['admin'] },
  { title: 'Memberships', href: '/memberships', icon: CalendarDays, roles: ['admin'] },
  { title: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
]

interface SidebarProps {
  initialProfile: Tables<'profiles'> | null
}

export function Sidebar({ initialProfile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(true)
  
  const role = initialProfile?.role

  const filteredNavItems = navItems.filter((item) => {
    // Always show items without role restrictions
    if (!item.roles) return true
    // If role not loaded yet, show all items
    if (!role) return true
    // Only show items for admin, project_manager, or employee roles
    if (role === 'client') return false
    return item.roles.includes(role)
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-card transition-all duration-300 ease-in-out",
      isOpen ? "w-64" : "w-20"
    )}>
      <div className="flex h-16 items-center justify-between border-b px-4">
        {isOpen && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/B_Black.png" alt="BSE" className="h-8 w-8" />
            <span className="text-lg font-semibold">BSE</span>
          </Link>
        )}
        {!isOpen && (
          <Link href="/dashboard">
            <img src="/B_Black.png" alt="BSE" className="h-8 w-8" />
          </Link>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
          aria-label="Toggle sidebar"
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
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
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
                <span className="text-xs text-muted-foreground capitalize truncate">{role || 'User'}</span>
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
