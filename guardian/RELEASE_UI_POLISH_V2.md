# BOLH interface polish v2

## User-facing improvements

- A new premium access screen with a clear login and registration hierarchy.
- One shared glass navigation component replaces duplicate bottom navigation code.
- The live map now has operational counters, refresh/retry states and high-contrast markers.
- Orders use the same dark visual system as booking, map and profile.
- International pricing is displayed in EUR instead of the previous hard-coded RUB symbol.
- Overnight security missions such as 22:00–00:00 are now valid and end on the next day.
- Reduced-motion preferences, safe areas, touch targets and keyboard focus are supported.
- Android/Termux has a dedicated `npm run dev:termux` command using Webpack.

## Verification

- Client lint: passed.
- Client production build: passed (30 routes).
- npm audit: zero vulnerabilities.
- Translation coverage: 32 locales, 595 referenced keys, zero missing.
