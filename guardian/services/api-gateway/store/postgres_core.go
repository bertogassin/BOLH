package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore implements Store using PostgreSQL (tables gateway_* from 003_simple_api_gateway.sql).
type PostgresStore struct {
	pool *pgxpool.Pool
}

// NewPostgresStore returns a Store backed by PostgreSQL. Caller must run migrations (003_simple_api_gateway.sql).
func NewPostgresStore(ctx context.Context, connStr string) (Store, error) {
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &PostgresStore{pool: pool}, nil
}
