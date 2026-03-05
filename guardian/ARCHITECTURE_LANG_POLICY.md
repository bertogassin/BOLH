# Architecture Language Policy

This document defines where each language is allowed in `guardian/` and how to introduce exceptions.

It is aligned with `ABSOLUTE_STANDARD.md` and is mandatory for all new code.

## 1. Language-to-layer mapping

- `Rust`:
  - Domain logic and critical-path services.
  - High-performance matching/scoring/indexing pipelines.
  - Security-sensitive logic where memory safety and predictable latency matter.
- `Go`:
  - API/Presentation layer, gateway, service orchestration.
  - Infrastructure adapters (DB, cache, queues, external APIs).
  - I/O-heavy microservices and integration endpoints.
- `TypeScript`:
  - Web UI only (`client-web`, `admin`).
  - UI state, routing, and presentation concerns.
- `Kotlin` / `Swift`:
  - Native mobile apps only.
  - Device capabilities, secure storage, biometrics, native UX.
- `Python`:
  - AI/ML experimentation, offline analytics, tooling.
  - Not allowed in request-time core business path.
- `C++`:
  - Only for unavoidable third-party/native integrations.
  - Must be isolated behind stable interfaces.

## 2. Explicitly forbidden

- New business-critical core logic in JavaScript/TypeScript/Python.
- Infrastructure imports in Domain.
- Cross-language coupling without clear API/FFI boundary.
- Adding a new language "for convenience" without approval.

## 3. Boundaries and integration rules

- Cross-language calls must go through one of:
  - Service API (HTTP/gRPC/event bus), or
  - Explicit FFI boundary with typed contracts.
- Keep payload schemas versioned and backward-compatible.
- Do not leak transport DTOs into Domain models.

## 4. Performance routing rule

When a flow is latency-critical or CPU-heavy:

1. Keep orchestration in `Go`.
2. Move algorithmic hot path to `Rust`.
3. Return only minimal typed result to caller.

## 5. Security routing rule

- Security checks and policy enforcement can exist in `Go` gateway.
- Cryptographic and sensitive transformations should prefer `Rust`.
- Secrets never hardcoded; only env/secret manager.

## 6. Change management (RFC required)

Any proposal to add a language, or move logic across language boundaries, must include:

- Problem statement and expected gain (latency, throughput, safety, delivery speed).
- Alternatives considered.
- Operational impact (build, CI, observability, on-call).
- Rollback strategy.
- Ownership and long-term maintenance plan.

Without this RFC, change is rejected in review.

## 7. PR acceptance checklist (language)

A PR is merge-ready only if:

- Language choice matches layer responsibility.
- No forbidden dependencies across architecture layers.
- No core logic introduced in non-approved language.
- Contracts between services/languages are typed and tested.
- Security and performance implications are documented.
