-- Guardian: полная схема (PostgreSQL + PostGIS). Индексы вынесены в CREATE INDEX.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- users
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('client', 'guard', 'agency')),
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    reputation_score DECIMAL(5,2) DEFAULT 0,
    completed_orders INT DEFAULT 0,
    cancelled_orders INT DEFAULT 0,
    response_rate DECIMAL(5,2),
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_reputation ON users(reputation_score DESC);

-- =====================================================
-- profiles
-- =====================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    avatar_url TEXT,
    birth_date DATE,
    bio TEXT,
    experience_years INT,
    passport_url TEXT,
    passport_verified BOOLEAN DEFAULT FALSE,
    company_name TEXT,
    tax_id TEXT,
    legal_address TEXT,
    license_number TEXT,
    language TEXT DEFAULT 'ru',
    timezone TEXT DEFAULT 'Europe/Moscow',
    notification_push BOOLEAN DEFAULT TRUE,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_sms BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_profiles_name ON profiles(last_name, first_name);

-- =====================================================
-- licenses
-- =====================================================
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guard_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_type TEXT NOT NULL CHECK (license_type IN (
        'weapon', 'medical', 'driving', 'aviation', 'maritime',
        'crowd_control', 'k9', 'technical'
    )),
    license_number TEXT NOT NULL,
    issued_by TEXT,
    issued_date DATE,
    expiry_date DATE NOT NULL,
    document_url TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licenses_guard ON licenses(guard_id);
CREATE INDEX idx_licenses_type ON licenses(license_type);
CREATE INDEX idx_licenses_expiry ON licenses(expiry_date);

-- =====================================================
-- orders
-- =====================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    required_licenses TEXT[],
    required_experience INT,
    guard_count INT DEFAULT 1,
    budget_min DECIMAL(10,2) NOT NULL CHECK (budget_min >= 0),
    budget_max DECIMAL(10,2) NOT NULL CHECK (budget_max >= budget_min),
    currency TEXT DEFAULT 'USD',
    location GEOGRAPHY(POINT) NOT NULL,
    location_address TEXT,
    location_radius INT DEFAULT 100,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL CHECK (end_time > start_time),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open','matching','matched','accepted','in_progress','completed','cancelled','expired'
    )),
    matched_guard_id UUID,
    matched_agency_id UUID,
    final_price DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_time ON orders(start_time, end_time);
CREATE INDEX idx_orders_location ON orders USING GIST(location);
CREATE INDEX idx_orders_budget ON orders(budget_min, budget_max);

-- =====================================================
-- bids
-- =====================================================
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bidder_type TEXT NOT NULL CHECK (bidder_type IN ('guard', 'agency')),
    bidder_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    available_licenses TEXT[],
    work_location GEOGRAPHY(POINT),
    work_radius INT DEFAULT 5000,
    available_from TIME,
    available_to TIME,
    available_days INT[],
    price_per_hour DECIMAL(10,2) NOT NULL,
    price_per_day DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bids_bidder ON bids(bidder_type, bidder_id);
CREATE INDEX idx_bids_location ON bids USING GIST(work_location);
CREATE INDEX idx_bids_price ON bids(price_per_hour);
CREATE INDEX idx_bids_valid ON bids(valid_to);
CREATE INDEX idx_bids_active ON bids(active);

-- =====================================================
-- matches
-- =====================================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    bid_id UUID NOT NULL REFERENCES bids(id),
    guard_id UUID NOT NULL REFERENCES users(id),
    agency_id UUID,
    final_price DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    guard_payout DECIMAL(10,2) NOT NULL,
    agency_commission DECIMAL(10,2) DEFAULT 0,
    match_reason TEXT,
    match_score DECIMAL(5,2),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
        'created','notified','accepted','rejected','cancelled','completed'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_matches_order ON matches(order_id);
CREATE INDEX idx_matches_guard ON matches(guard_id);
CREATE INDEX idx_matches_status ON matches(status);

-- =====================================================
-- documents
-- =====================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('passport','license','certificate','photo','contract')),
    file_name TEXT NOT NULL,
    file_size INT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    hash_sha256 TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
