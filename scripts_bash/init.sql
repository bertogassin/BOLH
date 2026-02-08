-- Guardio Rapidos - Database Schema
-- PostgreSQL with PostGIS for geolocation

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'guard', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guards table (extends users)
CREATE TABLE IF NOT EXISTS guards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_orders INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    price_per_hour DECIMAL(10,2) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT FALSE,
    location GEOGRAPHY(POINT, 4326),
    bio TEXT,
    skills TEXT[],
    documents JSONB DEFAULT '[]',
    response_time_avg INT DEFAULT 5, -- minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT REFERENCES users(id),
    guard_id BIGINT REFERENCES guards(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    location GEOGRAPHY(POINT, 4326),
    address TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_hours INT NOT NULL,
    price_per_hour DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    client_id BIGINT REFERENCES users(id),
    guard_id BIGINT REFERENCES guards(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KZT',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    provider VARCHAR(50),
    provider_tx_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOS Events table
CREATE TABLE IF NOT EXISTS sos_events (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    triggered_by BIGINT REFERENCES users(id),
    location GEOGRAPHY(POINT, 4326),
    status VARCHAR(20) DEFAULT 'active',
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guards_location ON guards USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_guards_online ON guards(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_guard ON orders(guard_id);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

-- Function to update guard rating
CREATE OR REPLACE FUNCTION update_guard_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE guards
    SET rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE guard_id = NEW.guard_id
    ),
    updated_at = NOW()
    WHERE id = NEW.guard_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rating updates
DROP TRIGGER IF EXISTS trigger_update_rating ON reviews;
CREATE TRIGGER trigger_update_rating
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_guard_rating();

-- Sample data for testing
INSERT INTO users (phone, name, password_hash, role, is_verified) VALUES
    ('+77001234567', 'Test Client', '$2a$10$test', 'client', true),
    ('+77009876543', 'Test Guard', '$2a$10$test', 'guard', true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE users IS 'All users (clients, guards, admins)';
COMMENT ON TABLE guards IS 'Guard profiles with location and stats';
COMMENT ON TABLE orders IS 'Service orders between clients and guards';
