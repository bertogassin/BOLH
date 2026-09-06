package store

import (
	"sync"
	"testing"
	"time"
)

func TestMatchOffersRespectGuardCountAndAcceptance(t *testing.T) {
	st := NewMemoryStore()
	now := time.Now()
	st.CreateUser(&User{ID: "client", UserType: "client", CreatedAt: now})
	for _, id := range []string{"g1", "g2", "g3"} {
		st.CreateUser(&User{ID: id, UserType: "guard", Verified: true, CreatedAt: now})
	}
	st.CreateOrder(&Order{ID: "o1", ClientID: "client", Status: "published", GuardCount: 2, CreatedAt: now, UpdatedAt: now})
	st.CreateBid(&Bid{ID: "b1", GuardID: "g1", Active: true})
	st.CreateBid(&Bid{ID: "b2", GuardID: "g2", Active: true})
	st.CreateBid(&Bid{ID: "b3", GuardID: "g3", Active: true})

	if _, err := st.OfferMatch(&Match{ID: "m1", OrderID: "o1", BidID: "b1", GuardID: "g1", FinalPrice: 10}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.OfferMatch(&Match{ID: "m2", OrderID: "o1", BidID: "b2", GuardID: "g2", FinalPrice: 10}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.OfferMatch(&Match{ID: "m3", OrderID: "o1", BidID: "b3", GuardID: "g3", FinalPrice: 10}); err == nil {
		t.Fatal("expected capacity rejection")
	}

	if _, o, err := st.AcceptMatch("m1", "g1"); err != nil || o.Status != "matching" {
		t.Fatalf("first accept: status=%v err=%v", o.Status, err)
	}
	if _, o, err := st.AcceptMatch("m2", "g2"); err != nil || o.Status != "matched" {
		t.Fatalf("second accept: status=%v err=%v", o.Status, err)
	}
}

func TestConcurrentOfferCannotOverbook(t *testing.T) {
	st := NewMemoryStore()
	now := time.Now()
	st.CreateOrder(&Order{ID: "o1", ClientID: "client", Status: "published", GuardCount: 1, CreatedAt: now, UpdatedAt: now})
	var wg sync.WaitGroup
	var mu sync.Mutex
	success := 0
	for i, pair := range [][2]string{{"b1", "g1"}, {"b2", "g2"}} {
		wg.Add(1)
		go func(i int, bidGuard [2]string) {
			defer wg.Done()
			_, err := st.OfferMatch(&Match{ID: "m" + string(rune('1'+i)), OrderID: "o1", BidID: bidGuard[0], GuardID: bidGuard[1], FinalPrice: 10})
			if err == nil {
				mu.Lock()
				success++
				mu.Unlock()
			}
		}(i, pair)
	}
	wg.Wait()
	if success != 1 {
		t.Fatalf("expected exactly one offer, got %d", success)
	}
}

func TestSecurityStateAndNoncePersistenceContract(t *testing.T) {
	st := NewMemoryStore()
	now := time.Now()
	st.RevokeTokenHash("hash", now.Add(time.Hour))
	if !st.IsTokenHashRevoked("hash", now) {
		t.Fatal("revoked token not found")
	}
	st.RevokeUserBefore("u1", now)
	if got := st.UserRevokedBefore("u1"); got == nil || !got.Equal(now) {
		t.Fatalf("unexpected revoked-before: %v", got)
	}
	if !st.UseSignedNonce("nonce", now.Add(time.Minute)) {
		t.Fatal("first nonce should be accepted")
	}
	if st.UseSignedNonce("nonce", now.Add(time.Minute)) {
		t.Fatal("replayed nonce should be rejected")
	}
}

func TestEscrowIdempotencyKeyIsUnique(t *testing.T) {
	st := NewMemoryStore()
	p := &EscrowPayment{ID: "p1", OrderID: "o1", ClientID: "u1", AmountMinor: 1000, Currency: "EUR", Provider: "test", IdempotencyKey: "key", Status: "creating", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := st.CreateEscrowPayment(p); err != nil {
		t.Fatal(err)
	}
	p2 := *p
	p2.ID = "p2"
	if err := st.CreateEscrowPayment(&p2); err == nil {
		t.Fatal("duplicate idempotency key should fail")
	}
}

func TestVerifiedGuardLicensesAreServerControlled(t *testing.T) {
	st := NewMemoryStore()
	st.CreateUser(&User{ID: "g1", UserType: "guard", Verified: true})
	if err := st.SetVerifiedGuardLicenses("g1", []string{"SIA Door Supervisor", " sia door supervisor ", "First Aid"}); err != nil {
		t.Fatal(err)
	}
	got := st.VerifiedLicensesByGuardID("g1")
	if len(got) != 2 {
		t.Fatalf("expected deduplicated licenses, got %#v", got)
	}
}
