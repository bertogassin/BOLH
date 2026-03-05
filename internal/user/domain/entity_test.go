package domain

import (
	"testing"
)

func TestNewUser(t *testing.T) {
	u, err := NewUser("id-1", "a@b.c")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u.ID != "id-1" || u.Email != "a@b.c" {
		t.Errorf("got id=%q email=%q", u.ID, u.Email)
	}
}

func TestNewUser_Invalid(t *testing.T) {
	_, err := NewUser("", "a@b.c")
	if err != ErrInvalidUser {
		t.Errorf("want ErrInvalidUser, got %v", err)
	}
	_, err = NewUser("id", "")
	if err != ErrInvalidUser {
		t.Errorf("want ErrInvalidUser, got %v", err)
	}
}
