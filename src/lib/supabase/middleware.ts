import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const timeoutResult = {
    data: { user: null },
    error: new Error('Supabase auth timeout'),
  }

  const { data: { user } } = (await Promise.race([
    supabase.auth.getUser(),
    new Promise(resolve => setTimeout(() => resolve(timeoutResult), 3000)),
  ])) as { data: { user: { id: string; email?: string } | null }, error: Error | null }

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/projects', '/contracts', '/invoices', '/unbilled', '/reimbursables', '/time-entries', '/rates', '/clients', '/proposals', '/cash-flow', '/contract-labor', '/settings']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Permission-based redirects for logged-in users
  if (user) {
    // Get user's role for permission checks
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = (profile as { role: string } | null)?.role

    // Redirect employees away from dashboard
    if (userRole === 'employee' && request.nextUrl.pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/timesheet'
      return NextResponse.redirect(url)
    }

    // Redirect non-admin users away from admin-only pages
    if (userRole !== 'admin') {
      const adminOnlyPaths = ['/accounting', '/cash-flow', '/contract-labor', '/proposals', '/time-entries']
      if (adminOnlyPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
        const url = request.nextUrl.clone()
        url.pathname = userRole === 'employee' ? '/timesheet' : '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Redirect logged in users away from login page
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirect root to dashboard if logged in, otherwise to login
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } else {
    // Not logged in - redirect root to login
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
