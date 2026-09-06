package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type BidHandlers struct {
	Store store.Store
}

func (h *BidHandlers) bidServiceURL() string {
	return getenvBidServiceURL()
}

func getenvBidServiceURL() string { return os.Getenv("BID_SERVICE_URL") }

// tryMatchAfterBidFromProxy runs synchronous matching after a bid was created via bid-service.
func tryMatchAfterBidFromProxy(st store.Store, bidJSON []byte) {
	var raw struct {
		ID           string    `json:"id"`
		GuardID      string    `json:"guard_id"`
		Title        string    `json:"title"`
		Licenses     []string  `json:"licenses"`
		PricePerHour float64   `json:"price_per_hour"`
		Latitude     float64   `json:"latitude"`
		Longitude    float64   `json:"longitude"`
		RadiusKm     float64   `json:"radius_km"`
		Active       bool      `json:"active"`
		CreatedAt    time.Time `json:"created_at"`
		UpdatedAt    time.Time `json:"updated_at"`
	}
	if err := json.Unmarshal(bidJSON, &raw); err != nil {
		return
	}
	b := &store.Bid{
		ID:           raw.ID,
		GuardID:      raw.GuardID,
		Title:        raw.Title,
		Licenses:     raw.Licenses,
		PricePerHour: raw.PricePerHour,
		Latitude:     raw.Latitude,
		Longitude:    raw.Longitude,
		RadiusKm:     raw.RadiusKm,
		Active:       raw.Active,
		CreatedAt:    raw.CreatedAt,
		UpdatedAt:    raw.UpdatedAt,
	}
	orders := getOrdersForMatching(st)
	_ = TryMatchAfterBidWithOrders(st, b, orders)
}

func (h *BidHandlers) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}

	var req struct {
		Title        string   `json:"title" binding:"required"`
		Licenses     []string `json:"licenses"`
		PricePerHour float64  `json:"price_per_hour" binding:"required,min=0"`
		Latitude     float64  `json:"latitude" binding:"required"`
		Longitude    float64  `json:"longitude" binding:"required"`
		RadiusKm     float64  `json:"radius_km"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.RadiusKm <= 0 {
		req.RadiusKm = 10
	}
	if !isBidInputInvariantValid(req.PricePerHour, req.Latitude, req.Longitude, req.RadiusKm) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bid invariants"})
		return
	}

	if base := h.bidServiceURL(); base != "" {
		guardID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
			return
		}
		body := map[string]interface{}{
			"guard_id":       guardID.String(),
			"title":          req.Title,
			"licenses":       req.Licenses,
			"price_per_hour": req.PricePerHour,
			"latitude":       req.Latitude,
			"longitude":      req.Longitude,
			"radius_km":      req.RadiusKm,
		}
		jsonBody, _ := json.Marshal(body)
		client := &http.Client{Timeout: serviceHTTPTimeout}
		httpReq, err := http.NewRequest(http.MethodPost, base+"/bids", bytes.NewReader(jsonBody))
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "bid-service request build failed"})
			return
		}
		httpReq.Header.Set("Content-Type", "application/json")
		setInternalServiceAuth(httpReq)
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "bid-service unreachable"})
			return
		}
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusCreated {
			tryMatchAfterBidFromProxy(h.Store, data)
		}
		c.Data(resp.StatusCode, "application/json", data)
		return
	}

	now := time.Now()
	b := &store.Bid{
		ID:           uuid.New().String(),
		GuardID:      userID,
		Title:        req.Title,
		Licenses:     req.Licenses,
		PricePerHour: req.PricePerHour,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		RadiusKm:     req.RadiusKm,
		Active:       true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if !isBidInvariantValid(b) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bid invariants"})
		return
	}
	h.Store.CreateBid(b)
	TryMatchAfterBid(h.Store, b)
	c.JSON(http.StatusCreated, gin.H{"bid_id": b.ID, "bid": b})
}

// List returns all active bids (for map display). Requires auth.
func (h *BidHandlers) List(c *gin.Context) {
	if c.GetString("user_id") == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	all := h.Store.AllBids()
	active := make([]store.Bid, 0, len(all))
	for _, b := range all {
		if b.Active {
			active = append(active, b)
		}
	}
	c.JSON(http.StatusOK, gin.H{"bids": active})
}

func (h *BidHandlers) MyBids(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	bids := h.Store.BidsByGuardID(userID)
	c.JSON(http.StatusOK, gin.H{"bids": bids})
}

func (h *BidHandlers) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	b := h.Store.BidByID(id)
	if b == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bid not found"})
		return
	}
	if b.GuardID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"bid": b})
}

func (h *BidHandlers) Update(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	b := h.Store.BidByID(id)
	if b == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bid not found"})
		return
	}
	if b.GuardID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var req struct {
		Title        *string  `json:"title"`
		Licenses     []string `json:"licenses"`
		PricePerHour *float64 `json:"price_per_hour"`
		Latitude     *float64 `json:"latitude"`
		Longitude    *float64 `json:"longitude"`
		RadiusKm     *float64 `json:"radius_km"`
		Active       *bool    `json:"active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		b.Title = *req.Title
	}
	if req.Licenses != nil {
		b.Licenses = req.Licenses
	}
	if req.PricePerHour != nil {
		b.PricePerHour = *req.PricePerHour
	}
	if req.Latitude != nil {
		b.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		b.Longitude = *req.Longitude
	}
	if req.RadiusKm != nil {
		b.RadiusKm = *req.RadiusKm
	}
	if req.Active != nil {
		b.Active = *req.Active
	}
	if !isBidInvariantValid(b) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bid values"})
		return
	}
	b.UpdatedAt = time.Now()
	h.Store.UpdateBid(b)
	c.JSON(http.StatusOK, gin.H{"bid": b})
}

func isBidInputInvariantValid(pricePerHour, latitude, longitude, radiusKm float64) bool {
	if pricePerHour < 0 {
		return false
	}
	if latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 {
		return false
	}
	return radiusKm >= 0
}

func isBidInvariantValid(b *store.Bid) bool {
	if b == nil {
		return false
	}
	return isBidInputInvariantValid(b.PricePerHour, b.Latitude, b.Longitude, b.RadiusKm)
}
