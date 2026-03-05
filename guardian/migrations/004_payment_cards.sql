-- Payment cards (stub: last_four + brand only, no PAN).
CREATE TABLE IF NOT EXISTS gateway_payment_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
    last_four TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'card',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_payment_cards_user ON gateway_payment_cards(user_id);
