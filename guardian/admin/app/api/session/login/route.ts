import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'guardian_admin_token'

type UserShape = { id: string; email: string; user_type: string }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }
  const apiBase = process.env.ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  try {
    const upstream = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    })
    const data = await upstream.json().catch(() => ({})) as { token?: string; user?: UserShape; error?: string }
    if (!upstream.ok || !data.token) {
      return NextResponse.json({ error: data.error || 'Login failed' }, { status: upstream.status || 401 })
    }
    if (data.user?.user_type !== 'admin') {
      return NextResponse.json({ error: 'Access denied: admin role required' }, { status: 403 })
    }
    const response = NextResponse.json({ user: data.user })
    response.cookies.set({ name: COOKIE_NAME, value: data.token, httpOnly: true,
      secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 8 })
    return response
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 502 })
  }
}
