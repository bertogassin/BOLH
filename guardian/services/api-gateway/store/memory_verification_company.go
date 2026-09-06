package store

import (
	"errors"
	"sort"
)

func (s *MemoryStore) VerificationRequestByID(id string) *VerificationRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v := s.verificationRequests[id]
	if v == nil {
		return nil
	}
	cp := *v
	return &cp
}

func (s *MemoryStore) VerificationRequests() []VerificationRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]VerificationRequest, 0, len(s.verificationRequests))
	for _, v := range s.verificationRequests {
		out = append(out, *v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) UpdateVerificationRequest(v *VerificationRequest) error {
	if v == nil {
		return errors.New("invalid verification request")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.verificationRequests[v.ID]; !ok {
		return errors.New("verification request not found")
	}
	cp := *v
	s.verificationRequests[v.ID] = &cp
	return nil
}

func (s *MemoryStore) CreateVerificationArtifact(a *VerificationArtifact) error {
	if a == nil {
		return errors.New("invalid verification artifact")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *a
	s.verificationArtifacts[a.ID] = &cp
	return nil
}

func (s *MemoryStore) VerificationArtifactsByRequestID(requestID string) []VerificationArtifact {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]VerificationArtifact, 0)
	for _, a := range s.verificationArtifacts {
		if a.VerificationID == requestID {
			out = append(out, *a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out
}

func copyCompanyApplication(a *CompanyApplication) CompanyApplication {
	cp := *a
	cp.Payload = map[string]string{}
	for k, v := range a.Payload {
		cp.Payload[k] = v
	}
	return cp
}

func (s *MemoryStore) CreateCompanyApplication(a *CompanyApplication) error {
	if a == nil {
		return errors.New("invalid company application")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := copyCompanyApplication(a)
	s.companyApplications[a.ID] = &cp
	return nil
}
func (s *MemoryStore) CompanyApplicationsByUserID(userID string) []CompanyApplication {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []CompanyApplication{}
	for _, a := range s.companyApplications {
		if a.UserID == userID {
			out = append(out, copyCompanyApplication(a))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}
func (s *MemoryStore) AllCompanyApplications() []CompanyApplication {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]CompanyApplication, 0, len(s.companyApplications))
	for _, a := range s.companyApplications {
		out = append(out, copyCompanyApplication(a))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}
func (s *MemoryStore) UpdateCompanyApplication(a *CompanyApplication) error {
	if a == nil {
		return errors.New("invalid company application")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.companyApplications[a.ID]; !ok {
		return errors.New("company application not found")
	}
	cp := copyCompanyApplication(a)
	s.companyApplications[a.ID] = &cp
	return nil
}
