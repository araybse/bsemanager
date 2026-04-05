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
    
    // Query ALL time entries (no date filtering - get everything)
    let query = supabase
      .from('time_entries')
      .select('employee_id, entry_date, hours, phase_name')
    
    // Filter by employee if specified
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
    
    const { data: timeEntries, error } = await query
    
    if (error) {
      console.error('Error fetching time entries:', error)
      return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
    }
    
    // Group by period type
    const utilizationMap = new Map<string, {
      period: string
      periodLabel: string
      totalHours: number
      projectHours: number
      utilizationRate: number
    }>()
    
    const excludePhases = ['Admin', 'PTO', 'Vacation', 'Sick', 'Holiday', 'GO']
    
    for (const entry of (timeEntries as any[]) || []) {
      const date = new Date(entry.entry_date)
      const hours = parseFloat(entry.hours?.toString() || '0')
      const isProject = entry.phase_name && !excludePhases.includes(entry.phase_name)
      
      let key: string
      let label: string
      
      if (period === 'year') {
        // Group by year
        key = date.getFullYear().toString()
        label = key
      } else if (period === 'quarter') {
        // Group by quarter
        const year = date.getFullYear()
        const quarter = Math.ceil((date.getMonth() + 1) / 3)
        key = `${year}-Q${quarter}`
        label = `Q${quarter} ${year}`
      } else {
        // Group by month (default)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        key = `${year}-${month.toString().padStart(2, '0')}`
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }
      
      if (!utilizationMap.has(key)) {
        utilizationMap.set(key, {
          period: key,
          periodLabel: label,
          totalHours: 0,
          projectHours: 0,
          utilizationRate: 0
        })
      }
      
      const data = utilizationMap.get(key)!
      data.totalHours += hours
      if (isProject) {
        data.projectHours += hours
      }
    }
    
    // Calculate rates and sort
    let utilization = Array.from(utilizationMap.values())
      .map(p => ({
        ...p,
        utilizationRate: p.totalHours > 0 
          ? Math.round((p.projectHours / p.totalHours) * 100) 
          : 0
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
    
    // For month view, limit to last 12 months
    if (period === 'month') {
      utilization = utilization.slice(-12)
    }
    
    return NextResponse.json({
      period,
      employeeId: employeeId || (auth.role === 'employee' ? auth.user.id : null),
      utilization
    })
    
  } catch (err) {
    console.error('Utilization API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
