CREATE TABLE IF NOT EXISTS gateway_documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_documents_user_created
    ON gateway_documents(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gateway_plugins (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_plugins_user_created
    ON gateway_plugins(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gateway_plugin_team_members (
    plugin_id UUID NOT NULL REFERENCES gateway_plugins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plugin_id, user_id)
);

CREATE TABLE IF NOT EXISTS gateway_plugin_comments (
    id UUID PRIMARY KEY,
    plugin_id UUID NOT NULL REFERENCES gateway_plugins(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_plugin_comments_plugin_created
    ON gateway_plugin_comments(plugin_id, created_at);

CREATE TABLE IF NOT EXISTS gateway_plans (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES gateway_users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_plans_owner_updated
    ON gateway_plans(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS gateway_plan_tasks (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES gateway_plans(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gateway_plan_tasks_plan_sort
    ON gateway_plan_tasks(plan_id, sort_order, created_at);
