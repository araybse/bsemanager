import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    
    const period = searchParams.get('period') || 'month'
    const employeeId = searchParams.get('employee_id') || null
    
    // Query ALL PTO entries
    let query = supabase
      .from('time_entries')
      .select('employee_id, entry_date, hours, phase_name')
      .in('phase_name', ['PTO', 'Vacation', 'Sick'])
    
    // Filter by employee
    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    } else if (auth.role === 'employee') {
      // Employees only see their own data
      query = query.eq('employee_id', auth.user.id)
    } else if (auth.role === 'project_manager') {
      // PMs see their own data by default (admin sees all)
      query = query.eq('employee_id', auth.user.id)
    }
    // Admin with no employee_id = show all users
    
    const { data: ptoEntries, error } = await query
    
    if (error) {
      console.error('Error fetching PTO entries:', error)
      return NextResponse.json({ error: 'Failed to fetch PTO entries' }, { status: 500 })
    }
    
    // Group by period
    const ptoMap = new Map<string, {
      period: string
      periodLabel: string
      totalHours: number
      byType: { PTO: number; Vacation: number; Sick: number }
    }>()
    
    for (const entry of (ptoEntries as any[]) || []) {
      const date = new Date(entry.entry_date)
      const hours = parseFloat(entry.hours?.toString() || '0')
      const type = entry.phase_name as 'PTO' | 'Vacation' | 'Sick'
      
      let key: string
      let label: string
      
      if (period === 'year') {
        key = date.getFullYear().toString()
        label = key
      } else if (period === 'quarter') {
        const year = date.getFullYear()
        const quarter = Math.ceil((date.getMonth() + 1) / 3)
        key = `${year}-Q${quarter}`
        label = `Q${quarter} ${year}`
      } else {
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        key = `${year}-${month.toString().padStart(2, '0')}`
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }
      
      if (!ptoMap.has(key)) {
        ptoMap.set(key, {
          period: key,
          periodLabel: label,
          totalHours: 0,
          byType: { PTO: 0, Vacation: 0, Sick: 0 }
        })
      }
      
      const data = ptoMap.get(key)!
      data.totalHours += hours
      data.byType[type] = (data.byType[type] || 0) + hours
    }
    
    // Sort and limit
    let ptoUsage = Array.from(ptoMap.values())
      .sort((a, b) => a.period.localeCompare(b.period))
    
    if (period === 'month') {
      ptoUsage = ptoUsage.slice(-12)
    }
    
    return NextResponse.json({
      period,
      employeeId: employeeId || (auth.role === 'employee' ? auth.user.id : null),
      ptoUsage
    })
    
  } catch (err) {
    console.error('PTO usage API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
