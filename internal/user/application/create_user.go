// Package application — сценарии использования (use cases).
// Зависит только от domain.
package application

import (
	"context"

	"bolh-security/internal/user/domain"
	"github.com/google/uuid"
)

// CreateUserCommand — входная команда для создания пользователя.
type CreateUserCommand struct {
	Email string
}

// CreateUserHandler — один use case на файл.
type CreateUserHandler struct {
	repo domain.UserRepository
}

// NewCreateUserHandler создаёт обработчик.
func NewCreateUserHandler(repo domain.UserRepository) *CreateUserHandler {
	return &CreateUserHandler{repo: repo}
}

// Handle выполняет сценарий.
func (h *CreateUserHandler) Handle(ctx context.Context, cmd CreateUserCommand) (*domain.User, error) {
	u, err := domain.NewUser(uuid.New().String(), cmd.Email)
	if err != nil {
		return nil, err
	}
	if err := h.repo.Save(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}
