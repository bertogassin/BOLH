package store

import (
	"context"
	"errors"
)

func (s *PostgresStore) VerifiedLicensesByGuardID(guardID string) []string {
	rows, err := s.pool.Query(context.Background(), `SELECT license_code FROM gateway_guard_verified_licenses WHERE guard_id=$1 ORDER BY lower(license_code)`, guardID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var v string
		if rows.Scan(&v) == nil {
			out = append(out, v)
		}
	}
	return out
}

func (s *PostgresStore) SetVerifiedGuardLicenses(guardID string, licenses []string) error {
	u := s.UserByID(guardID)
	if u == nil || u.UserType != "guard" {
		return errors.New("guard not found")
	}
	normalized := normalizeVerifiedLicenses(licenses)
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM gateway_guard_verified_licenses WHERE guard_id=$1`, guardID); err != nil {
		return err
	}
	for _, v := range normalized {
		if _, err := tx.Exec(ctx, `INSERT INTO gateway_guard_verified_licenses(guard_id,license_code,verified_at) VALUES($1,$2,NOW())`, guardID, v); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
