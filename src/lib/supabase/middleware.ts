import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUSTIN_BURKE_EMAIL = 'aburke@blackstoneeng.com'
const AUSTIN_BURKE_ALLOWED_PATHS = ['/projects', '/settings']

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

  // Redirect logged in users away from login page
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname =
      user.email?.toLowerCase() === AUSTIN_BURKE_EMAIL ? '/projects' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // Redirect root to dashboard if logged in, otherwise to login
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    if (!user) {
      url.pathname = '/login'
    } else {
      url.pathname =
        user.email?.toLowerCase() === AUSTIN_BURKE_EMAIL ? '/projects' : '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Temporary per-user visibility gate for Austin Burke.
  // He can only access /projects and /settings page trees.
  if (
    user?.email?.toLowerCase() === AUSTIN_BURKE_EMAIL &&
    !request.nextUrl.pathname.startsWith('/api') &&
    !AUSTIN_BURKE_ALLOWED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/projects'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
