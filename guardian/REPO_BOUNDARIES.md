# Repository Boundaries

This document keeps architecture clean across repositories.

## Ownership

- `OMNIXIUS` repository:
  - Hub/navigation site
  - Cross-app links and bridge contracts
  - No product-specific implementation from BOLH/IXIMAIL

- `BOLH` repository:
  - Guardian product code (web, API, mobile)
  - All booking/order/mission UI and backend logic

- `IXIMAIL` repository:
  - Messaging/mail product code
  - Mail UI/backend and SSO bridge consume logic

## Rule of change

- Product behavior changes must be committed in that product's repository.
- Hub links and integration docs belong in `OMNIXIUS`.
- Shared protocols belong in contract documents, not in duplicated business code.

## Deployment strategy

- `staging` branch and staging app for verification
- `main` branch and production app for live users
- Never test experimental UI directly in production
