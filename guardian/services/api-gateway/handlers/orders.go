package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

// orderServiceOrder is the JSON shape returned by order-service.
type orderServiceOrder struct {
	ID               string    `json:"id"`
	ClientID         string    `json:"client_id"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	RequiredLicenses []string  `json:"required_licenses"`
	GuardCount       int       `json:"guard_count"`
	BudgetMin        float64   `json:"budget_min"`
	BudgetMax        float64   `json:"budget_max"`
	Latitude         float64   `json:"latitude"`
	Longitude        float64   `json:"longitude"`
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

const serviceHTTPTimeout = 5 * time.Second
const internalTokenHeader = "X-Internal-Token"

func tryMatchAfterOrderFromProxy(st store.Store, orderServiceBase string, orderJSON []byte) {
	var raw orderServiceOrder
	if err := json.Unmarshal(orderJSON, &raw); err != nil {
		return
	}
	o := &store.Order{
		ID:               raw.ID,
		ClientID:         raw.ClientID,
		Title:            raw.Title,
		Description:      raw.Description,
		RequiredLicenses: raw.RequiredLicenses,
		BudgetMin:        raw.BudgetMin,
		BudgetMax:        raw.BudgetMax,
		Latitude:         raw.Latitude,
		Longitude:        raw.Longitude,
		StartTime:        raw.StartTime,
		EndTime:          raw.EndTime,
		Status:           raw.Status,
		GuardCount:       raw.GuardCount,
		CreatedAt:        raw.CreatedAt,
		UpdatedAt:        raw.UpdatedAt,
	}
	if !isOrderInvariantValid(o) {
		return
	}
	bids := getBidsForMatching(st)
	TryMatchAfterOrderWithBids(st, o, bids)
	if st.OrderByID(o.ID) == nil {
		st.CreateOrder(o)
	}
}

func getBidsForMatching(st store.Store) []store.Bid {
	if base := os.Getenv("BID_SERVICE_URL"); base != "" {
		client := &http.Client{Timeout: serviceHTTPTimeout}
		req, err := http.NewRequest(http.MethodGet, base+"/bids", nil)
		if err != nil {
			return nil
		}
		setInternalServiceAuth(req)
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			return nil
		}
		defer resp.Body.Close()
		var raw []struct {
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
		if json.NewDecoder(resp.Body).Decode(&raw) != nil {
			return nil
		}
		out := make([]store.Bid, 0, len(raw))
		for _, r := range raw {
			out = append(out, store.Bid{
				ID:           r.ID,
				GuardID:      r.GuardID,
				Title:        r.Title,
				Licenses:     r.Licenses,
				PricePerHour: r.PricePerHour,
				Latitude:     r.Latitude,
				Longitude:    r.Longitude,
				RadiusKm:     r.RadiusKm,
				Active:       r.Active,
				CreatedAt:    r.CreatedAt,
				UpdatedAt:    r.UpdatedAt,
			})
		}
		return out
	}
	return st.AllBids()
}

// getOrdersForMatching returns open/published orders from store or from order-service when ORDER_SERVICE_URL is set.
func getOrdersForMatching(st store.Store) []store.Order {
	if base := os.Getenv("ORDER_SERVICE_URL"); base != "" {
		client := &http.Client{Timeout: serviceHTTPTimeout}
		req, err := http.NewRequest(http.MethodGet, base+"/orders", nil)
		if err != nil {
			return nil
		}
		setInternalServiceAuth(req)
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			return nil
		}
		defer resp.Body.Close()
		var raw []orderServiceOrder
		if json.NewDecoder(resp.Body).Decode(&raw) != nil {
			return nil
		}
		out := make([]store.Order, 0, len(raw))
		for _, r := range raw {
			if r.Status != "open" && r.Status != "published" {
				continue
			}
			out = append(out, store.Order{
				ID:               r.ID,
				ClientID:         r.ClientID,
				Title:            r.Title,
				Description:      r.Description,
				RequiredLicenses: r.RequiredLicenses,
				BudgetMin:        r.BudgetMin,
				BudgetMax:        r.BudgetMax,
				Latitude:         r.Latitude,
				Longitude:        r.Longitude,
				StartTime:        r.StartTime,
				EndTime:          r.EndTime,
				Status:           r.Status,
				GuardCount:       r.GuardCount,
				CreatedAt:        r.CreatedAt,
				UpdatedAt:        r.UpdatedAt,
			})
		}
		return out
	}
	return st.AllOrders()
}

type OrderHandlers struct {
	Store store.Store
}

func (h *OrderHandlers) orderServiceURL() string {
	return os.Getenv("ORDER_SERVICE_URL")
}

func (h *OrderHandlers) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		Title            string    `json:"title" binding:"required"`
		Description      string    `json:"description"`
		RequiredLicenses []string  `json:"required_licenses"`
		BudgetMin        float64   `json:"budget_min" binding:"required,min=0"`
		BudgetMax        float64   `json:"budget_max" binding:"required,gtefield=BudgetMin"`
		Latitude         float64   `json:"latitude" binding:"required"`
		Longitude        float64   `json:"longitude" binding:"required"`
		StartTime        time.Time `json:"start_time" binding:"required"`
		EndTime          time.Time `json:"end_time" binding:"required"`
		GuardCount       int       `json:"guard_count"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.EndTime.Before(req.StartTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end_time must be after start_time"})
		return
	}
	if req.GuardCount <= 0 {
		req.GuardCount = 1
	}
	if !isOrderInputInvariantValid(req.BudgetMin, req.BudgetMax, req.StartTime, req.EndTime, req.Latitude, req.Longitude, req.GuardCount) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order invariants"})
		return
	}

	if base := h.orderServiceURL(); base != "" {
		clientID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
			return
		}
		body := map[string]interface{}{
			"client_id":         clientID.String(),
			"title":             req.Title,
			"description":       req.Description,
			"required_licenses": req.RequiredLicenses,
			"guard_count":       req.GuardCount,
			"budget_min":        req.BudgetMin,
			"budget_max":        req.BudgetMax,
			"latitude":          req.Latitude,
			"longitude":         req.Longitude,
			"start_time":        req.StartTime,
			"end_time":          req.EndTime,
		}
		jsonBody, _ := json.Marshal(body)
		client := &http.Client{Timeout: serviceHTTPTimeout}
		httpReq, err := http.NewRequest(http.MethodPost, base+"/orders", bytes.NewReader(jsonBody))
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "order-service request build failed"})
			return
		}
		httpReq.Header.Set("Content-Type", "application/json")
		setInternalServiceAuth(httpReq)
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "order-service unreachable"})
			return
		}
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusCreated {
			tryMatchAfterOrderFromProxy(h.Store, base, data)
		}
		c.Data(resp.StatusCode, "application/json", data)
		return
	}

	now := time.Now()
	o := &store.Order{
		ID:               uuid.New().String(),
		ClientID:         userID,
		Title:            req.Title,
		Description:      req.Description,
		RequiredLicenses: req.RequiredLicenses,
		BudgetMin:        req.BudgetMin,
		BudgetMax:        req.BudgetMax,
		Latitude:         req.Latitude,
		Longitude:        req.Longitude,
		StartTime:        req.StartTime,
		EndTime:          req.EndTime,
		Status:           "published",
		GuardCount:       req.GuardCount,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if !isOrderInvariantValid(o) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order invariants"})
		return
	}
	h.Store.CreateOrder(o)
	TryMatchAfterOrder(h.Store, o)
	c.JSON(http.StatusCreated, gin.H{"order_id": o.ID, "order": o})
}

func (h *OrderHandlers) List(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	orders := h.Store.OrdersByClientID(userID)
	statusFilter := c.Query("status")
	q := c.Query("q")
	if statusFilter != "" {
		var filtered []store.Order
		for _, o := range orders {
			if o.Status == statusFilter {
				filtered = append(filtered, o)
			}
		}
		orders = filtered
	}
	if q != "" {
		lower := strings.ToLower(q)
		var filtered []store.Order
		for _, o := range orders {
			if strings.Contains(strings.ToLower(o.Title), lower) || strings.Contains(strings.ToLower(o.Description), lower) {
				filtered = append(filtered, o)
			}
		}
		orders = filtered
	}
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func (h *OrderHandlers) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	o := h.Store.OrderByID(id)
	if o == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if o.ClientID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	out := gin.H{"order": o}
	if o.Status == "matched" {
		matches := h.Store.MatchesByOrderID(id)
		if len(matches) > 0 {
			out["match"] = matches[0]
		}
	}
	c.JSON(http.StatusOK, out)
}

func (h *OrderHandlers) Update(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	o := h.Store.OrderByID(id)
	if o == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if o.ClientID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if o.Status != "draft" && o.Status != "published" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only edit draft or published order"})
		return
	}
	var req struct {
		Title       *string  `json:"title"`
		Description *string  `json:"description"`
		BudgetMin   *float64 `json:"budget_min"`
		BudgetMax   *float64 `json:"budget_max"`
		Status      *string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		o.Title = *req.Title
	}
	if req.Description != nil {
		o.Description = *req.Description
	}
	if req.BudgetMin != nil {
		o.BudgetMin = *req.BudgetMin
	}
	if req.BudgetMax != nil {
		o.BudgetMax = *req.BudgetMax
	}
	if req.Status != nil {
		o.Status = *req.Status
	}
	o.UpdatedAt = time.Now()
	h.Store.UpdateOrder(o)
	c.JSON(http.StatusOK, gin.H{"order": o})
}

func internalServiceToken() string {
	return strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN"))
}

func setInternalServiceAuth(req *http.Request) {
	if req == nil {
		return
	}
	if token := internalServiceToken(); token != "" {
		req.Header.Set(internalTokenHeader, token)
	}
}

func isOrderInputInvariantValid(
	budgetMin, budgetMax float64,
	startTime, endTime time.Time,
	latitude, longitude float64,
	guardCount int,
) bool {
	if budgetMin < 0 || budgetMax < budgetMin {
		return false
	}
	if !endTime.After(startTime) {
		return false
	}
	if latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 {
		return false
	}
	return guardCount > 0
}

func isOrderInvariantValid(o *store.Order) bool {
	if o == nil {
		return false
	}
	return isOrderInputInvariantValid(
		o.BudgetMin,
		o.BudgetMax,
		o.StartTime,
		o.EndTime,
		o.Latitude,
		o.Longitude,
		o.GuardCount,
	)
}

func (h *OrderHandlers) Cancel(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	o := h.Store.OrderByID(id)
	if o == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if o.ClientID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	o.Status = "cancelled"
	o.UpdatedAt = time.Now()
	h.Store.UpdateOrder(o)
	c.JSON(http.StatusOK, gin.H{"order": o})
}
