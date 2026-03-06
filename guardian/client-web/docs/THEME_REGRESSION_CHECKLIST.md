# Light Theme Regression Checklist

Use this checklist before merging any UI theme changes.

## Core Surfaces
- [ ] `theme-page` and `theme-header` are used on top-level screens.
- [ ] Primary cards use `theme-surface`; secondary sections use `theme-surface-soft`.
- [ ] There are no hardcoded dark backgrounds (`#1a1b26`, `bg-black`) in new screens.

## Typography and Contrast
- [ ] Main text remains readable in both dark and light modes.
- [ ] Supporting text uses `theme-text-muted` and still passes contrast checks.
- [ ] Placeholder text remains visible in both themes.

## Controls and States
- [ ] Buttons and links have visible hover states in both themes.
- [ ] Keyboard `focus-visible` ring appears on all interactive controls.
- [ ] Error states use `aria-invalid='true'` on invalid inputs.

## Feature Areas
- [ ] Bottom navigation (`BOLHNav`) remains readable in both themes.
- [ ] Notifications popover and list rows remain readable in both themes.
- [ ] Address autocomplete input, history panel, and suggestions remain readable.
- [ ] Legal and error pages use themed surfaces, not hardcoded dark cards.

## Map and Plugins
- [ ] Leaflet zoom/control buttons are readable in light mode.
- [ ] Marker popups remain readable and do not blend into the map.

## QA Sweep
- [ ] Test `booking`, `profile`, `settings`, `legal`, and error screens in dark + light.
- [ ] Validate mobile viewport (iPhone/Android widths) with keyboard focus navigation.
- [ ] Run `npm run lint` and ensure no new warnings from changed files.
