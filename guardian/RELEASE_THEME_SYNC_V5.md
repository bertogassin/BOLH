# BOLH full theme and synchronization cleanup v5

## Improvements

- Central light/dark theme provider shared by every client route.
- Theme is applied before first paint, preventing flashes and route-to-route resets.
- Theme preference survives reloads and navigation.
- Map tiles now follow the selected application theme.
- Navigation, authentication, surfaces, inputs, overlays, borders and shadows use shared semantic tokens.
- Restored visual hierarchy for primary, muted, subtle and faint text instead of flattening every white-opacity utility to one color.
- Colored action buttons retain accessible white foreground in both themes.
- Premium login panel adapts to both themes.
- Admin console has its own persistent light/dark switch and pre-paint theme bootstrap.
- Removed unavailable languages from the profile picker instead of presenting disabled controls.
- Repaired mojibake punctuation, separators and euro symbols across locale files.
- Added theme persistence regression coverage for login, settings and map routes.

## Validation

- 32 locale JSON files parse successfully.
- 594 statically referenced translation keys are present in every locale file.
- Client ESLint, TypeScript and Webpack build passed (30 routes).
- Admin ESLint, TypeScript and Webpack build passed (13 routes).
- Client and admin production dependency audits report 0 vulnerabilities.
- `git diff --check` reports no whitespace errors.

## Termux

```sh
cd ~/bolh-rust-first-upload/guardian/client-web
cp .env.local.example .env.local
npm install
rm -r .next 2>/dev/null || true
npm run preview:termux
```

Open `http://127.0.0.1:3003/login` after the terminal prints `Ready`.
