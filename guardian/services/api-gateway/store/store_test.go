package store

import (
	"testing"
	"time"
)

func TestMemoryStore_CreateUser_UserByID(t *testing.T) {
	st := NewMemoryStore()
	u := &User{
		ID:           "id-1",
		Email:        "a@b.c",
		PasswordHash: "hash",
		FirstName:    "John",
		LastName:     "Doe",
		UserType:     "client",
		Verified:     false,
		CreatedAt:    time.Now(),
	}
	st.CreateUser(u)
	got := st.UserByID("id-1")
	if got == nil {
		t.Fatal("UserByID: expected user")
	}
	if got.Email != "a@b.c" || got.FirstName != "John" {
		t.Errorf("got %+v", got)
	}
	if got.PasswordHash != "" {
		t.Error("UserByID must not return password hash")
	}
}

func TestMemoryStore_UserByEmailWithPassword(t *testing.T) {
	st := NewMemoryStore()
	u := &User{
		ID:           "id-2",
		Email:        "x@y.z",
		PasswordHash: "secret",
		FirstName:    "A",
		LastName:     "B",
		UserType:     "guard",
		CreatedAt:    time.Now(),
	}
	st.CreateUser(u)
	got := st.UserByEmailWithPassword("x@y.z")
	if got == nil || got.PasswordHash != "secret" {
		t.Errorf("UserByEmailWithPassword: got %+v", got)
	}
}

func TestMemoryStore_CreateOrder_OrdersByClientID(t *testing.T) {
	st := NewMemoryStore()
	now := time.Now()
	o := &Order{
		ID:        "ord-1",
		ClientID:  "client-1",
		Title:     "Test",
		BudgetMin: 10,
		BudgetMax: 20,
		Status:    "published",
		CreatedAt: now,
		UpdatedAt: now,
	}
	st.CreateOrder(o)
	orders := st.OrdersByClientID("client-1")
	if len(orders) != 1 || orders[0].Title != "Test" {
		t.Errorf("OrdersByClientID: got %+v", orders)
	}
}

func TestMemoryStore_CreateBid_AllBids(t *testing.T) {
	st := NewMemoryStore()
	now := time.Now()
	b := &Bid{
		ID:           "bid-1",
		GuardID:      "guard-1",
		Title:        "Bid",
		PricePerHour: 15,
		Active:       true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	st.CreateBid(b)
	all := st.AllBids()
	if len(all) != 1 || all[0].Title != "Bid" {
		t.Errorf("AllBids: got %+v", all)
	}
}

func TestMemoryStore_CreateMatch_MatchesByOrderID(t *testing.T) {
	st := NewMemoryStore()
	m := &Match{
		ID:         "m1",
		OrderID:    "ord-1",
		BidID:      "bid-1",
		GuardID:    "guard-1",
		FinalPrice: 100,
		CreatedAt:  time.Now(),
	}
	st.CreateMatch(m)
	matches := st.MatchesByOrderID("ord-1")
	if len(matches) != 1 || matches[0].GuardID != "guard-1" {
		t.Errorf("MatchesByOrderID: got %+v", matches)
	}
}
