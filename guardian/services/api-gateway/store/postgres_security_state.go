package store

import (
	"context"
	"time"
)

func (s *PostgresStore) RevokeTokenHash(tokenHash string, expiresAt time.Time) {
	_, _ = s.pool.Exec(context.Background(),
		`INSERT INTO gateway_token_revocations(token_hash, expires_at) VALUES($1,$2)
		 ON CONFLICT(token_hash) DO UPDATE SET expires_at=GREATEST(gateway_token_revocations.expires_at, EXCLUDED.expires_at)`,
		tokenHash, expiresAt)
}

func (s *PostgresStore) IsTokenHashRevoked(tokenHash string, now time.Time) bool {
	_, _ = s.pool.Exec(context.Background(), `DELETE FROM gateway_token_revocations WHERE expires_at <= $1`, now)
	var exists bool
	if err := s.pool.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM gateway_token_revocations WHERE token_hash=$1 AND expires_at>$2)`, tokenHash, now).Scan(&exists); err != nil {
		return false
	}
	return exists
}

func (s *PostgresStore) RevokeUserBefore(userID string, revokedAt time.Time) {
	_, _ = s.pool.Exec(context.Background(),
		`INSERT INTO gateway_user_revocations(user_id, revoked_before) VALUES($1,$2)
		 ON CONFLICT(user_id) DO UPDATE SET revoked_before=GREATEST(gateway_user_revocations.revoked_before, EXCLUDED.revoked_before)`,
		userID, revokedAt)
}

func (s *PostgresStore) UserRevokedBefore(userID string) *time.Time {
	var value time.Time
	if err := s.pool.QueryRow(context.Background(), `SELECT revoked_before FROM gateway_user_revocations WHERE user_id=$1`, userID).Scan(&value); err != nil {
		return nil
	}
	return &value
}

func (s *PostgresStore) UseSignedNonce(nonce string, expiresAt time.Time) bool {
	ctx := context.Background()
	_, _ = s.pool.Exec(ctx, `DELETE FROM gateway_signed_nonces WHERE expires_at <= NOW()`)
	cmd, err := s.pool.Exec(ctx,
		`INSERT INTO gateway_signed_nonces(nonce, expires_at) VALUES($1,$2) ON CONFLICT(nonce) DO NOTHING`,
		nonce, expiresAt)
	return err == nil && cmd.RowsAffected() == 1
}
