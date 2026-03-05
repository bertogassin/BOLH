import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') ?? ''
  const filter = searchParams.get('filter') ?? 'all'
  // Stub: return mock list (real impl would call backend)
  const users = [
    {
      id: '1',
      firstName: 'Иван',
      lastName: 'Петров',
      email: 'ivan@example.com',
      userType: 'client',
      verified: true,
      blocked: false,
      reputationScore: 4.8,
      completedOrders: 12,
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      firstName: 'Алексей',
      lastName: 'Сидоров',
      email: 'alex@example.com',
      userType: 'guard',
      verified: true,
      blocked: false,
      reputationScore: 4.9,
      completedOrders: 124,
      createdAt: '2024-02-01',
    },
  ]
  return NextResponse.json(users)
}
