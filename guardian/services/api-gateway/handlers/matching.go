package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
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
	if token := os.Getenv("INTERNAL_SERVICE_TOKEN"); token != "" {
		req.Header.Set("X-Internal-Token", token)
	}
	go func() {
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err == nil && resp != nil {
			_ = resp.Body.Close()
		}
	}()
}

// TryMatchAfterOrder finds the best active bid for the order (license, budget, distance), creates a match, updates order status.
func TryMatchAfterOrder(st store.Store, o *store.Order) {
	TryMatchAfterOrderWithBids(st, o, st.AllBids())
}

// TryMatchAfterOrderWithBids finds the best active bid from the given list for the order, creates a match, updates order status.
// Caller may persist the order to store after (e.g. when order came from order-service proxy) so handleMatches can resolve it.
func TryMatchAfterOrderWithBids(st store.Store, o *store.Order, bids []store.Bid) {
	if len(bids) == 0 || o == nil {
		return
	}
	candidates := make([]store.Bid, 0, len(bids))
	for i := range bids {
		b := bids[i]
		if !b.Active || !isEligibleVerifiedGuard(st, b.GuardID) {
			continue
		}
		if o.BudgetMin > 0 && b.PricePerHour < o.BudgetMin {
			continue
		}
		if o.BudgetMax > 0 && b.PricePerHour > o.BudgetMax {
			continue
		}
		if !hasAllRequiredLicenses(o.RequiredLicenses, st.VerifiedLicensesByGuardID(b.GuardID)) {
			continue
		}
		dist := distanceKm(o.Latitude, o.Longitude, b.Latitude, b.Longitude)
		if b.RadiusKm > 0 && dist > b.RadiusKm {
			continue
		}
		candidates = append(candidates, b)
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].PricePerHour == candidates[j].PricePerHour {
			di := distanceKm(o.Latitude, o.Longitude, candidates[i].Latitude, candidates[i].Longitude)
			dj := distanceKm(o.Latitude, o.Longitude, candidates[j].Latitude, candidates[j].Longitude)
			return di < dj
		}
		return candidates[i].PricePerHour < candidates[j].PricePerHour
	})

	required := o.GuardCount
	if required < 1 {
		required = 1
	}
	offered := 0
	for i := range candidates {
		if offered >= required {
			break
		}
		b := &candidates[i]
		m := &store.Match{ID: uuid.New().String(), OrderID: o.ID, BidID: b.ID, GuardID: b.GuardID, FinalPrice: b.PricePerHour, CreatedAt: time.Now()}
		updatedOrder, err := st.OfferMatch(m)
		if err != nil {
			continue
		}
		offered++
		notifyOnMatch(st, updatedOrder, b.PricePerHour)
		addMatchNotification(st, updatedOrder, b.PricePerHour)
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
	if !b.Active || !isEligibleVerifiedGuard(st, b.GuardID) {
		return nil
	}
	for i := range orders {
		o := &orders[i]
		if o.Status != "published" && o.Status != "open" && o.Status != "matching" {
			continue
		}
		if o.BudgetMin > 0 && b.PricePerHour < o.BudgetMin {
			continue
		}
		if o.BudgetMax > 0 && b.PricePerHour > o.BudgetMax {
			continue
		}
		if !hasAllRequiredLicenses(o.RequiredLicenses, st.VerifiedLicensesByGuardID(b.GuardID)) {
			continue
		}
		dist := distanceKm(o.Latitude, o.Longitude, b.Latitude, b.Longitude)
		if b.RadiusKm > 0 && dist > b.RadiusKm {
			continue
		}
		if st.OrderByID(o.ID) == nil {
			st.CreateOrder(o)
		}
		m := &store.Match{
			ID:         uuid.New().String(),
			OrderID:    o.ID,
			BidID:      b.ID,
			GuardID:    b.GuardID,
			FinalPrice: b.PricePerHour,
			CreatedAt:  time.Now(),
		}
		updatedOrder, err := st.OfferMatch(m)
		if err != nil {
			continue
		}
		notifyOnMatch(st, updatedOrder, b.PricePerHour)
		addMatchNotification(st, updatedOrder, b.PricePerHour)
		return updatedOrder
	}
	return nil
}

func isEligibleVerifiedGuard(st store.Store, guardID string) bool {
	u := st.UserByID(guardID)
	return u != nil && u.UserType == "guard" && u.Verified
}

func hasAllRequiredLicenses(required, actual []string) bool {
	if len(required) == 0 {
		return true
	}
	set := make(map[string]struct{}, len(actual))
	for _, license := range actual {
		key := strings.ToLower(strings.TrimSpace(license))
		if key != "" {
			set[key] = struct{}{}
		}
	}
	for _, license := range required {
		key := strings.ToLower(strings.TrimSpace(license))
		if key == "" {
			continue
		}
		if _, ok := set[key]; !ok {
			return false
		}
	}
	return true
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
