package store

import (
	"context"
	"log"
	"time"
)

func (s *PostgresStore) UserByID(id string) *User {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, email, COALESCE(phone,''), password_hash, first_name, last_name, user_type, verified, created_at
		 FROM gateway_users WHERE id = $1`, id)
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.Phone, &u.PasswordHash, &u.FirstName, &u.LastName, &u.UserType, &u.Verified, &u.CreatedAt)
	if err != nil {
		return nil
	}
	u.PasswordHash = ""
	return &u
}

func (s *PostgresStore) AllUsers() []User {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, email, COALESCE(phone,''), password_hash, first_name, last_name, user_type, verified, created_at
		 FROM gateway_users ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Phone, &u.PasswordHash, &u.FirstName, &u.LastName, &u.UserType, &u.Verified, &u.CreatedAt); err != nil {
			continue
		}
		u.PasswordHash = ""
		out = append(out, u)
	}
	return out
}

func (s *PostgresStore) UserByEmail(email string) *User {
	u := s.UserByEmailWithPassword(email)
	if u == nil {
		return nil
	}
	u.PasswordHash = ""
	return u
}

func (s *PostgresStore) UserByEmailWithPassword(email string) *User {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, email, COALESCE(phone,''), password_hash, first_name, last_name, user_type, verified, created_at
		 FROM gateway_users WHERE email = $1`, email)
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.Phone, &u.PasswordHash, &u.FirstName, &u.LastName, &u.UserType, &u.Verified, &u.CreatedAt)
	if err != nil {
		return nil
	}
	return &u
}

func (s *PostgresStore) CreateUser(u *User) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_users (id, email, phone, password_hash, first_name, last_name, user_type, verified, created_at)
		 VALUES ($1, $2, NULLIF($3,''), $4, $5, $6, $7, $8, $9)`,
		u.ID, u.Email, u.Phone, u.PasswordHash, u.FirstName, u.LastName, u.UserType, u.Verified, u.CreatedAt)
	if err != nil {
		log.Printf("[postgres] CreateUser: %v", err)
		return
	}
}

func (s *PostgresStore) UpdateUser(u *User) {
	_, _ = s.pool.Exec(context.Background(),
		`UPDATE gateway_users SET first_name = COALESCE(NULLIF($2,''), first_name), last_name = COALESCE(NULLIF($3,''), last_name), phone = $4 WHERE id = $1`,
		u.ID, u.FirstName, u.LastName, u.Phone)
}

func (s *PostgresStore) SetUserPasswordHash(userID, hash string) bool {
	res, err := s.pool.Exec(context.Background(), `UPDATE gateway_users SET password_hash = $2 WHERE id = $1`, userID, hash)
	if err != nil {
		return false
	}
	return res.RowsAffected() > 0
}

func (s *PostgresStore) OrdersByClientID(clientID string) []Order {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, client_id, title, description, required_licenses, budget_min, budget_max, latitude, longitude, start_time, end_time, status, guard_count, created_at, updated_at
		 FROM gateway_orders WHERE client_id = $1 ORDER BY created_at DESC`, clientID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Order
	for rows.Next() {
		var o Order
		err := rows.Scan(&o.ID, &o.ClientID, &o.Title, &o.Description, &o.RequiredLicenses, &o.BudgetMin, &o.BudgetMax, &o.Latitude, &o.Longitude, &o.StartTime, &o.EndTime, &o.Status, &o.GuardCount, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			continue
		}
		out = append(out, o)
	}
	return out
}

func (s *PostgresStore) OrderByID(id string) *Order {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, client_id, title, description, required_licenses, budget_min, budget_max, latitude, longitude, start_time, end_time, status, guard_count, created_at, updated_at
		 FROM gateway_orders WHERE id = $1`, id)
	var o Order
	err := row.Scan(&o.ID, &o.ClientID, &o.Title, &o.Description, &o.RequiredLicenses, &o.BudgetMin, &o.BudgetMax, &o.Latitude, &o.Longitude, &o.StartTime, &o.EndTime, &o.Status, &o.GuardCount, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil
	}
	return &o
}

func (s *PostgresStore) CreateOrder(o *Order) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_orders (id, client_id, title, description, required_licenses, budget_min, budget_max, latitude, longitude, start_time, end_time, status, guard_count, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		o.ID, o.ClientID, o.Title, o.Description, o.RequiredLicenses, o.BudgetMin, o.BudgetMax, o.Latitude, o.Longitude, o.StartTime, o.EndTime, o.Status, o.GuardCount, o.CreatedAt, o.UpdatedAt)
	if err != nil {
		log.Printf("[postgres] CreateOrder: %v", err)
		return
	}
}

func (s *PostgresStore) UpdateOrder(o *Order) {
	o.UpdatedAt = time.Now()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE gateway_orders SET title=$2, description=$3, required_licenses=$4, budget_min=$5, budget_max=$6, latitude=$7, longitude=$8, start_time=$9, end_time=$10, status=$11, guard_count=$12, updated_at=$13 WHERE id=$1`,
		o.ID, o.Title, o.Description, o.RequiredLicenses, o.BudgetMin, o.BudgetMax, o.Latitude, o.Longitude, o.StartTime, o.EndTime, o.Status, o.GuardCount, o.UpdatedAt)
	if err != nil {
		log.Printf("[postgres] UpdateOrder: %v", err)
		return
	}
}

func (s *PostgresStore) BidsByGuardID(guardID string) []Bid {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, guard_id, title, licenses, price_per_hour, latitude, longitude, radius_km, active, created_at, updated_at
		 FROM gateway_bids WHERE guard_id = $1 ORDER BY created_at DESC`, guardID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Bid
	for rows.Next() {
		var b Bid
		err := rows.Scan(&b.ID, &b.GuardID, &b.Title, &b.Licenses, &b.PricePerHour, &b.Latitude, &b.Longitude, &b.RadiusKm, &b.Active, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			continue
		}
		out = append(out, b)
	}
	return out
}

func (s *PostgresStore) BidByID(id string) *Bid {
	row := s.pool.QueryRow(context.Background(),
		`SELECT id, guard_id, title, licenses, price_per_hour, latitude, longitude, radius_km, active, created_at, updated_at
		 FROM gateway_bids WHERE id = $1`, id)
	var b Bid
	err := row.Scan(&b.ID, &b.GuardID, &b.Title, &b.Licenses, &b.PricePerHour, &b.Latitude, &b.Longitude, &b.RadiusKm, &b.Active, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil
	}
	return &b
}

func (s *PostgresStore) CreateBid(b *Bid) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_bids (id, guard_id, title, licenses, price_per_hour, latitude, longitude, radius_km, active, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		b.ID, b.GuardID, b.Title, b.Licenses, b.PricePerHour, b.Latitude, b.Longitude, b.RadiusKm, b.Active, b.CreatedAt, b.UpdatedAt)
	if err != nil {
		log.Printf("[postgres] CreateBid: %v", err)
		return
	}
}

func (s *PostgresStore) UpdateBid(b *Bid) {
	b.UpdatedAt = time.Now()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE gateway_bids SET title=$2, licenses=$3, price_per_hour=$4, latitude=$5, longitude=$6, radius_km=$7, active=$8, updated_at=$9 WHERE id=$1`,
		b.ID, b.Title, b.Licenses, b.PricePerHour, b.Latitude, b.Longitude, b.RadiusKm, b.Active, b.UpdatedAt)
	if err != nil {
		log.Printf("[postgres] UpdateBid: %v", err)
		return
	}
}

func (s *PostgresStore) AllOrders() []Order {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, client_id, title, description, required_licenses, budget_min, budget_max, latitude, longitude, start_time, end_time, status, guard_count, created_at, updated_at
		 FROM gateway_orders ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Order
	for rows.Next() {
		var o Order
		err := rows.Scan(&o.ID, &o.ClientID, &o.Title, &o.Description, &o.RequiredLicenses, &o.BudgetMin, &o.BudgetMax, &o.Latitude, &o.Longitude, &o.StartTime, &o.EndTime, &o.Status, &o.GuardCount, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			continue
		}
		out = append(out, o)
	}
	return out
}

func (s *PostgresStore) AllMatches() []Match {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, order_id, bid_id, guard_id, final_price, created_at FROM gateway_matches ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Match
	for rows.Next() {
		var m Match
		if err := rows.Scan(&m.ID, &m.OrderID, &m.BidID, &m.GuardID, &m.FinalPrice, &m.CreatedAt); err != nil {
			continue
		}
		out = append(out, m)
	}
	return out
}

func (s *PostgresStore) AllBids() []Bid {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, guard_id, title, licenses, price_per_hour, latitude, longitude, radius_km, active, created_at, updated_at
		 FROM gateway_bids WHERE active = true ORDER BY created_at DESC`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Bid
	for rows.Next() {
		var b Bid
		err := rows.Scan(&b.ID, &b.GuardID, &b.Title, &b.Licenses, &b.PricePerHour, &b.Latitude, &b.Longitude, &b.RadiusKm, &b.Active, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			continue
		}
		out = append(out, b)
	}
	return out
}

func (s *PostgresStore) CreateMatch(m *Match) {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO gateway_matches (id, order_id, bid_id, guard_id, final_price, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		m.ID, m.OrderID, m.BidID, m.GuardID, m.FinalPrice, m.CreatedAt)
	if err != nil {
		log.Printf("[postgres] CreateMatch: %v", err)
		return
	}
}

func (s *PostgresStore) MatchesByOrderID(orderID string) []Match {
	rows, err := s.pool.Query(context.Background(),
		`SELECT id, order_id, bid_id, guard_id, final_price, created_at
		 FROM gateway_matches WHERE order_id = $1 ORDER BY created_at DESC`, orderID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []Match
	for rows.Next() {
		var m Match
		err := rows.Scan(&m.ID, &m.OrderID, &m.BidID, &m.GuardID, &m.FinalPrice, &m.CreatedAt)
		if err != nil {
			continue
		}
		out = append(out, m)
	}
	return out
}
