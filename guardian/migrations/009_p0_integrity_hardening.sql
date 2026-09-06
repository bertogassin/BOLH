-- P0 integrity hardening for the simple API gateway schema.
-- Preflight orphan checks are included as comments; run them before applying to an existing production DB.
-- SELECT client_id FROM gateway_orders o LEFT JOIN gateway_users u ON u.id=o.client_id WHERE u.id IS NULL;
-- SELECT guard_id FROM gateway_bids b LEFT JOIN gateway_users u ON u.id=b.guard_id WHERE u.id IS NULL;
-- SELECT order_id FROM gateway_matches m LEFT JOIN gateway_orders o ON o.id=m.order_id WHERE o.id IS NULL;

ALTER TABLE gateway_users DROP CONSTRAINT IF EXISTS gateway_users_user_type_check;
ALTER TABLE gateway_users ADD CONSTRAINT gateway_users_user_type_check
  CHECK (user_type IN ('client','guard','agency','admin'));

ALTER TABLE gateway_orders DROP CONSTRAINT IF EXISTS gateway_orders_status_check;
ALTER TABLE gateway_orders ADD CONSTRAINT gateway_orders_status_check
  CHECK (status IN ('draft','published','open','matching','matched','in_progress','completed','cancelled'));

ALTER TABLE gateway_orders
  ADD CONSTRAINT gateway_orders_client_fk FOREIGN KEY (client_id) REFERENCES gateway_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gateway_orders_budget_check CHECK (budget_min >= 0 AND budget_max >= budget_min),
  ADD CONSTRAINT gateway_orders_lat_check CHECK (latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT gateway_orders_lon_check CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT gateway_orders_guard_count_check CHECK (guard_count > 0),
  ADD CONSTRAINT gateway_orders_time_check CHECK (end_time > start_time);

ALTER TABLE gateway_bids
  ADD CONSTRAINT gateway_bids_guard_fk FOREIGN KEY (guard_id) REFERENCES gateway_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gateway_bids_price_check CHECK (price_per_hour >= 0),
  ADD CONSTRAINT gateway_bids_lat_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT gateway_bids_lon_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT gateway_bids_radius_check CHECK (radius_km IS NULL OR radius_km >= 0);


ALTER TABLE gateway_matches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offered';
ALTER TABLE gateway_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE gateway_matches DROP CONSTRAINT IF EXISTS gateway_matches_status_check;
ALTER TABLE gateway_matches ADD CONSTRAINT gateway_matches_status_check CHECK (status IN ('offered','accepted','rejected'));

ALTER TABLE gateway_matches
  ADD CONSTRAINT gateway_matches_order_fk FOREIGN KEY (order_id) REFERENCES gateway_orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT gateway_matches_bid_fk FOREIGN KEY (bid_id) REFERENCES gateway_bids(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gateway_matches_guard_fk FOREIGN KEY (guard_id) REFERENCES gateway_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gateway_matches_price_check CHECK (final_price >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gateway_matches_order_guard ON gateway_matches(order_id, guard_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gateway_matches_order_bid ON gateway_matches(order_id, bid_id);

CREATE TABLE IF NOT EXISTS gateway_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT UNIQUE,
  token_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_gateway_sessions_user ON gateway_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_gateway_sessions_active ON gateway_sessions(user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS gateway_escrow_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES gateway_orders(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  payment_method_hint TEXT,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('creating','authorized','released','cancelled','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gateway_escrow_order ON gateway_escrow_payments(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gateway_verification_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gateway_company_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_company_applications_user ON gateway_company_applications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gateway_guard_verified_licenses (
  guard_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
  license_code TEXT NOT NULL CHECK (length(trim(license_code)) BETWEEN 1 AND 100),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guard_id, license_code)
);
CREATE INDEX IF NOT EXISTS idx_gateway_guard_verified_licenses_guard ON gateway_guard_verified_licenses(guard_id);

CREATE TABLE IF NOT EXISTS gateway_token_revocations (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gateway_token_revocations_exp ON gateway_token_revocations(expires_at);

CREATE TABLE IF NOT EXISTS gateway_user_revocations (
  user_id UUID PRIMARY KEY REFERENCES gateway_users(id) ON DELETE CASCADE,
  revoked_before TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_signed_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gateway_signed_nonces_exp ON gateway_signed_nonces(expires_at);

ALTER TABLE gateway_verification_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE gateway_verification_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE gateway_verification_requests DROP CONSTRAINT IF EXISTS gateway_verification_requests_status_check;
ALTER TABLE gateway_verification_requests ADD CONSTRAINT gateway_verification_requests_status_check
  CHECK (status IN ('pending','under_review','approved','rejected'));

ALTER TABLE gateway_verification_artifacts
  ADD CONSTRAINT gateway_verification_artifacts_request_fk
  FOREIGN KEY (verification_id) REFERENCES gateway_verification_requests(id) ON DELETE CASCADE;
