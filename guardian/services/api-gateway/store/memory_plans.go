package store

import "sort"

func (s *MemoryStore) PlansByUserID(userID string) []Plan {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Plan
	for _, p := range s.plans {
		if p.OwnerID == userID {
			out = append(out, *p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out
}

func (s *MemoryStore) PlanByID(id, userID string) *Plan {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.plans[id]
	if !ok || p.OwnerID != userID {
		return nil
	}
	p2 := *p
	return &p2
}

func (s *MemoryStore) CreatePlan(p *Plan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.plans[p.ID] = p
}

func (s *MemoryStore) UpdatePlan(p *Plan) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.plans[p.ID]; ok && existing.OwnerID == p.OwnerID {
		s.plans[p.ID] = p
	}
}

func (s *MemoryStore) DeletePlan(id, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.plans[id]
	if !ok || p.OwnerID != userID {
		return false
	}
	delete(s.plans, id)
	delete(s.planTasks, id)
	return true
}

func (s *MemoryStore) PlanTasks(planID string) []PlanTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := s.planTasks[planID]
	out := make([]PlanTask, 0, len(list))
	for _, t := range list {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].SortOrder != out[j].SortOrder {
			return out[i].SortOrder < out[j].SortOrder
		}
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (s *MemoryStore) AddPlanTask(t *PlanTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.planTasks[t.PlanID] = append(s.planTasks[t.PlanID], t)
}

func (s *MemoryStore) UpdatePlanTask(t *PlanTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.planTasks[t.PlanID]
	for i, task := range list {
		if task.ID == t.ID {
			list[i].Title = t.Title
			list[i].Description = t.Description
			list[i].DueAt = t.DueAt
			list[i].AssigneeID = t.AssigneeID
			list[i].Status = t.Status
			list[i].SortOrder = t.SortOrder
			list[i].UpdatedAt = t.UpdatedAt
			return
		}
	}
}

func (s *MemoryStore) DeletePlanTask(taskID, planID, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.plans[planID]
	if !ok || p.OwnerID != userID {
		return false
	}
	list := s.planTasks[planID]
	for i, t := range list {
		if t.ID == taskID {
			s.planTasks[planID] = append(list[:i], list[i+1:]...)
			return true
		}
	}
	return false
}
