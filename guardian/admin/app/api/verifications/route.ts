import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('guardian_admin_token')?.value?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiBase =
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'

  try {
    const res = await fetch(`${apiBase}/api/v1/admin/verifications`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ||
            'Failed to load verifications',
        },
        { status: res.status }
      )
    }

    const requests = Array.isArray(
      (data as { requests?: unknown[] }).requests
    )
      ? (data as { requests: unknown[] }).requests
      : []

    return NextResponse.json({ requests })
  } catch {
    return NextResponse.json(
      { error: 'Verification backend unavailable' },
      { status: 502 }
    )
  }
}
