# Rust-first Policy

## Core rule

All backend/runtime services are Rust-first by default.

## Allowed language zones

- Rust: backend services, gateways, event processing, security-critical logic
- Swift: iOS and Apple platform clients
- TypeScript: web frontend and UI tooling
- Python: ML, analytics, automation scripts

## Temporary non-Rust exceptions

Any backend service that is not Rust must be temporary and tracked in:

- `overrides/temp-language-overrides.yaml`

Each override must include:

- service name
- current language
- business/technical reason
- owner
- expiration date
- migration target milestone

## Pull request requirement

If a backend change introduces a non-Rust component and no active override
exists, the PR must be rejected.

## Rewrite preference (mandatory)

When backend/runtime code is being migrated or substantially modified, prefer
rewriting to Rust whenever this does not reduce quality, security, reliability,
or performance.