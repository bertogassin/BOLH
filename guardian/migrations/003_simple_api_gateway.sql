-- Simplified schema for API Gateway in-memory parity (no PostGIS).
-- Run after 002 if you use full schema, or standalone for local dev.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS gateway_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('client', 'guard', 'agency')),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_users_email ON gateway_users(email);

CREATE TABLE IF NOT EXISTS gateway_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    required_licenses TEXT[],
    budget_min DECIMAL(12,2) NOT NULL,
    budget_max DECIMAL(12,2) NOT NULL,
    latitude DECIMAL(12,6) NOT NULL,
    longitude DECIMAL(12,6) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    guard_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_orders_client ON gateway_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_gateway_orders_status ON gateway_orders(status);

CREATE TABLE IF NOT EXISTS gateway_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guard_id UUID NOT NULL,
    title TEXT NOT NULL,
    licenses TEXT[],
    price_per_hour DECIMAL(12,2) NOT NULL,
    latitude DECIMAL(12,6),
    longitude DECIMAL(12,6),
    radius_km DECIMAL(8,2),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_bids_guard ON gateway_bids(guard_id);
CREATE INDEX IF NOT EXISTS idx_gateway_bids_active ON gateway_bids(active);

CREATE TABLE IF NOT EXISTS gateway_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    bid_id UUID NOT NULL,
    guard_id UUID NOT NULL,
    final_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_matches_order ON gateway_matches(order_id);
