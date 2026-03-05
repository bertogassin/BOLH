package store

import "sort"

func (s *MemoryStore) CardsByUserID(userID string) []PaymentCard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []PaymentCard
	for _, c := range s.cards {
		if c.UserID == userID {
			out = append(out, *c)
		}
	}
	return out
}

func (s *MemoryStore) CreateCard(c *PaymentCard) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cards[c.ID] = c
}

func (s *MemoryStore) DeleteCard(id, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.cards[id]
	if !ok || c.UserID != userID {
		return false
	}
	delete(s.cards, id)
	return true
}

func (s *MemoryStore) NotificationsByUserID(userID string) []Notification {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Notification
	for _, n := range s.notifications {
		if n.UserID == userID {
			out = append(out, *n)
		}
	}
	return out
}

func (s *MemoryStore) AddNotification(n *Notification) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.notifications[n.ID] = n
}

func (s *MemoryStore) MarkNotificationRead(id, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.notifications[id]
	if !ok || n.UserID != userID {
		return false
	}
	n.Read = true
	return true
}

func (s *MemoryStore) MessagesByOrderID(orderID string) []Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Message
	for _, m := range s.messages {
		if m.OrderID == orderID {
			out = append(out, *m)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) CreateMessage(m *Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages[m.ID] = m
}

func (s *MemoryStore) GetVerificationRequest(userID string) *VerificationRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var latest *VerificationRequest
	for _, v := range s.verificationRequests {
		if v.UserID == userID && (latest == nil || v.CreatedAt.After(latest.CreatedAt)) {
			latest = v
		}
	}
	if latest == nil {
		return nil
	}
	v2 := *latest
	return &v2
}

func (s *MemoryStore) CreateVerificationRequest(v *VerificationRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.verificationRequests[v.ID] = v
}
