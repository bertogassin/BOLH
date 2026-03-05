-- BOLH initial schema. PostgreSQL + PostGIS for geo.
-- Соответствует docs/BOLH_TECH_ARCHITECTURE.md и ABSOLUTE_STANDARD.md.

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Типы (в PostgreSQL 14+ можно использовать ENUM или CHECK)
-- Для совместимости с Citus используем TEXT + CHECK

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_type TEXT NOT NULL CHECK (user_type IN ('client', 'guard', 'agency')),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    reputation_score DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guards (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    rate DECIMAL(12,2) NOT NULL,
    availability JSONB DEFAULT '{"slots":[]}',
    location GEOGRAPHY(POINT),
    verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE agencies (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    commission_rate DECIMAL(5,4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1)
);

CREATE TABLE agency_guards (
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    PRIMARY KEY (agency_id, guard_id)
);

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
    license_type TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    document_url TEXT,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licenses_guard_type ON licenses(guard_id, license_type);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requirements JSONB NOT NULL DEFAULT '{}',
    budget_min DECIMAL(12,2) NOT NULL,
    budget_max DECIMAL(12,2) NOT NULL,
    location GEOGRAPHY(POINT),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','matched','in_progress','completed','cancelled')),
    visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all','verified_only','invite_only')),
    actual_price DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_orders_location ON orders USING GIST(location);
CREATE INDEX idx_orders_client ON orders(client_id);

CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bidder_type TEXT NOT NULL CHECK (bidder_type IN ('guard', 'agency')),
    bidder_id UUID NOT NULL,
    service_offer JSONB NOT NULL DEFAULT '{}',
    price DECIMAL(12,2) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bids_bidder ON bids(bidder_type, bidder_id);
CREATE INDEX idx_bids_valid_to ON bids(valid_to) WHERE active = TRUE;

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE RESTRICT,
    guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE RESTRICT,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    final_price DECIMAL(12,2) NOT NULL,
    platform_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('created','accepted_by_guard','in_progress','completed','cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_matches_order ON matches(order_id);
CREATE INDEX idx_matches_guard ON matches(guard_id);
CREATE INDEX idx_matches_status ON matches(status);
