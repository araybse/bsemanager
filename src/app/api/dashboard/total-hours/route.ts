import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Use service role for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Get time entries grouped by year and month
    // Only include approved entries up to current date
    const { data: entries, error } = await supabase
      .from('time_entries')
      .select('entry_date, hours')
      .eq('employee_id', userId)
      .eq('status', 'approved')
      .lte('entry_date', new Date().toISOString().split('T')[0])
      .order('entry_date', { ascending: true })

    if (error) throw error

    // Group by year and month, ensuring proper numeric addition
    const yearlyData: Record<number, Record<string, number>> = {}

    entries?.forEach(entry => {
      const date = new Date(entry.entry_date)
      const year = date.getFullYear()
      const month = date.toLocaleString('default', { month: 'short' })
      const hours = parseFloat(entry.hours?.toString() || '0')

      if (!yearlyData[year]) {
        yearlyData[year] = {}
      }
      if (!yearlyData[year][month]) {
        yearlyData[year][month] = 0
      }
      yearlyData[year][month] += hours
    })

    // Format for chart - calculate cumulative hours from year start
    // Only include months that have occurred (have data)
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const formattedData = Object.entries(yearlyData).map(([year, months]) => {
      let cumulativeHours = 0
      const monthlyHours: Array<{ month: string; hours: number }> = []
      
      // Only include months with data
      for (const month of monthOrder) {
        if (months[month]) {
          const monthHours = months[month] || 0
          cumulativeHours += monthHours
          monthlyHours.push({
            month,
            hours: cumulativeHours  // Cumulative from January
          })
        } else if (monthlyHours.length === 0) {
          // If no months have data yet, skip until we find the first month with data
          continue
        } else {
          // Once we've started, stop at the first month without data (don't show future months)
          break
        }
      }
      
      return {
        year: parseInt(year),
        monthlyHours
      }
    })

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching total hours data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch total hours data' },
      { status: 500 }
    )
  }
}
