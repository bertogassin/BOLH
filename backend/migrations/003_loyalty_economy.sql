CREATE TABLE IF NOT EXISTS loyalty_economy (
    id INT PRIMARY KEY,
    supply_total BIGINT NOT NULL,
    supply_circulating BIGINT NOT NULL DEFAULT 0,
    reserve_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
    rate_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
    revenue_percent INT NOT NULL DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO loyalty_economy (id, supply_total, supply_circulating, reserve_usd, rate_usd, revenue_percent)
VALUES (1, 21000000, 0, 0, 0, 10)
ON CONFLICT (id) DO NOTHING;
