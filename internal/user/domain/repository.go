package domain

import "context"

// UserRepository — интерфейс репозитория, объявленный в Domain.
// Реализация живёт в Infrastructure.
type UserRepository interface {
	Save(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id string) (*User, error)
}
