import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireApiRoles } from '@/lib/auth/api-authorization'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRoles(['admin', 'project_manager', 'employee'])
    if (!auth.ok) return auth.response

    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const employeeId = searchParams.get('employee_id') || null
    
    // Query PTO entries for the specified year only
    let query = supabase
      .from('time_entries')
      .select('employee_id, entry_date, hours, phase_name')
      .in('phase_name', ['PTO', 'Vacation', 'Sick'])
      .gte('entry_date', `${year}-01-01`)
      .lte('entry_date', `${year}-12-31`)
    
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
    
    // Group by month within the year
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthlyPTO: Record<string, number> = {}
    
    // Initialize all months to 0
    monthOrder.forEach(month => {
      monthlyPTO[month] = 0
    })
    
    // Aggregate PTO hours by month
    for (const entry of (ptoEntries as any[]) || []) {
      const date = new Date(entry.entry_date)
      const month = date.toLocaleString('default', { month: 'short' })
      const hours = parseFloat(entry.hours?.toString() || '0')
      
      monthlyPTO[month] += hours
    }
    
    // Calculate cumulative PTO for each month
    let cumulative = 0
    const ptoUsage = monthOrder.map(month => {
      cumulative += monthlyPTO[month]
      return {
        month,
        monthlyHours: monthlyPTO[month],
        cumulativeHours: cumulative
      }
    })
    
    return NextResponse.json({
      year: parseInt(year),
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
