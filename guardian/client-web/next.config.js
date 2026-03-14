/** @type {import('next').NextConfig} */
const buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID || process.env.GITHUB_SHA || 'dev'
const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
const connectSrc =
  process.env.NODE_ENV === 'production'
    ? "connect-src 'self' https: wss:"
    : "connect-src 'self' https: http: ws: wss:"

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  connectSrc,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'X-App-Build', value: buildId },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/next/:path*',
        destination: '/_next/:path*',
      },
    ]
  },
  webpack: (config, { dev }) => {
    if (dev && process.env.NEXT_FORCE_POLLING === '1') {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      }
    }
    return config
  },
}
module.exports = nextConfig
