CREATE TABLE IF NOT EXISTS loyalty_balances (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 0,
    locked BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit','debit')),
    source VARCHAR(30) NOT NULL,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user ON loyalty_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_created ON loyalty_ledger(created_at DESC);

CREATE TABLE IF NOT EXISTS loyalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(30) NOT NULL,
    reward BIGINT NOT NULL DEFAULT 0,
    daily_cap BIGINT NOT NULL DEFAULT 0,
    monthly_cap BIGINT NOT NULL DEFAULT 0,
    cooldown_seconds INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_rules_action ON loyalty_rules(action);

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    rate NUMERIC(12,6) DEFAULT 1.0,
    kyc_ref TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_user ON loyalty_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON loyalty_redemptions(status);
