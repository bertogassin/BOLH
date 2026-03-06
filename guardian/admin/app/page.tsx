import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Guardian Admin</h1>
      <p className="text-gray-500">Reliability. Speed. Security.</p>
      <Link
        href="/login"
        className="rounded-lg bg-guardian-blue px-6 py-3 text-white hover:opacity-90"
      >
        Sign in
      </Link>
    </div>
  )
}
