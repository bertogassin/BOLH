package store

func (s *PostgresStore) DocumentsByUserID(userID string) []Document {
	return nil
}

func (s *PostgresStore) DocumentByID(id, userID string) *Document {
	return nil
}

func (s *PostgresStore) CreateDocument(d *Document) {}

func (s *PostgresStore) UpdateDocument(d *Document) {}

func (s *PostgresStore) DeleteDocument(id, userID string) bool {
	return false
}

func (s *PostgresStore) PluginsByUserID(userID string) []Plugin {
	return nil
}

func (s *PostgresStore) PluginByID(id, userID string) *Plugin {
	return nil
}

func (s *PostgresStore) PluginByIDOnly(id string) *Plugin {
	return nil
}

func (s *PostgresStore) CreatePlugin(p *Plugin) {}

func (s *PostgresStore) UpdatePlugin(p *Plugin) {}

func (s *PostgresStore) PluginTeamMembers(pluginID string) []PluginTeamMember {
	return nil
}

func (s *PostgresStore) AddPluginTeamMember(m *PluginTeamMember) {}

func (s *PostgresStore) RemovePluginTeamMember(pluginID, userID string) bool {
	return false
}

func (s *PostgresStore) PluginComments(pluginID string) []PluginComment {
	return nil
}

func (s *PostgresStore) AddPluginComment(c *PluginComment) {}

func (s *PostgresStore) SetCommentResolved(commentID, pluginID string, resolved bool) bool {
	return false
}

func (s *PostgresStore) PlansByUserID(userID string) []Plan {
	return nil
}

func (s *PostgresStore) PlanByID(id, userID string) *Plan {
	return nil
}

func (s *PostgresStore) CreatePlan(p *Plan) {}

func (s *PostgresStore) UpdatePlan(p *Plan) {}

func (s *PostgresStore) DeletePlan(id, userID string) bool {
	return false
}

func (s *PostgresStore) PlanTasks(planID string) []PlanTask {
	return nil
}

func (s *PostgresStore) AddPlanTask(t *PlanTask) {}

func (s *PostgresStore) UpdatePlanTask(t *PlanTask) {}

func (s *PostgresStore) DeletePlanTask(taskID, planID, userID string) bool {
	return false
}
