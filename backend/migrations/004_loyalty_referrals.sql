CREATE TABLE IF NOT EXISTS loyalty_referrals_stats (
    id INT PRIMARY KEY,
    total_count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO loyalty_referrals_stats (id, total_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS loyalty_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    reward BIGINT NOT NULL,
    ordinal BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_referrals_referrer ON loyalty_referrals(referrer_id);
