package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

func addMatchNotification(st store.Store, o *store.Order, finalPrice float64) {
	n := &store.Notification{
		ID:        uuid.New().String(),
		UserID:    o.ClientID,
		Title:     "Guard assigned",
		Body:      "Your reservation has an assigned guard. Price: " + fmt.Sprintf("%.2f", finalPrice) + " EUR",
		Read:      false,
		CreatedAt: time.Now(),
	}
	st.AddNotification(n)
}

func notifyOnMatch(st store.Store, o *store.Order, finalPrice float64) {
	url := os.Getenv("NOTIFY_URL")
	if url == "" {
		return
	}
	u := st.UserByID(o.ClientID)
	if u == nil || u.Email == "" {
		return
	}
	body, _ := json.Marshal(map[string]interface{}{
		"client_email": u.Email,
		"order_id":     o.ID,
		"order_title":  o.Title,
		"final_price":  finalPrice,
	})
	req, _ := http.NewRequest(http.MethodPost, url+"/notify/match", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	go func() { http.DefaultClient.Do(req) }()
}

// TryMatchAfterOrder finds the best active bid for the order (license, budget, distance), creates a match, updates order status.
func TryMatchAfterOrder(st store.Store, o *store.Order) {
	TryMatchAfterOrderWithBids(st, o, st.AllBids())
}

// TryMatchAfterOrderWithBids finds the best active bid from the given list for the order, creates a match, updates order status.
// Caller may persist the order to store after (e.g. when order came from order-service proxy) so handleMatches can resolve it.
func TryMatchAfterOrderWithBids(st store.Store, o *store.Order, bids []store.Bid) {
	if len(bids) == 0 {
		return
	}
	var best *store.Bid
	for i := range bids {
		b := &bids[i]
		if !b.Active {
			continue
		}
		if o.BudgetMin > 0 && b.PricePerHour < o.BudgetMin {
			continue
		}
		if o.BudgetMax > 0 && b.PricePerHour > o.BudgetMax {
			continue
		}
		if len(o.RequiredLicenses) > 0 {
			has := false
			for _, l := range o.RequiredLicenses {
				for _, bl := range b.Licenses {
					if l == bl {
						has = true
						break
					}
				}
			}
			if !has {
				continue
			}
		}
		dist := distanceKm(o.Latitude, o.Longitude, b.Latitude, b.Longitude)
		if b.RadiusKm > 0 && dist > b.RadiusKm {
			continue
		}
		if best == nil || b.PricePerHour < best.PricePerHour {
			best = b
		}
	}
	if best == nil {
		return
	}
	m := &store.Match{
		ID:         uuid.New().String(),
		OrderID:    o.ID,
		BidID:      best.ID,
		GuardID:    best.GuardID,
		FinalPrice: best.PricePerHour,
		CreatedAt:  time.Now(),
	}
	st.CreateMatch(m)
	notifyOnMatch(st, o, best.PricePerHour)
	addMatchNotification(st, o, best.PricePerHour)
	o.Status = "matched"
	o.UpdatedAt = time.Now()
	if st.OrderByID(o.ID) != nil {
		st.UpdateOrder(o)
	}
}

// TryMatchAfterBid finds the best open order for the bid (budget, license, distance), creates a match, updates order status.
func TryMatchAfterBid(st store.Store, b *store.Bid) {
	orders := st.AllOrders()
	TryMatchAfterBidWithOrders(st, b, orders)
}

// TryMatchAfterBidWithOrders finds the first open order that matches the bid, creates a match, updates that order in store.
// Returns the matched order if a match was created (caller may persist it when order came from order-service).
func TryMatchAfterBidWithOrders(st store.Store, b *store.Bid, orders []store.Order) *store.Order {
	if !b.Active {
		return nil
	}
	for i := range orders {
		o := &orders[i]
		if o.Status != "published" && o.Status != "open" {
			continue
		}
		if o.BudgetMin > 0 && b.PricePerHour < o.BudgetMin {
			continue
		}
		if o.BudgetMax > 0 && b.PricePerHour > o.BudgetMax {
			continue
		}
		if len(o.RequiredLicenses) > 0 {
			has := false
			for _, l := range o.RequiredLicenses {
				for _, bl := range b.Licenses {
					if l == bl {
						has = true
						break
					}
				}
			}
			if !has {
				continue
			}
		}
		dist := distanceKm(o.Latitude, o.Longitude, b.Latitude, b.Longitude)
		if b.RadiusKm > 0 && dist > b.RadiusKm {
			continue
		}
		m := &store.Match{
			ID:         uuid.New().String(),
			OrderID:    o.ID,
			BidID:      b.ID,
			GuardID:    b.GuardID,
			FinalPrice: b.PricePerHour,
			CreatedAt:  time.Now(),
		}
		st.CreateMatch(m)
		notifyOnMatch(st, o, b.PricePerHour)
		addMatchNotification(st, o, b.PricePerHour)
		o.Status = "matched"
		o.UpdatedAt = time.Now()
		if st.OrderByID(o.ID) != nil {
			st.UpdateOrder(o)
		}
		return o
	}
	return nil
}

func distanceKm(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthR * c
}
