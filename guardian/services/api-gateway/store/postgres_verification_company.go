package store

import (
	"context"
	"encoding/json"
	"errors"
)

func (s *PostgresStore) CreateVerificationArtifact(a *VerificationArtifact) error {
	if a == nil {
		return errors.New("invalid verification artifact")
	}
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_verification_artifacts(id,verification_id,user_id,object_key,mime_type,size_bytes,sha256,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, a.ID, a.VerificationID, a.UserID, a.ObjectKey, a.MimeType, a.SizeBytes, a.SHA256, a.CreatedAt)
	return err
}

func (s *PostgresStore) VerificationArtifactsByRequestID(requestID string) []VerificationArtifact {
	rows, err := s.pool.Query(context.Background(), `SELECT id,verification_id,user_id,object_key,mime_type,size_bytes,sha256,created_at FROM gateway_verification_artifacts WHERE verification_id=$1 ORDER BY created_at`, requestID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make([]VerificationArtifact, 0)
	for rows.Next() {
		var a VerificationArtifact
		if err := rows.Scan(&a.ID, &a.VerificationID, &a.UserID, &a.ObjectKey, &a.MimeType, &a.SizeBytes, &a.SHA256, &a.CreatedAt); err == nil {
			out = append(out, a)
		}
	}
	return out
}

func (s *PostgresStore) CreateCompanyApplication(a *CompanyApplication) error {
	if a == nil {
		return errors.New("invalid company application")
	}
	payload, err := json.Marshal(a.Payload)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(context.Background(), `INSERT INTO gateway_company_applications(id,user_id,payload,status,rejection_reason,created_at,updated_at) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7)`, a.ID, a.UserID, payload, a.Status, a.RejectionReason, a.CreatedAt, a.UpdatedAt)
	return err
}

func scanCompany(row interface{ Scan(...any) error }) *CompanyApplication {
	var a CompanyApplication
	var payload []byte
	if err := row.Scan(&a.ID, &a.UserID, &payload, &a.Status, &a.RejectionReason, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil
	}
	_ = json.Unmarshal(payload, &a.Payload)
	if a.Payload == nil {
		a.Payload = map[string]string{}
	}
	return &a
}

func (s *PostgresStore) CompanyApplicationsByUserID(userID string) []CompanyApplication {
	rows, err := s.pool.Query(context.Background(), `SELECT id,user_id,payload,status,COALESCE(rejection_reason,''),created_at,updated_at FROM gateway_company_applications WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := []CompanyApplication{}
	for rows.Next() {
		if a := scanCompany(rows); a != nil {
			out = append(out, *a)
		}
	}
	return out
}
func (s *PostgresStore) AllCompanyApplications() []CompanyApplication {
	rows, err := s.pool.Query(context.Background(), `SELECT id,user_id,payload,status,COALESCE(rejection_reason,''),created_at,updated_at FROM gateway_company_applications ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := []CompanyApplication{}
	for rows.Next() {
		if a := scanCompany(rows); a != nil {
			out = append(out, *a)
		}
	}
	return out
}
func (s *PostgresStore) UpdateCompanyApplication(a *CompanyApplication) error {
	if a == nil {
		return errors.New("invalid company application")
	}
	payload, err := json.Marshal(a.Payload)
	if err != nil {
		return err
	}
	cmd, err := s.pool.Exec(context.Background(), `UPDATE gateway_company_applications SET payload=$2,status=$3,rejection_reason=NULLIF($4,''),updated_at=$5 WHERE id=$1`, a.ID, payload, a.Status, a.RejectionReason, a.UpdatedAt)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() != 1 {
		return errors.New("company application not found")
	}
	return nil
}
