# Release Checklist

Use this checklist for every `staging` and `production` release.

## 1) Validate code quality

- `cargo test --workspace --no-fail-fast`
- `cd services/api-gateway && go test ./... && go vet ./...`
- `cd client-web && npm ci && npm run lint && npm run build`

## 2) Smoke test key user flow

- Login works
- `/booking` renders correctly
- Create order works end-to-end
- Notifications and map open without frontend errors

## 3) Verify deployment target

- Confirm branch (`staging` or `main`)
- Confirm app spec (`.do/app-staging.yaml` or `.do/app.yaml`)
- Confirm environment variables are correct

## 4) Verify runtime version

- Web UI shows `build <id>` badge
- `GET /health` returns expected `build_id` and `commit`
- Compare commit shown in runtime with GitHub commit

## 5) Post-release monitoring and rollback

- Watch logs and error rate for 15-30 minutes
- Track `401/403/429` trends on auth/signed routes
- If regressions appear, rollback immediately using previous deploy revision
