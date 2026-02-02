import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')
  
  if (error) {
    return NextResponse.redirect(new URL('/settings?error=' + error, request.url))
  }
  
  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
  }
  
  try {
    const clientId = process.env.QB_CLIENT_ID!
    const clientSecret = process.env.QB_CLIENT_SECRET!
    const redirectUri = process.env.QB_REDIRECT_URI || 'http://localhost:3000/api/qb-time/callback'
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url))
    }
    
    const tokens = await tokenResponse.json()
    
    // Calculate token expiration
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in)
    
    // Store tokens in database
    const supabase = createAdminClient()
    
    // Delete any existing settings and insert new ones
    await supabase.from('qb_settings').delete().neq('id' as never, 0 as never)
    
    const { error: insertError } = await supabase.from('qb_settings').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      realm_id: realmId,
      connected_at: new Date().toISOString(),
    } as never)
    
    if (insertError) {
      console.error('Failed to store tokens:', insertError)
      return NextResponse.redirect(new URL('/settings?error=storage_failed', request.url))
    }
    
    return NextResponse.redirect(new URL('/settings?success=connected', request.url))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=unknown', request.url))
  }
}
