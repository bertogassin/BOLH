package store

func (s *MemoryStore) UserByID(id string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil
	}
	u2 := *u
	u2.PasswordHash = ""
	return &u2
}

func (s *MemoryStore) AllUsers() []User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]User, 0, len(s.users))
	for _, u := range s.users {
		if u == nil {
			continue
		}
		clone := *u
		clone.PasswordHash = ""
		out = append(out, clone)
	}
	return out
}

func (s *MemoryStore) UserByEmail(email string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Email == email {
			u2 := *u
			u2.PasswordHash = ""
			return &u2
		}
	}
	return nil
}

func (s *MemoryStore) UserByEmailWithPassword(email string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.Email == email {
			return u
		}
	}
	return nil
}

func (s *MemoryStore) CreateUser(u *User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID] = u
}

func (s *MemoryStore) UpdateUser(u *User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing, ok := s.users[u.ID]
	if !ok {
		return
	}
	if u.FirstName != "" {
		existing.FirstName = u.FirstName
	}
	if u.LastName != "" {
		existing.LastName = u.LastName
	}
	existing.Phone = u.Phone
}

func (s *MemoryStore) SetUserVerified(userID string, verified bool) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[userID]
	if !ok {
		return false
	}
	u.Verified = verified
	return true
}

func (s *MemoryStore) SetUserPasswordHash(userID, hash string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[userID]
	if !ok {
		return false
	}
	u.PasswordHash = hash
	return true
}
