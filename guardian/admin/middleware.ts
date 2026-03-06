import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_TOKEN_KEY = 'guardian_admin_token'

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/settings')
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(ADMIN_TOKEN_KEY)?.value
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const protectedPath = isProtectedPath(pathname)

  if (!token && protectedPath) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/settings/:path*'],
}
