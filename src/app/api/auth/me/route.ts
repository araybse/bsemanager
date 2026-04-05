import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    const timeoutResult = {
      data: { user: null },
      error: new Error('Supabase auth timeout'),
    }

    const { data: { user }, error: userError } = (await Promise.race([
      supabase.auth.getUser(),
      new Promise(resolve => setTimeout(() => resolve(timeoutResult), 3000)),
    ])) as { data: { user: { id: string; email?: string } | null }, error: Error | null }

    if (userError || !user) {
      return NextResponse.json({ user: null, profile: null }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch assigned project IDs (PM or team member)
    let assignedProjectIds: number[] = []
    
    if (profile?.role === 'admin') {
      // Admins see all projects (will be filtered elsewhere if needed)
      assignedProjectIds = []
    } else if (profile?.role === 'project_manager' || profile?.role === 'employee') {
      // Get projects where user is PM
      const { data: pmProjects, error: pmError } = await supabase
        .from('projects')
        .select('id')
        .eq('pm_id', user.id)

      // Get projects where user is team member
      const { data: teamProjects, error: teamError } = await supabase
        .from('project_team_assignments')
        .select('project_id')
        .eq('user_id', user.id)

      if (!pmError && pmProjects) {
        assignedProjectIds = [...new Set([
          ...assignedProjectIds,
          ...pmProjects.map(p => p.id),
        ])]
      }

      if (!teamError && teamProjects) {
        assignedProjectIds = [...new Set([
          ...assignedProjectIds,
          ...teamProjects.map(p => p.project_id),
        ])]
      }
    }

    return NextResponse.json({ user, profile, assignedProjectIds })
  } catch (error) {
    return NextResponse.json({ user: null, profile: null }, { status: 401 })
  }
}
