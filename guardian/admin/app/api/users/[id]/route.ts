import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.cookies.get('guardian_admin_token')?.value?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const target = `${apiBase}/api/v1/admin/users/${encodeURIComponent(id)}`

  try {
    const res = await fetch(target, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || 'Failed to load user' },
        { status: res.status }
      )
    }

    const raw = data as Record<string, unknown>
    const user = {
      id: String(raw.id ?? id),
      firstName: String(raw.first_name ?? raw.firstName ?? ''),
      lastName: String(raw.last_name ?? raw.lastName ?? ''),
      email: String(raw.email ?? ''),
      phone: raw.phone ? String(raw.phone) : undefined,
      userType: String(raw.user_type ?? raw.userType ?? ''),
      verified: Boolean(raw.verified),
      createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    }
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Admin user backend unavailable' }, { status: 502 })
  }
}
