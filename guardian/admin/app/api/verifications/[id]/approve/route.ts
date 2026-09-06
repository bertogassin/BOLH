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

  const apiBase =
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'

  try {
    const res = await fetch(
      `${apiBase}/api/v1/admin/verifications/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      }
    )

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ||
            'Failed to approve verification',
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
