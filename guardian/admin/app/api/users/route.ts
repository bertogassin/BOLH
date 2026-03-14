import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') ?? ''
  const filter = searchParams.get('filter') ?? 'all'
  const token = request.cookies.get('guardian_admin_token')?.value?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const target = new URL(`${apiBase}/api/v1/admin/users`)
  if (search) target.searchParams.set('search', search)
  if (filter && filter !== 'all') target.searchParams.set('filter', filter)

  try {
    const res = await fetch(target.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || 'Failed to load users' },
        { status: res.status }
      )
    }

    const rawUsers = Array.isArray((data as { users?: unknown[] }).users)
      ? ((data as { users: unknown[] }).users as Array<Record<string, unknown>>)
      : Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : []

    const users = rawUsers.map((u) => ({
      id: String(u.id ?? ''),
      firstName: String(u.first_name ?? u.firstName ?? ''),
      lastName: String(u.last_name ?? u.lastName ?? ''),
      email: String(u.email ?? ''),
      userType: String(u.user_type ?? u.userType ?? ''),
      verified: Boolean(u.verified),
      blocked: Boolean(u.blocked ?? false),
      reputationScore: Number(u.reputation_score ?? u.reputationScore ?? 0),
      completedOrders: Number(u.completed_orders ?? u.completedOrders ?? 0),
      createdAt: String(u.created_at ?? u.createdAt ?? ''),
    }))

    return NextResponse.json(users)
  } catch {
    return NextResponse.json({ error: 'Admin users backend unavailable' }, { status: 502 })
  }
}
