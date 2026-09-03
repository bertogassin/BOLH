# BOLH local demo v3

This release adds a backend-free preview mode for the client application. It is explicitly opt-in and remains disabled by default.

## Termux preview

```sh
cd ~/bolh-rust-first-upload/guardian/client-web
cp .env.local.example .env.local
npm install
npm run dev:termux
```

Open `http://127.0.0.1:3003/login` and choose **Explore demo without server**.

The demo includes a local user, orders, map markers, bids, matches, chat, payment card, escrow, notifications, verification, documents, planning and plugin data. Changes are temporary and intended for interface evaluation only.

## Production safety

- `NEXT_PUBLIC_DEMO_MODE` defaults to disabled.
- Never set `NEXT_PUBLIC_DEMO_MODE=1` in a public deployment.
- Demo mode does not replace the API Gateway, PostgreSQL, payment provider, SMS provider or object storage.

## Validation

- Client ESLint: passed.
- Client production build: passed (30 routes).
- Client production dependency audit: 0 vulnerabilities.
- Rust and Go were not revalidated in this UI-only pass because their toolchains were unavailable in the build workspace; their source was not changed.
