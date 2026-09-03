package store

import (
	"context"
	"encoding/json"
	"log"
)

func decodeRows[T any](rows interface {
	Next() bool
	Scan(...any) error
	Close()
}) []T {
	defer rows.Close()
	out := make([]T, 0)
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			continue
		}
		var item T
		if json.Unmarshal(payload, &item) == nil {
			out = append(out, item)
		}
	}
	return out
}

func decodeOne[T any](payload []byte, err error) *T {
	if err != nil {
		return nil
	}
	var item T
	if json.Unmarshal(payload, &item) != nil {
		return nil
	}
	return &item
}

func jsonPayload(value any) []byte {
	payload, err := json.Marshal(value)
	if err != nil {
		log.Printf("[postgres] marshal feature payload: %v", err)
		return nil
	}
	return payload
}

func (s *PostgresStore) DocumentsByUserID(userID string) []Document {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_documents WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil { return nil }
	return decodeRows[Document](rows)
}

func (s *PostgresStore) DocumentByID(id, userID string) *Document {
	var payload []byte
	err := s.pool.QueryRow(context.Background(), `SELECT payload FROM gateway_documents WHERE id=$1 AND user_id=$2`, id, userID).Scan(&payload)
	return decodeOne[Document](payload, err)
}

func (s *PostgresStore) CreateDocument(d *Document) {
	payload := jsonPayload(d); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_documents(id,user_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5)`, d.ID, d.UserID, payload, d.CreatedAt, d.UpdatedAt)
	if err != nil { log.Printf("[postgres] CreateDocument: %v", err) }
}

func (s *PostgresStore) UpdateDocument(d *Document) {
	payload := jsonPayload(d); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `UPDATE gateway_documents SET payload=$3,updated_at=$4 WHERE id=$1 AND user_id=$2`, d.ID, d.UserID, payload, d.UpdatedAt)
	if err != nil { log.Printf("[postgres] UpdateDocument: %v", err) }
}

func (s *PostgresStore) DeleteDocument(id, userID string) bool {
	result, err := s.pool.Exec(context.Background(), `DELETE FROM gateway_documents WHERE id=$1 AND user_id=$2`, id, userID)
	return err == nil && result.RowsAffected() > 0
}

func (s *PostgresStore) PluginsByUserID(userID string) []Plugin {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_plugins WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil { return nil }
	return decodeRows[Plugin](rows)
}

func (s *PostgresStore) pluginByQuery(query string, args ...any) *Plugin {
	var payload []byte
	err := s.pool.QueryRow(context.Background(), query, args...).Scan(&payload)
	return decodeOne[Plugin](payload, err)
}

func (s *PostgresStore) PluginByID(id, userID string) *Plugin {
	return s.pluginByQuery(`SELECT p.payload FROM gateway_plugins p WHERE p.id=$1 AND (p.user_id=$2 OR EXISTS (SELECT 1 FROM gateway_plugin_team_members m WHERE m.plugin_id=p.id AND m.user_id=$2))`, id, userID)
}

func (s *PostgresStore) PluginByIDOnly(id string) *Plugin {
	return s.pluginByQuery(`SELECT payload FROM gateway_plugins WHERE id=$1`, id)
}

func (s *PostgresStore) CreatePlugin(p *Plugin) {
	payload := jsonPayload(p); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_plugins(id,user_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5)`, p.ID, p.UserID, payload, p.CreatedAt, p.UpdatedAt)
	if err != nil { log.Printf("[postgres] CreatePlugin: %v", err) }
}

func (s *PostgresStore) UpdatePlugin(p *Plugin) {
	payload := jsonPayload(p); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `UPDATE gateway_plugins SET payload=$3,updated_at=$4 WHERE id=$1 AND user_id=$2`, p.ID, p.UserID, payload, p.UpdatedAt)
	if err != nil { log.Printf("[postgres] UpdatePlugin: %v", err) }
}

func (s *PostgresStore) PluginTeamMembers(pluginID string) []PluginTeamMember {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_plugin_team_members WHERE plugin_id=$1 ORDER BY added_at`, pluginID)
	if err != nil { return nil }
	return decodeRows[PluginTeamMember](rows)
}

func (s *PostgresStore) AddPluginTeamMember(m *PluginTeamMember) {
	payload := jsonPayload(m); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_plugin_team_members(plugin_id,user_id,payload,added_at) VALUES($1,$2,$3,$4) ON CONFLICT(plugin_id,user_id) DO UPDATE SET payload=EXCLUDED.payload,added_at=EXCLUDED.added_at`, m.PluginID, m.UserID, payload, m.AddedAt)
	if err != nil { log.Printf("[postgres] AddPluginTeamMember: %v", err) }
}

func (s *PostgresStore) RemovePluginTeamMember(pluginID, userID string) bool {
	result, err := s.pool.Exec(context.Background(), `DELETE FROM gateway_plugin_team_members WHERE plugin_id=$1 AND user_id=$2`, pluginID, userID)
	return err == nil && result.RowsAffected() > 0
}

func (s *PostgresStore) PluginComments(pluginID string) []PluginComment {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_plugin_comments WHERE plugin_id=$1 ORDER BY created_at`, pluginID)
	if err != nil { return nil }
	return decodeRows[PluginComment](rows)
}

func (s *PostgresStore) AddPluginComment(c *PluginComment) {
	payload := jsonPayload(c); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_plugin_comments(id,plugin_id,payload,created_at) VALUES($1,$2,$3,$4)`, c.ID, c.PluginID, payload, c.CreatedAt)
	if err != nil { log.Printf("[postgres] AddPluginComment: %v", err) }
}

func (s *PostgresStore) SetCommentResolved(commentID, pluginID string, resolved bool) bool {
	result, err := s.pool.Exec(context.Background(), `UPDATE gateway_plugin_comments SET payload=jsonb_set(payload,'{resolved}',to_jsonb($3::boolean),true) WHERE id=$1 AND plugin_id=$2`, commentID, pluginID, resolved)
	return err == nil && result.RowsAffected() > 0
}

func (s *PostgresStore) PlansByUserID(userID string) []Plan {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_plans WHERE owner_id=$1 ORDER BY updated_at DESC`, userID)
	if err != nil { return nil }
	return decodeRows[Plan](rows)
}

func (s *PostgresStore) PlanByID(id, userID string) *Plan {
	var payload []byte
	err := s.pool.QueryRow(context.Background(), `SELECT payload FROM gateway_plans WHERE id=$1 AND owner_id=$2`, id, userID).Scan(&payload)
	return decodeOne[Plan](payload, err)
}

func (s *PostgresStore) CreatePlan(p *Plan) {
	payload := jsonPayload(p); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_plans(id,owner_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5)`, p.ID, p.OwnerID, payload, p.CreatedAt, p.UpdatedAt)
	if err != nil { log.Printf("[postgres] CreatePlan: %v", err) }
}

func (s *PostgresStore) UpdatePlan(p *Plan) {
	payload := jsonPayload(p); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `UPDATE gateway_plans SET payload=$3,updated_at=$4 WHERE id=$1 AND owner_id=$2`, p.ID, p.OwnerID, payload, p.UpdatedAt)
	if err != nil { log.Printf("[postgres] UpdatePlan: %v", err) }
}

func (s *PostgresStore) DeletePlan(id, userID string) bool {
	result, err := s.pool.Exec(context.Background(), `DELETE FROM gateway_plans WHERE id=$1 AND owner_id=$2`, id, userID)
	return err == nil && result.RowsAffected() > 0
}

func (s *PostgresStore) PlanTasks(planID string) []PlanTask {
	rows, err := s.pool.Query(context.Background(), `SELECT payload FROM gateway_plan_tasks WHERE plan_id=$1 ORDER BY sort_order,created_at`, planID)
	if err != nil { return nil }
	return decodeRows[PlanTask](rows)
}

func (s *PostgresStore) AddPlanTask(t *PlanTask) {
	payload := jsonPayload(t); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `INSERT INTO gateway_plan_tasks(id,plan_id,payload,sort_order,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)`, t.ID, t.PlanID, payload, t.SortOrder, t.CreatedAt, t.UpdatedAt)
	if err != nil { log.Printf("[postgres] AddPlanTask: %v", err) }
}

func (s *PostgresStore) UpdatePlanTask(t *PlanTask) {
	payload := jsonPayload(t); if payload == nil { return }
	_, err := s.pool.Exec(context.Background(), `UPDATE gateway_plan_tasks SET payload=$3,sort_order=$4,updated_at=$5 WHERE id=$1 AND plan_id=$2`, t.ID, t.PlanID, payload, t.SortOrder, t.UpdatedAt)
	if err != nil { log.Printf("[postgres] UpdatePlanTask: %v", err) }
}

func (s *PostgresStore) DeletePlanTask(taskID, planID, userID string) bool {
	result, err := s.pool.Exec(context.Background(), `DELETE FROM gateway_plan_tasks t USING gateway_plans p WHERE t.id=$1 AND t.plan_id=$2 AND p.id=t.plan_id AND p.owner_id=$3`, taskID, planID, userID)
	return err == nil && result.RowsAffected() > 0
}
