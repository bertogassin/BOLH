package store

import (
	"errors"
	"sort"
)

func copyEscrowPayment(p *EscrowPayment) *EscrowPayment {
	if p == nil {
		return nil
	}
	cp := *p
	cp.Amount = float64(cp.AmountMinor) / 100
	return &cp
}

func (s *MemoryStore) EscrowPaymentByID(id string) *EscrowPayment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return copyEscrowPayment(s.escrowPayments[id])
}

func (s *MemoryStore) EscrowPaymentByProviderRef(providerRef string) *EscrowPayment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.escrowPayments {
		if p.ProviderRef == providerRef && providerRef != "" {
			return copyEscrowPayment(p)
		}
	}
	return nil
}

func (s *MemoryStore) EscrowPaymentByIdempotencyKey(key string) *EscrowPayment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.escrowPayments {
		if p.IdempotencyKey == key && key != "" {
			return copyEscrowPayment(p)
		}
	}
	return nil
}

func (s *MemoryStore) EscrowPaymentsByOrderID(orderID string) []EscrowPayment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]EscrowPayment, 0)
	for _, p := range s.escrowPayments {
		if p.OrderID == orderID {
			cp := *p
			cp.Amount = float64(cp.AmountMinor) / 100
			out = append(out, cp)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) CreateEscrowPayment(p *EscrowPayment) error {
	if p == nil || p.ID == "" || p.IdempotencyKey == "" {
		return errors.New("invalid escrow payment")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.escrowPayments {
		if existing.IdempotencyKey == p.IdempotencyKey {
			return errors.New("duplicate idempotency key")
		}
		if p.ProviderRef != "" && existing.ProviderRef == p.ProviderRef {
			return errors.New("duplicate provider reference")
		}
	}
	cp := *p
	cp.Amount = float64(cp.AmountMinor) / 100
	s.escrowPayments[p.ID] = &cp
	return nil
}

func (s *MemoryStore) UpdateEscrowPayment(p *EscrowPayment) error {
	if p == nil || p.ID == "" {
		return errors.New("invalid escrow payment")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.escrowPayments[p.ID]; !ok {
		return errors.New("escrow payment not found")
	}
	cp := *p
	cp.Amount = float64(cp.AmountMinor) / 100
	s.escrowPayments[p.ID] = &cp
	return nil
}
