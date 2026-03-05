// Package infrastructure — адаптеры (БД, кэш, внешние API).
// Реализует интерфейсы из domain.
package infrastructure

import (
	"context"
	"sync"

	"bolh-security/internal/user/domain"
)

// MemoryUserRepository — in-memory реализация для разработки/тестов.
// В проде заменить на реализацию с БД.
type MemoryUserRepository struct {
	mu    sync.RWMutex
	users map[string]*domain.User
}

// NewMemoryUserRepository создаёт репозиторий.
func NewMemoryUserRepository() *MemoryUserRepository {
	return &MemoryUserRepository{users: make(map[string]*domain.User)}
}

// Save сохраняет пользователя.
func (r *MemoryUserRepository) Save(ctx context.Context, u *domain.User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[u.ID] = u
	return nil
}

// GetByID возвращает пользователя по ID.
func (r *MemoryUserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return u, nil
}
