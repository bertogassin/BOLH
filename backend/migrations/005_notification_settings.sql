-- Create notification_settings table

CREATE TABLE IF NOT EXISTS notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    sms_enabled BOOLEAN DEFAULT true,
    order_updates BOOLEAN DEFAULT true,
    promotions BOOLEAN DEFAULT false,
    security_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
