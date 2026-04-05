import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireApiAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as { role: string | null } | null)?.role || null

  return {
    ok: true as const,
    user: {
      id: user.id,
      email: user.email || '',
      role: role || 'employee',
    },
  }
}

export async function requireApiRoles(allowedRoles: string[], allowedEmails: string[] = []) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as { role: string | null } | null)?.role || null
  const userEmail = String(user.email || '').toLowerCase()
  const emailAllowed = allowedEmails.some((email) => email.toLowerCase() === userEmail)
  if ((!role || !allowedRoles.includes(role)) && !emailAllowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user,
    role,
  }
}
