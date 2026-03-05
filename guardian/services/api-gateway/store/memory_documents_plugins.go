package store

import "sort"

func (s *MemoryStore) DocumentsByUserID(userID string) []Document {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Document
	for _, d := range s.documents {
		if d.UserID == userID {
			out = append(out, *d)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) DocumentByID(id, userID string) *Document {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d, ok := s.documents[id]
	if !ok || d.UserID != userID {
		return nil
	}
	d2 := *d
	return &d2
}

func (s *MemoryStore) CreateDocument(d *Document) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.documents[d.ID] = d
}

func (s *MemoryStore) UpdateDocument(d *Document) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.documents[d.ID]; ok && existing.UserID == d.UserID {
		s.documents[d.ID] = d
	}
}

func (s *MemoryStore) DeleteDocument(id, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	d, ok := s.documents[id]
	if !ok || d.UserID != userID {
		return false
	}
	delete(s.documents, id)
	return true
}

func (s *MemoryStore) PluginsByUserID(userID string) []Plugin {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []Plugin
	for _, p := range s.plugins {
		if p.UserID == userID {
			out = append(out, *p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) PluginByID(id, userID string) *Plugin {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.plugins[id]
	if !ok {
		return nil
	}
	if p.UserID == userID {
		p2 := *p
		return &p2
	}
	for _, m := range s.pluginTeamMembers[id] {
		if m.UserID == userID {
			p2 := *p
			return &p2
		}
	}
	return nil
}

func (s *MemoryStore) PluginByIDOnly(id string) *Plugin {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.plugins[id]
	if !ok {
		return nil
	}
	p2 := *p
	return &p2
}

func (s *MemoryStore) CreatePlugin(p *Plugin) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.plugins[p.ID] = p
}

func (s *MemoryStore) UpdatePlugin(p *Plugin) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if existing, ok := s.plugins[p.ID]; ok && existing.UserID == p.UserID {
		s.plugins[p.ID] = p
	}
}

func (s *MemoryStore) PluginTeamMembers(pluginID string) []PluginTeamMember {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := s.pluginTeamMembers[pluginID]
	out := make([]PluginTeamMember, 0, len(list))
	for _, m := range list {
		out = append(out, *m)
	}
	return out
}

func (s *MemoryStore) AddPluginTeamMember(m *PluginTeamMember) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.pluginTeamMembers[m.PluginID]
	for i := range list {
		if list[i].UserID == m.UserID {
			list[i] = m
			return
		}
	}
	s.pluginTeamMembers[m.PluginID] = append(list, m)
}

func (s *MemoryStore) RemovePluginTeamMember(pluginID, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.pluginTeamMembers[pluginID]
	for i, m := range list {
		if m.UserID == userID {
			s.pluginTeamMembers[pluginID] = append(list[:i], list[i+1:]...)
			return true
		}
	}
	return false
}

func (s *MemoryStore) PluginComments(pluginID string) []PluginComment {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := s.pluginComments[pluginID]
	out := make([]PluginComment, 0, len(list))
	for _, c := range list {
		out = append(out, *c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out
}

func (s *MemoryStore) AddPluginComment(c *PluginComment) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pluginComments[c.PluginID] = append(s.pluginComments[c.PluginID], c)
}

func (s *MemoryStore) SetCommentResolved(commentID, pluginID string, resolved bool) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.pluginComments[pluginID]
	for _, c := range list {
		if c.ID == commentID {
			c.Resolved = resolved
			return true
		}
	}
	return false
}
