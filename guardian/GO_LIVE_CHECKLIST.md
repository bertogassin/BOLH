# Guardian Go-Live Checklist

Public launch readiness checklist with priorities.

## P0 (Must be done before public)

- [x] Remove fake admin users data from UI/API routes (no mock fallback in production path).
- [x] Validate admin session in middleware via backend `auth/me` and enforce `user_type=admin`.
- [x] Implement backend endpoints used by admin users:
  - `GET /api/v1/admin/users`
  - `GET /api/v1/admin/users/:id`
- [x] Replace dashboard/analytics hardcoded metrics with real API data.
- [x] Replace admin settings placeholder with real controls (or hide route from nav until ready).
- [ ] Run full smoke in production-like environment:
  - client login/register
  - booking -> order create -> order details -> cancel -> chat
  - admin login -> users list -> user details
- [ ] Confirm backend availability from frontend environment:
  - `NEXT_PUBLIC_API_URL` points to reachable API
  - `/health` is green from deployed frontend network
- [ ] Security gate:
  - no client-writable admin auth bypass
  - cookie/token expiry and logout invalidation verified
  - CORS/cookie policy verified for deployment domain

## P1 (Strongly recommended in first release wave)

- [x] Add admin smoke e2e (login page render, auth guard redirect, admin API key route checks).
- [x] Add admin e2e tests (users list/details, auth guard, logout).
- [ ] Add visual regression checks for dark/light themes.
- [ ] WCAG AA pass for critical screens:
  - login/register
  - booking
  - orders/details
  - profile/settings
  - admin dashboard/users
- [ ] Remove or clearly label "in development" sections if still inaccessible.
- [ ] Add uptime/error telemetry dashboard and alert thresholds.

## P2 (Post-launch improvements)

- [ ] CSV export in admin users.
- [ ] Rich analytics in admin (period-driven API, export).
- [ ] Fine-grained role-based access in admin actions.
- [ ] Broader e2e coverage and load tests.

## Launch Decision

- **GO** only if all P0 items are completed and signed off.
- **NO-GO** if any P0 item remains open.
