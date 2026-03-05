package store

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
	s.matches[m.ID] = m
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
