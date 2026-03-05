package domain

import "errors"

var (
	ErrInvalidUser = errors.New("invalid user: id and email required")
	ErrNotFound    = errors.New("user not found")
)
