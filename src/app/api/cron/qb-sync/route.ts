import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

/**
 * Automated QuickBooks Sync Cron Job
 * 
 * Runs every 15 minutes via Vercel Cron
 * Syncs:
 * - QB Time data (customers, projects, invoices, time entries, payments, expenses, contract labor)
 * - Accounting snapshots (P&L and Balance Sheet for current month)
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const results: Record<string, unknown> = {}

    // Check if QuickBooks is connected
    const { data: settings } = await supabase
      .from('settings' as never)
      .select('id, qb_realm_id, qb_access_token')
      .single()

    const typedSettings = settings as { id: number; qb_realm_id?: string; qb_access_token?: string } | null

    if (!typedSettings?.qb_realm_id || !typedSettings?.qb_access_token) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        message: 'QuickBooks not connected - skipping sync',
      })
    }

    console.log('[Cron QB Sync] Starting automated sync...')

    // 1. Sync QB Time data (all domains)
    try {
      const qbTimeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/qb-time/sync?trigger=scheduled`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
      })

      if (qbTimeResponse.ok) {
        const qbTimeData = await qbTimeResponse.json()
        results.qbTime = qbTimeData
        console.log('[Cron QB Sync] ✅ QB Time sync completed')
      } else {
        const error = await qbTimeResponse.text()
        results.qbTime = { error, status: qbTimeResponse.status }
        console.error('[Cron QB Sync] ❌ QB Time sync failed:', error)
      }
    } catch (error) {
      results.qbTime = { error: error instanceof Error ? error.message : 'Unknown error' }
      console.error('[Cron QB Sync] ❌ QB Time sync error:', error)
    }

    // 2. Sync current month AND previous month P&L (Cash basis)
    // Previous month is included to catch late categorizations/matches
    try {
      const now = new Date()
      const plResults: Record<string, unknown> = {}
      
      // Sync previous month
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevYear = prevMonthDate.getFullYear()
      const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
      const prevStartDate = `${prevYear}-${prevMonth}-01`
      const prevLastDay = new Date(prevYear, prevMonthDate.getMonth() + 1, 0).getDate()
      const prevEndDate = `${prevYear}-${prevMonth}-${String(prevLastDay).padStart(2, '0')}`

      const prevPlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/accounting/profit-loss/sync?start_date=${prevStartDate}&end_date=${prevEndDate}&basis=Cash`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      )

      if (prevPlResponse.ok) {
        plResults.previousMonth = await prevPlResponse.json()
        console.log('[Cron QB Sync] ✅ Previous month P&L sync completed')
      } else {
        const error = await prevPlResponse.text()
        plResults.previousMonth = { error, status: prevPlResponse.status }
        console.error('[Cron QB Sync] ❌ Previous month P&L sync failed:', error)
      }
      
      // Sync current month
      const currYear = now.getFullYear()
      const currMonth = String(now.getMonth() + 1).padStart(2, '0')
      const currStartDate = `${currYear}-${currMonth}-01`
      const currLastDay = new Date(currYear, now.getMonth() + 1, 0).getDate()
      const currEndDate = `${currYear}-${currMonth}-${String(currLastDay).padStart(2, '0')}`

      const currPlResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/accounting/profit-loss/sync?start_date=${currStartDate}&end_date=${currEndDate}&basis=Cash`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      )

      if (currPlResponse.ok) {
        plResults.currentMonth = await currPlResponse.json()
        console.log('[Cron QB Sync] ✅ Current month P&L sync completed')
      } else {
        const error = await currPlResponse.text()
        plResults.currentMonth = { error, status: currPlResponse.status }
        console.error('[Cron QB Sync] ❌ Current month P&L sync failed:', error)
      }
      
      results.profitLoss = plResults
    } catch (error) {
      results.profitLoss = { error: error instanceof Error ? error.message : 'Unknown error' }
      console.error('[Cron QB Sync] ❌ P&L sync error:', error)
    }

    // 3. Sync current month AND previous month Balance Sheet (Accrual basis)
    try {
      const now = new Date()
      const bsResults: Record<string, unknown> = {}
      
      // Sync previous month-end Balance Sheet
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevYear = prevMonthDate.getFullYear()
      const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0')
      const prevLastDay = new Date(prevYear, prevMonthDate.getMonth() + 1, 0).getDate()
      const prevEndDate = `${prevYear}-${prevMonth}-${String(prevLastDay).padStart(2, '0')}`

      const prevBsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/accounting/balance-sheet/sync?as_of=${prevEndDate}&basis=Accrual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      )

      if (prevBsResponse.ok) {
        bsResults.previousMonth = await prevBsResponse.json()
        console.log('[Cron QB Sync] ✅ Previous month Balance Sheet sync completed')
      } else {
        const error = await prevBsResponse.text()
        bsResults.previousMonth = { error, status: prevBsResponse.status }
        console.error('[Cron QB Sync] ❌ Previous month Balance Sheet sync failed:', error)
      }
      
      // Sync current month-end Balance Sheet
      const currYear = now.getFullYear()
      const currMonth = String(now.getMonth() + 1).padStart(2, '0')
      const currLastDay = new Date(currYear, now.getMonth() + 1, 0).getDate()
      const currEndDate = `${currYear}-${currMonth}-${String(currLastDay).padStart(2, '0')}`

      const currBsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/accounting/balance-sheet/sync?as_of=${currEndDate}&basis=Accrual`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      )

      if (currBsResponse.ok) {
        bsResults.currentMonth = await currBsResponse.json()
        console.log('[Cron QB Sync] ✅ Current month Balance Sheet sync completed')
      } else {
        const error = await currBsResponse.text()
        bsResults.currentMonth = { error, status: currBsResponse.status }
        console.error('[Cron QB Sync] ❌ Current month Balance Sheet sync failed:', error)
      }
      
      results.balanceSheet = bsResults
    } catch (error) {
      results.balanceSheet = { error: error instanceof Error ? error.message : 'Unknown error' }
      console.error('[Cron QB Sync] ❌ Balance Sheet sync error:', error)
    }

    // Log the cron run
    await supabase
      .from('cron_runs')
      .insert({
        job_name: 'qb-sync',
        status: 'success',
        results,
      } as never)

    console.log('[Cron QB Sync] ✅ Automated sync completed')

    return NextResponse.json({
      ok: true,
      message: 'QuickBooks sync completed',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron QB Sync] Fatal error:', error)
    
    // Log failure
    const supabase = createAdminClient()
    await supabase
      .from('cron_runs')
      .insert({
        job_name: 'qb-sync',
        status: 'failed',
        results: { error: error instanceof Error ? error.message : 'Unknown error' },
      } as never)

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Automated sync failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
