import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.QB_CLIENT_ID
  const redirectUri = process.env.QB_REDIRECT_URI || 'http://localhost:3000/api/qb-time/callback'
  
  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(7)
  
  // QuickBooks OAuth2 authorization URL
  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', clientId!)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  
  return NextResponse.redirect(authUrl.toString())
}
