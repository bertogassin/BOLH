import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 py-12">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          The page you requested does not exist or is no longer available.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Return home
        </Link>
      </section>
    </main>
  )
}
