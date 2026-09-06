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

  const apiBase =
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'

  try {
    const res = await fetch(
      `${apiBase}/api/v1/admin/verifications/${encodeURIComponent(id)}/artifact`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ||
            'Failed to load verification document',
        },
        { status: res.status }
      )
    }

    const body = await res.arrayBuffer()
    const headers = new Headers()

    headers.set(
      'Content-Type',
      res.headers.get('content-type') || 'application/octet-stream'
    )

    const disposition = res.headers.get('content-disposition')
    if (disposition) {
      headers.set('Content-Disposition', disposition)
    }

    headers.set('Cache-Control', 'private, no-store')

    return new NextResponse(body, {
      status: 200,
      headers,
    })
  } catch {
    return NextResponse.json(
      { error: 'Verification document backend unavailable' },
      { status: 502 }
    )
  }
}
