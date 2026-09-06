package store

import (
	"errors"
	"time"
)

func (s *MemoryStore) OrdersByClientID(clientID string) []Order {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Order
	for _, o := range s.orders {
		if o.ClientID == clientID {
			out = append(out, *o)
		}
	}
	return out
}

func (s *MemoryStore) OrderByID(id string) *Order {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[id]
	if !ok {
		return nil
	}
	o2 := *o
	return &o2
}

func (s *MemoryStore) CreateOrder(o *Order) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.orders[o.ID] = o
}

func (s *MemoryStore) UpdateOrder(o *Order) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.orders[o.ID] = o
}

func (s *MemoryStore) CancelOrder(orderID, clientID string) (*Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o := s.orders[orderID]
	if o == nil {
		return nil, errors.New("order not found")
	}
	if o.ClientID != clientID {
		return nil, errors.New("forbidden")
	}
	if o.Status == "cancelled" {
		cp := *o
		return &cp, nil
	}
	if o.Status != "draft" && o.Status != "published" && o.Status != "open" && o.Status != "matching" {
		return nil, errors.New("order cannot be cancelled in current state")
	}
	now := time.Now()
	for _, m := range s.matches {
		if m.OrderID == orderID && (m.Status == "offered" || m.Status == "") {
			m.Status = "rejected"
			m.UpdatedAt = now
		}
	}
	o.Status = "cancelled"
	o.UpdatedAt = now
	cp := *o
	return &cp, nil
}

func (s *MemoryStore) BidsByGuardID(guardID string) []Bid {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Bid
	for _, b := range s.bids {
		if b.GuardID == guardID {
			out = append(out, *b)
		}
	}
	return out
}

func (s *MemoryStore) BidByID(id string) *Bid {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.bids[id]
	if !ok {
		return nil
	}
	b2 := *b
	return &b2
}

func (s *MemoryStore) CreateBid(b *Bid) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bids[b.ID] = b
}

func (s *MemoryStore) UpdateBid(b *Bid) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bids[b.ID] = b
}

func (s *MemoryStore) AllOrders() []Order {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Order, 0, len(s.orders))
	for _, o := range s.orders {
		out = append(out, *o)
	}
	return out
}

func (s *MemoryStore) AllBids() []Bid {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Bid, 0, len(s.bids))
	for _, b := range s.bids {
		if b.Active {
			out = append(out, *b)
		}
	}
	return out
}

func (s *MemoryStore) CreateMatch(m *Match) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m.Status == "" {
		m.Status = "offered"
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now()
	}
	if m.UpdatedAt.IsZero() {
		m.UpdatedAt = m.CreatedAt
	}
	cp := *m
	s.matches[m.ID] = &cp
}

func (s *MemoryStore) MatchByID(id string) *Match {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, ok := s.matches[id]
	if !ok {
		return nil
	}
	cp := *m
	return &cp
}

func (s *MemoryStore) MatchesByOrderID(orderID string) []Match {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Match
	for _, m := range s.matches {
		if m.OrderID == orderID {
			out = append(out, *m)
		}
	}
	return out
}

func (s *MemoryStore) AllMatches() []Match {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Match, 0, len(s.matches))
	for _, m := range s.matches {
		out = append(out, *m)
	}
	return out
}

func (s *MemoryStore) OfferMatch(m *Match) (*Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[m.OrderID]
	if !ok {
		return nil, errors.New("order not found")
	}
	if o.Status != "published" && o.Status != "open" && o.Status != "matching" {
		return nil, errors.New("order is not matchable")
	}
	required := o.GuardCount
	if required < 1 {
		required = 1
	}
	active := 0
	for _, existing := range s.matches {
		if existing.OrderID != o.ID {
			continue
		}
		if existing.Status == "rejected" {
			continue
		}
		if existing.GuardID == m.GuardID || existing.BidID == m.BidID {
			return nil, errors.New("duplicate match offer")
		}
		if existing.Status == "offered" || existing.Status == "accepted" || existing.Status == "" {
			active++
		}
	}
	if active >= required {
		return nil, errors.New("order has no available guard slots")
	}
	now := time.Now()
	m.Status = "offered"
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	m.UpdatedAt = now
	cp := *m
	s.matches[m.ID] = &cp
	o.Status = "matching"
	o.UpdatedAt = now
	out := *o
	return &out, nil
}

func (s *MemoryStore) AcceptMatch(matchID, guardID string) (*Match, *Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.matches[matchID]
	if !ok {
		return nil, nil, errors.New("match not found")
	}
	if m.GuardID != guardID {
		return nil, nil, errors.New("forbidden")
	}
	o, ok := s.orders[m.OrderID]
	if !ok {
		return nil, nil, errors.New("order not found")
	}
	if m.Status == "accepted" {
		mc, oc := *m, *o
		return &mc, &oc, nil
	}
	if m.Status != "offered" && m.Status != "" {
		return nil, nil, errors.New("match is not pending")
	}
	now := time.Now()
	m.Status = "accepted"
	m.UpdatedAt = now
	accepted := 0
	for _, existing := range s.matches {
		if existing.OrderID == o.ID && existing.Status == "accepted" {
			accepted++
		}
	}
	required := o.GuardCount
	if required < 1 {
		required = 1
	}
	if accepted >= required {
		o.Status = "matched"
	} else {
		o.Status = "matching"
	}
	o.UpdatedAt = now
	mc, oc := *m, *o
	return &mc, &oc, nil
}

func (s *MemoryStore) RejectMatch(matchID, guardID string) (*Match, *Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.matches[matchID]
	if !ok {
		return nil, nil, errors.New("match not found")
	}
	if m.GuardID != guardID {
		return nil, nil, errors.New("forbidden")
	}
	o, ok := s.orders[m.OrderID]
	if !ok {
		return nil, nil, errors.New("order not found")
	}
	if m.Status == "rejected" {
		mc, oc := *m, *o
		return &mc, &oc, nil
	}
	if m.Status == "accepted" {
		return nil, nil, errors.New("accepted match cannot be rejected")
	}
	now := time.Now()
	m.Status = "rejected"
	m.UpdatedAt = now
	accepted := 0
	active := 0
	for _, existing := range s.matches {
		if existing.OrderID != o.ID {
			continue
		}
		if existing.Status == "accepted" {
			accepted++
			active++
		} else if existing.Status == "offered" || existing.Status == "" {
			active++
		}
	}
	required := o.GuardCount
	if required < 1 {
		required = 1
	}
	if accepted >= required {
		o.Status = "matched"
	} else if active > 0 {
		o.Status = "matching"
	} else {
		o.Status = "published"
	}
	o.UpdatedAt = now
	mc, oc := *m, *o
	return &mc, &oc, nil
}
