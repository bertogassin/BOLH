import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  // Stub: return mock user
  const user = {
    id,
    firstName: 'Иван',
    lastName: 'Петров',
    email: 'ivan@example.com',
    userType: 'client',
    verified: true,
    createdAt: '2024-01-15',
  }
  return NextResponse.json(user)
}
