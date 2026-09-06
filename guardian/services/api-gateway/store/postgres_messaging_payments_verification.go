package store

import (
	"context"
	"fmt"
	"log"
)

func (s *PostgresStore) CardsByUserID(userID string) []PaymentCard {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, user_id, last_four, brand, created_at FROM gateway_payment_cards WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []PaymentCard
	for rows.Next() {
		var c PaymentCard
		err := rows.Scan(&c.ID, &c.UserID, &c.LastFour, &c.Brand, &c.CreatedAt)
		if err != nil {
			continue
		}
		out = append(out, c)
	}
	return out
}

func (s *PostgresStore) CreateCard(c *PaymentCard) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_payment_cards (id, user_id, last_four, brand, created_at) VALUES ($1, $2, $3, $4, $5)`,
		c.ID, c.UserID, c.LastFour, c.Brand, c.CreatedAt)
	if err != nil {
		log.Printf("[postgres] CreateCard: %v", err)
		return
	}
}

func (s *PostgresStore) DeleteCard(id, userID string) bool {
	res, err := s.pool.Exec(context.Background(), `DELETE FROM gateway_payment_cards WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return false
	}
	return res.RowsAffected() > 0
}

func (s *PostgresStore) NotificationsByUserID(userID string) []Notification {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, user_id, title, body, read, created_at FROM gateway_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Body, &n.Read, &n.CreatedAt)
		if err != nil {
			continue
		}
		out = append(out, n)
	}
	return out
}

func (s *PostgresStore) AddNotification(n *Notification) {
	_, _ = s.pool.Exec(context.Background(),
		`INSERT INTO gateway_notifications (id, user_id, title, body, read, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		n.ID, n.UserID, n.Title, n.Body, n.Read, n.CreatedAt)
}

func (s *PostgresStore) MarkNotificationRead(id, userID string) bool {
	res, err := s.pool.Exec(context.Background(), `UPDATE gateway_notifications SET read = true WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return false
	}
	return res.RowsAffected() > 0
}

func (s *PostgresStore) MessagesByOrderID(orderID string) []Message {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, order_id, sender_id, text, created_at FROM gateway_messages WHERE order_id = $1 ORDER BY created_at ASC`, orderID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		err := rows.Scan(&m.ID, &m.OrderID, &m.SenderID, &m.Text, &m.CreatedAt)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out
}

func (s *PostgresStore) CreateMessage(m *Message) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_messages (id, order_id, sender_id, text, created_at) VALUES ($1, $2, $3, $4, $5)`,
		m.ID, m.OrderID, m.SenderID, m.Text, m.CreatedAt)
	if err != nil {
		log.Printf("[postgres] CreateMessage: %v", err)
		return
	}
}

func (s *PostgresStore) GetVerificationRequest(userID string) *VerificationRequest {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, user_id, status, COALESCE(rejection_reason,''), created_at, updated_at FROM gateway_verification_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, userID)
	var v VerificationRequest
	if err := row.Scan(&v.ID, &v.UserID, &v.Status, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt); err != nil {
		return nil
	}
	return &v
}

func (s *PostgresStore) VerificationRequestByID(id string) *VerificationRequest {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, user_id, status, COALESCE(rejection_reason,''), created_at, updated_at FROM gateway_verification_requests WHERE id = $1`, id)
	var v VerificationRequest
	if err := row.Scan(&v.ID, &v.UserID, &v.Status, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt); err != nil {
		return nil
	}
	return &v
}

func (s *PostgresStore) VerificationRequests() []VerificationRequest {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, user_id, status, COALESCE(rejection_reason,''), created_at, updated_at FROM gateway_verification_requests ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make([]VerificationRequest, 0)
	for rows.Next() {
		var v VerificationRequest
		if err := rows.Scan(&v.ID, &v.UserID, &v.Status, &v.RejectionReason, &v.CreatedAt, &v.UpdatedAt); err == nil {
			out = append(out, v)
		}
	}
	return out
}

func (s *PostgresStore) CreateVerificationRequest(v *VerificationRequest) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_verification_requests (id, user_id, status, rejection_reason, created_at, updated_at) VALUES ($1, $2, $3, NULLIF($4,''), $5, $6)`,
		v.ID, v.UserID, v.Status, v.RejectionReason, v.CreatedAt, v.UpdatedAt)
	return err
}

func (s *PostgresStore) UpdateVerificationRequest(v *VerificationRequest) error {
	cmd, err := s.pool.Exec(context.Background(),
		`UPDATE gateway_verification_requests SET status=$2,rejection_reason=NULLIF($3,''),updated_at=$4 WHERE id=$1`,
		v.ID, v.Status, v.RejectionReason, v.UpdatedAt)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() != 1 {
		return fmt.Errorf("verification request not found")
	}
	return nil
}
