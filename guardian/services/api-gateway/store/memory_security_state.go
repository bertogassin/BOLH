package store

import "time"

func (s *MemoryStore) RevokeTokenHash(tokenHash string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revokedTokenHashes[tokenHash] = expiresAt
}

func (s *MemoryStore) IsTokenHashRevoked(tokenHash string, now time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, exp := range s.revokedTokenHashes {
		if !exp.After(now) {
			delete(s.revokedTokenHashes, key)
		}
	}
	exp, ok := s.revokedTokenHashes[tokenHash]
	return ok && exp.After(now)
}

func (s *MemoryStore) RevokeUserBefore(userID string, revokedAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if prev, ok := s.revokedUserBefore[userID]; !ok || revokedAt.After(prev) {
		s.revokedUserBefore[userID] = revokedAt
	}
}

func (s *MemoryStore) UserRevokedBefore(userID string) *time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.revokedUserBefore[userID]
	if !ok {
		return nil
	}
	cp := v
	return &cp
}

func (s *MemoryStore) UseSignedNonce(nonce string, expiresAt time.Time) bool {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, exp := range s.signedNonces {
		if !exp.After(now) {
			delete(s.signedNonces, key)
		}
	}
	if exp, exists := s.signedNonces[nonce]; exists && exp.After(now) {
		return false
	}
	s.signedNonces[nonce] = expiresAt
	return true
}
