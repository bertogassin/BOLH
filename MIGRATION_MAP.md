# BOLH Migration Map

## Target repositories

- Payments and cards domain -> `payment-gateway`
- Identity/access roles -> `core-permissions`
- Notifications fanout -> `notification-routing`
- Shared user/auth integrations -> `core-users`, `core-auth`

## Current status

- Wave 2 payment legacy references imported to `payment-gateway`.
- Remaining domains move by bounded context waves.

## Cleanup rule

No new backend modules in this repository except migration-critical fixes.
All net-new implementation must be created in target repositories.
