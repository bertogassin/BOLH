package store

import (
	"errors"
	"sort"
	"strings"
)

func normalizeVerifiedLicenses(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, raw := range in {
		v := strings.TrimSpace(raw)
		if v == "" || len(v) > 100 {
			continue
		}
		key := strings.ToLower(v)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	return out
}

func (s *MemoryStore) VerifiedLicensesByGuardID(guardID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]string(nil), s.verifiedGuardLicenses[guardID]...)
}

func (s *MemoryStore) SetVerifiedGuardLicenses(guardID string, licenses []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.users[guardID]
	if u == nil || u.UserType != "guard" {
		return errors.New("guard not found")
	}
	s.verifiedGuardLicenses[guardID] = normalizeVerifiedLicenses(licenses)
	return nil
}
