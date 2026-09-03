package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type EscrowPayment struct {
	ID                string     `json:"id"`
	OrderID           string     `json:"order_id"`
	ClientID          string     `json:"client_id"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	Provider          string     `json:"provider"`
	ProviderRef       string     `json:"provider_ref,omitempty"`
	PaymentMethodHint string     `json:"payment_method_hint,omitempty"`
	Status            string     `json:"status"`
	Description       string     `json:"description,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	AuthorizedAt      *time.Time `json:"authorized_at,omitempty"`
	ReleasedAt        *time.Time `json:"released_at,omitempty"`
	CancelledAt       *time.Time `json:"cancelled_at,omitempty"`
}

type EscrowPaymentHandlers struct {
	Store      store.Store
	httpClient *http.Client
	stripeKey  string
	strictMode bool

	mu       sync.RWMutex
	payments map[string]*EscrowPayment
}

func NewEscrowPaymentHandlers(st store.Store) *EscrowPaymentHandlers {
	production := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
	strict := production || strings.EqualFold(strings.TrimSpace(os.Getenv("ESCROW_STRICT")), "true") || strings.TrimSpace(os.Getenv("ESCROW_STRICT")) == "1"
	return &EscrowPaymentHandlers{
		Store:      st,
		httpClient: &http.Client{Timeout: 12 * time.Second},
		stripeKey:  strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		strictMode: strict,
		payments:   map[string]*EscrowPayment{},
	}
}

func normalizeCurrency(raw string) string {
	cur := strings.ToUpper(strings.TrimSpace(raw))
	if len(cur) != 3 {
		return "EUR"
	}
	return cur
}

func toMinorUnits(amount float64) int64 {
	return int64(math.Round(amount * 100.0))
}

func isEscrowOwnerOrAdmin(c *gin.Context, p *EscrowPayment) bool {
	userID := c.GetString("user_id")
	userType := c.GetString("user_type")
	if userType == "admin" {
		return true
	}
	return p.ClientID == userID
}

func copyEscrowPayment(in *EscrowPayment) *EscrowPayment {
	if in == nil {
		return nil
	}
	cp := *in
	return &cp
}

func (h *EscrowPaymentHandlers) findByID(id string) *EscrowPayment {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return copyEscrowPayment(h.payments[id])
}

func (h *EscrowPaymentHandlers) save(p *EscrowPayment) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.payments[p.ID] = copyEscrowPayment(p)
}

func (h *EscrowPaymentHandlers) listByOrder(orderID string) []EscrowPayment {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]EscrowPayment, 0, 2)
	for _, p := range h.payments {
		if p.OrderID == orderID {
			out = append(out, *p)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (h *EscrowPaymentHandlers) stripeRequest(method, endpoint string, form url.Values) (map[string]any, int, error) {
	if h.stripeKey == "" {
		return nil, http.StatusServiceUnavailable, fmt.Errorf("stripe key is not configured")
	}
	encoded := ""
	if form != nil {
		encoded = form.Encode()
	}
	req, err := http.NewRequest(method, "https://api.stripe.com/v1"+endpoint, strings.NewReader(encoded))
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	req.Header.Set("Authorization", "Bearer "+h.stripeKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var payload map[string]any
	if len(bytes.TrimSpace(body)) > 0 {
		_ = json.Unmarshal(body, &payload)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := "stripe request failed"
		if errObj, ok := payload["error"].(map[string]any); ok {
			if em, ok := errObj["message"].(string); ok && strings.TrimSpace(em) != "" {
				msg = em
			}
		}
		return payload, resp.StatusCode, errors.New(msg)
	}
	return payload, resp.StatusCode, nil
}

func (h *EscrowPaymentHandlers) stripeAuthorize(orderID, userID, description, currency, paymentMethodID string, amountMinor int64) (providerRef, clientSecret string, err error) {
	form := url.Values{}
	form.Set("amount", strconv.FormatInt(amountMinor, 10))
	form.Set("currency", strings.ToLower(currency))
	form.Set("capture_method", "manual")
	form.Set("confirm", "true")
	form.Set("payment_method", strings.TrimSpace(paymentMethodID))
	form.Set("description", description)
	form.Set("metadata[order_id]", orderID)
	form.Set("metadata[user_id]", userID)
	payload, _, reqErr := h.stripeRequest(http.MethodPost, "/payment_intents", form)
	if reqErr != nil {
		return "", "", reqErr
	}
	providerRef, _ = payload["id"].(string)
	clientSecret, _ = payload["client_secret"].(string)
	status, _ := payload["status"].(string)
	if providerRef == "" {
		return "", "", fmt.Errorf("stripe did not return payment intent id")
	}
	if status != "requires_capture" && status != "processing" && status != "succeeded" {
		return "", "", fmt.Errorf("stripe status is not hold-ready: %s", status)
	}
	return providerRef, clientSecret, nil
}

func (h *EscrowPaymentHandlers) stripeCapture(paymentIntentID string) error {
	_, _, err := h.stripeRequest(http.MethodPost, "/payment_intents/"+paymentIntentID+"/capture", url.Values{})
	return err
}

func (h *EscrowPaymentHandlers) stripeCancel(paymentIntentID string) error {
	_, _, err := h.stripeRequest(http.MethodPost, "/payment_intents/"+paymentIntentID+"/cancel", url.Values{})
	return err
}

func (h *EscrowPaymentHandlers) Authorize(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		OrderID           string  `json:"order_id" binding:"required"`
		Amount            float64 `json:"amount" binding:"required"`
		Currency          string  `json:"currency"`
		PaymentMethodID   string  `json:"payment_method_id"`
		PaymentMethodHint string  `json:"payment_method_hint"`
		Description       string  `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		return
	}
	if h.strictMode && h.stripeKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "payment provider is not configured"})
		return
	}
	order := h.Store.OrderByID(req.OrderID)
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if order.ClientID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	currency := normalizeCurrency(req.Currency)
	now := time.Now()
	payment := &EscrowPayment{
		ID:                uuid.New().String(),
		OrderID:           req.OrderID,
		ClientID:          userID,
		Amount:            req.Amount,
		Currency:          currency,
		Provider:          "bolh_escrow_simulated",
		PaymentMethodHint: strings.TrimSpace(req.PaymentMethodHint),
		Status:            "authorized",
		Description:       strings.TrimSpace(req.Description),
		CreatedAt:         now,
		AuthorizedAt:      &now,
	}

	mode := "simulated"
	clientSecret := ""
	stripeConfigured := h.stripeKey != ""
	paymentMethodID := strings.TrimSpace(req.PaymentMethodID)
	if stripeConfigured && paymentMethodID != "" {
		amountMinor := toMinorUnits(req.Amount)
		if amountMinor <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
			return
		}
		providerRef, stripeClientSecret, err := h.stripeAuthorize(req.OrderID, userID, payment.Description, currency, paymentMethodID, amountMinor)
		if err != nil {
			if h.strictMode {
				c.JSON(http.StatusBadGateway, gin.H{"error": "escrow authorization failed", "details": err.Error()})
				return
			}
		} else {
			payment.Provider = "stripe_manual_capture"
			payment.ProviderRef = providerRef
			mode = "stripe"
			clientSecret = stripeClientSecret
		}
	}
	if stripeConfigured && paymentMethodID == "" && h.strictMode {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment_method_id is required for strict escrow mode"})
		return
	}

	h.save(payment)
	c.JSON(http.StatusCreated, gin.H{
		"payment":       payment,
		"mode":          mode,
		"client_secret": clientSecret,
	})
}

func (h *EscrowPaymentHandlers) ListByOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	orderID := c.Param("order_id")
	if strings.TrimSpace(orderID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id required"})
		return
	}
	order := h.Store.OrderByID(orderID)
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if order.ClientID != userID && c.GetString("user_type") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"payments": h.listByOrder(orderID)})
}

func (h *EscrowPaymentHandlers) Release(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	payment := h.findByID(id)
	if payment == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escrow payment not found"})
		return
	}
	if !isEscrowOwnerOrAdmin(c, payment) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if payment.Status != "authorized" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment is not in authorized state"})
		return
	}
	if payment.Provider == "stripe_manual_capture" && payment.ProviderRef != "" {
		if err := h.stripeCapture(payment.ProviderRef); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to release escrow payment", "details": err.Error()})
			return
		}
	}
	now := time.Now()
	payment.Status = "released"
	payment.ReleasedAt = &now
	h.save(payment)
	c.JSON(http.StatusOK, gin.H{"payment": payment})
}

func (h *EscrowPaymentHandlers) Cancel(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	payment := h.findByID(id)
	if payment == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escrow payment not found"})
		return
	}
	if !isEscrowOwnerOrAdmin(c, payment) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if payment.Status != "authorized" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment is not in authorized state"})
		return
	}
	if payment.Provider == "stripe_manual_capture" && payment.ProviderRef != "" {
		if err := h.stripeCancel(payment.ProviderRef); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to cancel escrow payment", "details": err.Error()})
			return
		}
	}
	now := time.Now()
	payment.Status = "cancelled"
	payment.CancelledAt = &now
	h.save(payment)
	c.JSON(http.StatusOK, gin.H{"payment": payment})
}
