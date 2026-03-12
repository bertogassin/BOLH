# Cleanup Checklist (Post-Parity)

## Preconditions

- [ ] payment-card and payment flows parity in `payment-gateway`
- [ ] permissions/access parity in `core-permissions`
- [ ] notification parity in `notification-routing`

## Cleanup sequence

- [ ] Freeze moved modules in BOLH legacy paths
- [ ] Remove moved backend modules only after parity sign-off
- [ ] Keep migration documentation and references

## Rust rewrite priority rule

When touching migrated backend domains, prefer Rust rewrites in target services
if there is no expected regression in quality, security, or performance.
