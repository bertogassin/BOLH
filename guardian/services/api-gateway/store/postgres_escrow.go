package store

import (
	"context"
	"errors"
)

const escrowSelect = `SELECT id,order_id,client_id,amount_minor,currency,provider,COALESCE(provider_ref,''),idempotency_key,COALESCE(payment_method_hint,''),status,COALESCE(description,''),created_at,updated_at,authorized_at,released_at,cancelled_at FROM gateway_escrow_payments`

func scanEscrow(row interface{ Scan(...any) error }) *EscrowPayment {
	var p EscrowPayment
	if err := row.Scan(&p.ID, &p.OrderID, &p.ClientID, &p.AmountMinor, &p.Currency, &p.Provider, &p.ProviderRef, &p.IdempotencyKey, &p.PaymentMethodHint, &p.Status, &p.Description, &p.CreatedAt, &p.UpdatedAt, &p.AuthorizedAt, &p.ReleasedAt, &p.CancelledAt); err != nil {
		return nil
	}
	p.Amount = float64(p.AmountMinor) / 100
	return &p
}

func (s *PostgresStore) EscrowPaymentByID(id string) *EscrowPayment {
	return scanEscrow(s.pool.QueryRow(context.Background(), escrowSelect+` WHERE id=$1`, id))
}

func (s *PostgresStore) EscrowPaymentByProviderRef(providerRef string) *EscrowPayment {
	if providerRef == "" {
		return nil
	}
	return scanEscrow(s.pool.QueryRow(context.Background(), escrowSelect+` WHERE provider_ref=$1`, providerRef))
}

func (s *PostgresStore) EscrowPaymentByIdempotencyKey(key string) *EscrowPayment {
	if key == "" {
		return nil
	}
	return scanEscrow(s.pool.QueryRow(context.Background(), escrowSelect+` WHERE idempotency_key=$1`, key))
}

func (s *PostgresStore) EscrowPaymentsByOrderID(orderID string) []EscrowPayment {
	rows, err := s.pool.Query(context.Background(), escrowSelect+` WHERE order_id=$1 ORDER BY created_at DESC`, orderID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := make([]EscrowPayment, 0)
	for rows.Next() {
		p := scanEscrow(rows)
		if p != nil {
			out = append(out, *p)
		}
	}
	return out
}

func (s *PostgresStore) CreateEscrowPayment(p *EscrowPayment) error {
	if p == nil {
		return errors.New("invalid escrow payment")
	}
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_escrow_payments(id,order_id,client_id,amount_minor,currency,provider,provider_ref,idempotency_key,payment_method_hint,status,description,created_at,updated_at,authorized_at,released_at,cancelled_at) VALUES($1,$2,$3,$4,$5,$6,NULLIF($7,''),$8,$9,$10,$11,$12,$13,$14,$15,$16)`, p.ID, p.OrderID, p.ClientID, p.AmountMinor, p.Currency, p.Provider, p.ProviderRef, p.IdempotencyKey, p.PaymentMethodHint, p.Status, p.Description, p.CreatedAt, p.UpdatedAt, p.AuthorizedAt, p.ReleasedAt, p.CancelledAt)
	return err
}

func (s *PostgresStore) UpdateEscrowPayment(p *EscrowPayment) error {
	if p == nil {
		return errors.New("invalid escrow payment")
	}
	cmd, err := s.pool.Exec(context.Background(), `UPDATE gateway_escrow_payments SET provider=$2,provider_ref=NULLIF($3,''),payment_method_hint=$4,status=$5,description=$6,updated_at=$7,authorized_at=$8,released_at=$9,cancelled_at=$10 WHERE id=$1`, p.ID, p.Provider, p.ProviderRef, p.PaymentMethodHint, p.Status, p.Description, p.UpdatedAt, p.AuthorizedAt, p.ReleasedAt, p.CancelledAt)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() != 1 {
		return errors.New("escrow payment not found")
	}
	return nil
}
