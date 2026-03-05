CREATE TABLE IF NOT EXISTS gateway_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_messages_order ON gateway_messages(order_id);
