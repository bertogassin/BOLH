# BOLH interaction hardening v4

This pass addresses Android/Termux preview reliability and expands the local demo into a stateful product walkthrough.

## Fixed

- Demo entry now uses native navigation after securely creating the local demo session.
- Password visibility has a stable dedicated control and an automated interaction test.
- Local/session storage access is guarded for restricted browser modes.
- Demo-created orders, cancellations and chat messages persist across page reloads.
- Demo APIs cover authentication, profile, orders, matches, bids, chat, cards, escrow, notifications, verification, documents, plans and plugins.
- Client and admin Termux commands explicitly use Webpack instead of unsupported Turbopack.
- Stable production-style Termux preview copies standalone assets correctly and binds only to `127.0.0.1`.
- Login received a premium dark glass treatment consistent with the main BOLH interface.

## Recommended Termux preview

```sh
cd ~/bolh-rust-first-upload/guardian/client-web
cp .env.local.example .env.local
npm install
rm -rf .next
npm run preview:termux
```

Open `http://127.0.0.1:3003/login`. Use **Explore demo without server**, or sign in with `demo@bolh.app` and any non-empty password.

`preview:termux` is slower to start than development mode because it creates a production Webpack build first, but it avoids Android development-runtime and hydration instability.

## Validation

- Client ESLint: passed without warnings.
- Client Webpack production build: passed, 30 routes.
- Admin ESLint: passed.
- Admin Webpack production build: passed, 13 routes.
- Client/admin production dependency audit: 0 vulnerabilities.
- Standalone server returned the login page and all sampled JavaScript chunks with HTTP 200.
- Secret-pattern and oversized-source scan: no exposed key/private-key findings.
- Rust/Go source was unchanged in this pass; their toolchains were unavailable in the audit environment.
