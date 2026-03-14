import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_TOKEN_KEY = 'guardian_admin_token'
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/settings')
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(ADMIN_TOKEN_KEY)?.value?.trim()
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const protectedPath = isProtectedPath(pathname)

  const redirectToLogin = () => {
    const loginUrl = new URL('/login', request.url)
    if (protectedPath) {
      loginUrl.searchParams.set('next', pathname)
    }
    const response = NextResponse.redirect(loginUrl)
    response.cookies.set({
      name: ADMIN_TOKEN_KEY,
      value: '',
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
    })
    return response
  }

  const validateAdmin = async () => {
    if (!token) return false
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return false
      const data = (await res.json()) as { user_type?: string }
      return data.user_type === 'admin'
    } catch {
      return false
    }
  }

  if (isLoginPage && token) {
    const ok = await validateAdmin()
    if (ok) return NextResponse.redirect(new URL('/dashboard', request.url))
    return redirectToLogin()
  }

  if (protectedPath) {
    const ok = await validateAdmin()
    if (ok) return NextResponse.next()
    return redirectToLogin()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/settings/:path*'],
}
