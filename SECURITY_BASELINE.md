# SECURITY_BASELINE

## Scope

Wave-3 security baseline for $r.

## Repository Snapshot

- Primary language: TypeScript
- Baseline profile: secret scanning + dependency/build checks

## Requirements

- CI secret scanning enabled on every PR/push.
- Dependency vulnerability checks enabled for detected stack.
- Build/lint checks run before merge.
- Security-relevant changes must include risk note, test plan, rollback note.
