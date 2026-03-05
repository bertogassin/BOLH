## Summary

- What changed and why?

## Architecture and Language Checklist

- [ ] Layering respected: Domain -> Application -> Infrastructure -> Presentation.
- [ ] No Infrastructure dependency imported into Domain.
- [ ] Language choice follows `ARCHITECTURE_LANG_POLICY.md`.
- [ ] No new core business logic added in non-approved language.
- [ ] Cross-service / cross-language boundary uses typed contract (API/FFI), not ad-hoc coupling.
- [ ] No hardcoded secrets, keys, or credentials.

## Security Checklist

- [ ] Input validation is done at Presentation boundary.
- [ ] Sensitive paths reviewed for authz/authn impact.
- [ ] Error messages do not leak sensitive internals.

## Performance Checklist

- [ ] Hot-path changes evaluated for latency/throughput impact.
- [ ] Heavy algorithmic logic stays in Rust where applicable.
- [ ] Added/updated caching strategy documented (if relevant).

## Testing Checklist

- [ ] Unit tests added/updated.
- [ ] Integration tests added/updated (if relevant).
- [ ] Existing critical E2E flows remain green.
- [ ] Lint/format checks pass for touched languages.

## Rollout / Ops Notes

- Feature flags, env vars, migration steps, and rollback notes (if required).
