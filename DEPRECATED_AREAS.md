# Deprecated Areas (Migration in Progress)

The following areas are legacy-source and should not receive net-new backend
runtime features.

## Deprecated for net-new backend work

- `guardian/services/api-gateway/handlers/cards.go` -> `payment-gateway`
- `guardian/migrations/004_payment_cards.sql` -> `payment-gateway`
- legacy access-control logic -> `core-permissions`
- generic notification paths -> `notification-routing`

## Allowed temporary changes

- migration-critical hotfixes
- parity verification and extraction support
