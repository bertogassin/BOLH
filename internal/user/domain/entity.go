// Package domain содержит чистую бизнес-логику модуля User.
// Зависимостей от фреймворков и БД нет.
package domain

import "time"

// User — агрегат модуля User.
type User struct {
	ID        string
	Email     string
	CreatedAt time.Time
}

// NewUser создаёт пользователя (фабрика домена).
func NewUser(id, email string) (*User, error) {
	if id == "" || email == "" {
		return nil, ErrInvalidUser
	}
	return &User{
		ID:        id,
		Email:     email,
		CreatedAt: time.Now().UTC(),
	}, nil
}
