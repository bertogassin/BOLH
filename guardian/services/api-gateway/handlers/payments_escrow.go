package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type EscrowPaymentHandlers struct {
	Store         store.Store
	httpClient    *http.Client
	stripeKey     string
	webhookSecret string
	strictMode    bool
}

func NewEscrowPaymentHandlers(st store.Store) *EscrowPaymentHandlers {
	production := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
	strict := production || strings.EqualFold(strings.TrimSpace(os.Getenv("ESCROW_STRICT")), "true") || strings.TrimSpace(os.Getenv("ESCROW_STRICT")) == "1"
	return &EscrowPaymentHandlers{
		Store:         st,
		httpClient:    &http.Client{Timeout: 12 * time.Second},
		stripeKey:     strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		webhookSecret: strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		strictMode:    strict,
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

func isEscrowOwnerOrAdmin(c *gin.Context, p *store.EscrowPayment) bool {
	if p == nil {
		return false
	}
	if c.GetString("user_type") == "admin" {
		return true
	}
	return p.ClientID == c.GetString("user_id")
}

func (h *EscrowPaymentHandlers) authoritativeAmountMinor(order *store.Order) (int64, error) {
	if order == nil {
		return 0, errors.New("order not found")
	}
	var acceptedTotal float64
	for _, m := range h.Store.MatchesByOrderID(order.ID) {
		if m.Status == "accepted" {
			acceptedTotal += m.FinalPrice
		}
	}
	if acceptedTotal > 0 {
		minor := toMinorUnits(acceptedTotal)
		if minor > 0 {
			return minor, nil
		}
	}
	// Booking creates fixed-price orders before matching. Only a fixed server-side
	// budget may be authorized before an accepted match exists.
	if order.BudgetMin > 0 && math.Abs(order.BudgetMax-order.BudgetMin) < 0.000001 {
		minor := toMinorUnits(order.BudgetMax)
		if minor > 0 {
			return minor, nil
		}
	}
	return 0, errors.New("order price is not finalized")
}

func (h *EscrowPaymentHandlers) stripeRequest(method, endpoint string, form url.Values, idempotencyKey string) (map[string]any, int, error) {
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
	if key := strings.TrimSpace(idempotencyKey); key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
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

func (h *EscrowPaymentHandlers) stripeAuthorize(orderID, userID, description, currency, paymentMethodID string, amountMinor int64, idempotencyKey string) (providerRef, clientSecret string, err error) {
	form := url.Values{}
	form.Set("amount", strconv.FormatInt(amountMinor, 10))
	form.Set("currency", strings.ToLower(currency))
	form.Set("capture_method", "manual")
	form.Set("confirm", "true")
	form.Set("payment_method", strings.TrimSpace(paymentMethodID))
	form.Set("description", description)
	form.Set("metadata[order_id]", orderID)
	form.Set("metadata[user_id]", userID)
	payload, _, reqErr := h.stripeRequest(http.MethodPost, "/payment_intents", form, idempotencyKey)
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

func (h *EscrowPaymentHandlers) stripeCapture(paymentIntentID, idempotencyKey string) error {
	_, _, err := h.stripeRequest(http.MethodPost, "/payment_intents/"+paymentIntentID+"/capture", url.Values{}, idempotencyKey)
	return err
}

func (h *EscrowPaymentHandlers) stripeCancel(paymentIntentID, idempotencyKey string) error {
	_, _, err := h.stripeRequest(http.MethodPost, "/payment_intents/"+paymentIntentID+"/cancel", url.Values{}, idempotencyKey)
	return err
}

func requestIdempotencyKey(c *gin.Context, fallback string) (string, error) {
	key := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if key == "" {
		key = fallback
	}
	if len(key) > 200 || strings.ContainsAny(key, "\r\n") {
		return "", errors.New("invalid idempotency key")
	}
	return key, nil
}

func (h *EscrowPaymentHandlers) Authorize(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		OrderID           string `json:"order_id" binding:"required"`
		PaymentMethodID   string `json:"payment_method_id"`
		PaymentMethodHint string `json:"payment_method_hint"`
		Description       string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if h.strictMode && (h.stripeKey == "" || h.webhookSecret == "") {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "payment provider or webhook verification is not configured"})
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
	amountMinor, err := h.authoritativeAmountMinor(order)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	key, err := requestIdempotencyKey(c, "escrow-auth:"+req.OrderID+":"+userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if existing := h.Store.EscrowPaymentByIdempotencyKey(key); existing != nil {
		c.JSON(http.StatusOK, gin.H{"payment": existing, "mode": existing.Provider})
		return
	}

	currency := normalizeCurrency("EUR")
	now := time.Now()
	payment := &store.EscrowPayment{
		ID:                uuid.New().String(),
		OrderID:           req.OrderID,
		ClientID:          userID,
		AmountMinor:       amountMinor,
		Amount:            float64(amountMinor) / 100,
		Currency:          currency,
		Provider:          "bolh_escrow_simulated",
		IdempotencyKey:    key,
		PaymentMethodHint: strings.TrimSpace(req.PaymentMethodHint),
		Status:            "creating",
		Description:       strings.TrimSpace(req.Description),
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := h.Store.CreateEscrowPayment(payment); err != nil {
		if existing := h.Store.EscrowPaymentByIdempotencyKey(key); existing != nil {
			c.JSON(http.StatusOK, gin.H{"payment": existing, "mode": existing.Provider})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": "could not create escrow payment"})
		return
	}

	mode := "simulated"
	clientSecret := ""
	paymentMethodID := strings.TrimSpace(req.PaymentMethodID)
	if h.stripeKey != "" && paymentMethodID != "" {
		providerRef, stripeClientSecret, stripeErr := h.stripeAuthorize(req.OrderID, userID, payment.Description, currency, paymentMethodID, amountMinor, key)
		if stripeErr != nil {
			payment.Status = "failed"
			payment.UpdatedAt = time.Now()
			_ = h.Store.UpdateEscrowPayment(payment)
			if h.strictMode {
				c.JSON(http.StatusBadGateway, gin.H{"error": "escrow authorization failed", "details": stripeErr.Error()})
				return
			}
		} else {
			payment.Provider = "stripe_manual_capture"
			payment.ProviderRef = providerRef
			mode = "stripe"
			clientSecret = stripeClientSecret
		}
	} else if h.strictMode {
		payment.Status = "failed"
		payment.UpdatedAt = time.Now()
		_ = h.Store.UpdateEscrowPayment(payment)
		c.JSON(http.StatusBadRequest, gin.H{"error": "payment_method_id is required for strict escrow mode"})
		return
	}

	payment.Status = "authorized"
	authorizedAt := time.Now()
	payment.AuthorizedAt = &authorizedAt
	payment.UpdatedAt = authorizedAt
	if err := h.Store.UpdateEscrowPayment(payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist escrow state"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"payment": payment, "mode": mode, "client_secret": clientSecret})
}

func (h *EscrowPaymentHandlers) ListByOrder(c *gin.Context) {
	userID := c.GetString("user_id")
	orderID := strings.TrimSpace(c.Param("order_id"))
	if userID == "" || orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "authentication and order_id required"})
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
	c.JSON(http.StatusOK, gin.H{"payments": h.Store.EscrowPaymentsByOrderID(orderID)})
}

func (h *EscrowPaymentHandlers) Release(c *gin.Context) {
	payment := h.Store.EscrowPaymentByID(c.Param("id"))
	if payment == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escrow payment not found"})
		return
	}
	if !isEscrowOwnerOrAdmin(c, payment) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if payment.Status == "released" {
		c.JSON(http.StatusOK, gin.H{"payment": payment})
		return
	}
	if payment.Status != "authorized" {
		c.JSON(http.StatusConflict, gin.H{"error": "payment is not in authorized state"})
		return
	}
	key, err := requestIdempotencyKey(c, "escrow-release:"+payment.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if payment.Provider == "stripe_manual_capture" && payment.ProviderRef != "" {
		if err := h.stripeCapture(payment.ProviderRef, key); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to release escrow payment", "details": err.Error()})
			return
		}
	}
	now := time.Now()
	payment.Status = "released"
	payment.ReleasedAt = &now
	payment.UpdatedAt = now
	if err := h.Store.UpdateEscrowPayment(payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist escrow state"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"payment": payment})
}

func (h *EscrowPaymentHandlers) Cancel(c *gin.Context) {
	payment := h.Store.EscrowPaymentByID(c.Param("id"))
	if payment == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "escrow payment not found"})
		return
	}
	if !isEscrowOwnerOrAdmin(c, payment) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if payment.Status == "cancelled" {
		c.JSON(http.StatusOK, gin.H{"payment": payment})
		return
	}
	if payment.Status != "authorized" && payment.Status != "creating" && payment.Status != "failed" {
		c.JSON(http.StatusConflict, gin.H{"error": "payment cannot be cancelled in current state"})
		return
	}
	key, err := requestIdempotencyKey(c, "escrow-cancel:"+payment.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if payment.Status == "authorized" && payment.Provider == "stripe_manual_capture" && payment.ProviderRef != "" {
		if err := h.stripeCancel(payment.ProviderRef, key); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to cancel escrow payment", "details": err.Error()})
			return
		}
	}
	now := time.Now()
	payment.Status = "cancelled"
	payment.CancelledAt = &now
	payment.UpdatedAt = now
	if err := h.Store.UpdateEscrowPayment(payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist escrow state"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"payment": payment})
}

func verifyStripeSignature(secret, header string, payload []byte, now time.Time) bool {
	if secret == "" || header == "" {
		return false
	}
	var timestamp string
	var signatures []string
	for _, part := range strings.Split(header, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			timestamp = kv[1]
		case "v1":
			signatures = append(signatures, kv[1])
		}
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || math.Abs(float64(now.Unix()-ts)) > 300 {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write(payload)
	expected := mac.Sum(nil)
	for _, raw := range signatures {
		provided, err := hex.DecodeString(raw)
		if err == nil && hmac.Equal(expected, provided) {
			return true
		}
	}
	return false
}

func (h *EscrowPaymentHandlers) StripeWebhook(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook body"})
		return
	}
	if !verifyStripeSignature(h.webhookSecret, c.GetHeader("Stripe-Signature"), body, time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stripe signature"})
		return
	}
	var event struct {
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID            string `json:"id"`
				PaymentIntent string `json:"payment_intent"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook json"})
		return
	}
	providerRef := event.Data.Object.ID
	if event.Type == "charge.refunded" && event.Data.Object.PaymentIntent != "" {
		providerRef = event.Data.Object.PaymentIntent
	}
	payment := h.Store.EscrowPaymentByProviderRef(providerRef)
	if payment == nil {
		// A valid Stripe event for another product/account object is acknowledged.
		c.JSON(http.StatusOK, gin.H{"received": true})
		return
	}
	now := time.Now()
	switch event.Type {
	case "payment_intent.amount_capturable_updated":
		payment.Status = "authorized"
		payment.AuthorizedAt = &now
	case "payment_intent.succeeded":
		payment.Status = "released"
		payment.ReleasedAt = &now
	case "payment_intent.canceled", "charge.refunded":
		payment.Status = "cancelled"
		payment.CancelledAt = &now
	case "payment_intent.payment_failed":
		payment.Status = "failed"
	default:
		c.JSON(http.StatusOK, gin.H{"received": true})
		return
	}
	payment.UpdatedAt = now
	if err := h.Store.UpdateEscrowPayment(payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist webhook state"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"received": true})
}
