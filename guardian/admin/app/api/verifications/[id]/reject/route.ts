import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const token = request.cookies.get('guardian_admin_token')?.value?.trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const reason =
    typeof (body as { reason?: unknown }).reason === 'string'
      ? (body as { reason: string }).reason.trim()
      : ''

  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json(
      { error: 'Reason must contain between 3 and 500 characters' },
      { status: 400 }
    )
  }

  const apiBase =
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'

  try {
    const res = await fetch(
      `${apiBase}/api/v1/admin/verifications/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ||
            'Failed to reject verification',
        },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Verification backend unavailable' },
      { status: 502 }
    )
  }
}
