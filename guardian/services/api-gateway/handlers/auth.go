package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"guardian/api-gateway/middleware"
	"guardian/api-gateway/store"
)

const bcryptCost = 10
const notifyHTTPTimeout = 5 * time.Second
const accessCookieName = "guardian_access_token"
const accessTokenTTL = 30 * 24 * time.Hour
const loginMaxFailures = 5
const loginLockoutDuration = 15 * time.Minute
const betaDefaultUserType = "client"

type loginAttemptState struct {
	failures   int
	lastFailed time.Time
	lockedTill time.Time
}

var (
	loginAttemptsMu sync.Mutex
	loginAttempts   = map[string]loginAttemptState{}
)

type AuthHandlers struct {
	Store  store.Store
	Secret string
}

type Claims struct {
	UserID   string `json:"user_id"`
	UserType string `json:"user_type"`
	jwt.RegisteredClaims
}

func (h *AuthHandlers) Register(c *gin.Context) {
	applyBehaviorSignals(c)
	var req struct {
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=6"`
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name" binding:"required"`
		UserType  string `json:"user_type"` // client, guard
		Website   string `json:"website"`   // honeypot field, should stay empty
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.AddRiskScore(c.ClientIP(), 1, "register_invalid_payload")
		log.Printf("audit=register_failed reason=invalid_payload ip=%s", c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if isHoneypotTriggered(req.Website) {
		middleware.QuarantineIP(c.ClientIP(), "honeypot_form_register")
		log.Printf("audit=register_blocked reason=honeypot_trigger ip=%s", c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.UserType == "" {
		req.UserType = "client"
	}
	if req.UserType != "client" && req.UserType != "guard" {
		req.UserType = "client"
	}

	existing := h.Store.UserByEmailWithPassword(req.Email)
	if existing != nil {
		middleware.AddRiskScore(c.ClientIP(), 1, "register_existing_email")
		log.Printf("audit=register_failed reason=email_exists email=%s ip=%s", strings.ToLower(strings.TrimSpace(req.Email)), c.ClientIP())
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	u := &store.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hash),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		UserType:     req.UserType,
		Verified:     false,
		CreatedAt:    time.Now(),
	}
	h.Store.CreateUser(u)
	log.Printf("audit=register_success user_id=%s user_type=%s ip=%s", u.ID, u.UserType, c.ClientIP())
	middleware.ResetRiskScore(c.ClientIP())

	if notifyURL := os.Getenv("NOTIFY_URL"); notifyURL != "" {
		go func(email, firstName string) {
			body, _ := json.Marshal(map[string]string{"email": email, "first_name": firstName})
			req, _ := http.NewRequest(http.MethodPost, notifyURL+"/notify/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			setInternalServiceAuth(req)
			client := &http.Client{Timeout: notifyHTTPTimeout}
			client.Do(req)
		}(u.Email, u.FirstName)
	}

	token, err := h.generateToken(u.ID, u.UserType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
		return
	}

	setAccessCookie(c, token)
	c.JSON(http.StatusCreated, gin.H{
		"id":    u.ID,
		"token": token,
		"user": gin.H{
			"id":         u.ID,
			"email":      u.Email,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"user_type":  u.UserType,
			"verified":   u.Verified,
		},
	})
}

func (h *AuthHandlers) Login(c *gin.Context) {
	applyBehaviorSignals(c)
	var req struct {
		Email      string `json:"email" binding:"required,email"`
		Password   string `json:"password" binding:"required"`
		CompanyURL string `json:"company_url"` // honeypot field, should stay empty
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.AddRiskScore(c.ClientIP(), 1, "login_invalid_payload")
		log.Printf("audit=login_failed reason=invalid_payload ip=%s", c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if isHoneypotTriggered(req.CompanyURL) {
		middleware.QuarantineIP(c.ClientIP(), "honeypot_form_login")
		log.Printf("audit=login_blocked reason=honeypot_trigger ip=%s", c.ClientIP())
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	emailKey := normalizeEmail(req.Email)
	if lockoutRemaining(emailKey) > 0 {
		middleware.AddRiskScore(c.ClientIP(), 2, "login_lockout_active")
		log.Printf("audit=login_blocked reason=account_lockout email=%s ip=%s", emailKey, c.ClientIP())
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many failed attempts, try later"})
		return
	}

	u := h.Store.UserByEmailWithPassword(req.Email)
	if u == nil {
		registerLoginFailure(emailKey)
		middleware.AddRiskScore(c.ClientIP(), 2, "login_invalid_credentials")
		log.Printf("audit=login_failed reason=invalid_credentials email=%s ip=%s", strings.ToLower(strings.TrimSpace(req.Email)), c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		registerLoginFailure(emailKey)
		middleware.AddRiskScore(c.ClientIP(), 2, "login_invalid_credentials")
		log.Printf("audit=login_failed reason=invalid_credentials user_id=%s ip=%s", u.ID, c.ClientIP())
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	resetLoginFailures(emailKey)

	token, err := h.generateToken(u.ID, u.UserType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
		return
	}

	setAccessCookie(c, token)
	log.Printf("audit=login_success user_id=%s user_type=%s ip=%s", u.ID, u.UserType, c.ClientIP())
	middleware.ResetRiskScore(c.ClientIP())
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         u.ID,
			"email":      u.Email,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"user_type":  u.UserType,
			"verified":   u.Verified,
		},
	})
}

func (h *AuthHandlers) BetaLogin(c *gin.Context) {
	if !betaLoginEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "beta login disabled"})
		return
	}

	var req struct {
		UserType string `json:"user_type"`
	}
	_ = c.ShouldBindJSON(&req)

	userType := strings.TrimSpace(req.UserType)
	if userType != "client" && userType != "guard" {
		userType = betaDefaultUserType
	}
	email := betaLoginEmail(userType)

	u := h.Store.UserByEmailWithPassword(email)
	if u == nil {
		hash, err := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcryptCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare beta login"})
			return
		}
		u = &store.User{
			ID:           uuid.New().String(),
			Email:        email,
			PasswordHash: string(hash),
			FirstName:    "Beta",
			LastName:     "User",
			UserType:     userType,
			Verified:     true,
			CreatedAt:    time.Now(),
		}
		h.Store.CreateUser(u)
	}

	token, err := h.generateToken(u.ID, u.UserType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create token"})
		return
	}

	setAccessCookie(c, token)
	log.Printf("audit=beta_login user_id=%s user_type=%s ip=%s", u.ID, u.UserType, c.ClientIP())
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         u.ID,
			"email":      u.Email,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"user_type":  u.UserType,
			"verified":   u.Verified,
		},
	})
}

func (h *AuthHandlers) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	id, _ := userID.(string)
	u := h.Store.UserByID(id)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":         u.ID,
		"email":      u.Email,
		"phone":      u.Phone,
		"first_name": u.FirstName,
		"last_name":  u.LastName,
		"user_type":  u.UserType,
		"verified":   u.Verified,
		"created_at": u.CreatedAt,
	})
}

func (h *AuthHandlers) UpdateMe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	id, _ := userID.(string)
	u := h.Store.UserByID(id)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	var req struct {
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
		Phone     *string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated := *u
	if req.FirstName != nil {
		updated.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		updated.LastName = *req.LastName
	}
	if req.Phone != nil {
		updated.Phone = *req.Phone
	}
	h.Store.UpdateUser(&updated)
	c.JSON(http.StatusOK, gin.H{
		"id":         updated.ID,
		"email":      updated.Email,
		"phone":      updated.Phone,
		"first_name": updated.FirstName,
		"last_name":  updated.LastName,
		"user_type":  updated.UserType,
		"verified":   updated.Verified,
		"created_at": updated.CreatedAt,
	})
}

func (h *AuthHandlers) ChangePassword(c *gin.Context) {
	userID, _ := c.Get("user_id")
	id, _ := userID.(string)
	u := h.Store.UserByID(id)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	uWithPass := h.Store.UserByEmailWithPassword(u.Email)
	if uWithPass == nil || uWithPass.ID != id {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	u = uWithPass
	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid current password"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}
	if !h.Store.SetUserPasswordHash(id, string(hash)) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandlers) Logout(c *gin.Context) {
	if userID := c.GetString("user_id"); userID != "" {
		log.Printf("audit=logout user_id=%s ip=%s", userID, c.ClientIP())
	}
	clearAccessCookie(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandlers) generateToken(userID, userType string) (string, error) {
	claims := Claims{
		UserID:   userID,
		UserType: userType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(h.Secret))
}

func setAccessCookie(c *gin.Context, token string) {
	secure := requestIsHTTPS(c)
	domain := strings.TrimSpace(os.Getenv("AUTH_COOKIE_DOMAIN"))
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookieName, token, int(accessTokenTTL.Seconds()), "/", domain, secure, true)
}

func clearAccessCookie(c *gin.Context) {
	secure := requestIsHTTPS(c)
	domain := strings.TrimSpace(os.Getenv("AUTH_COOKIE_DOMAIN"))
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookieName, "", -1, "/", domain, secure, true)
}

func requestIsHTTPS(c *gin.Context) bool {
	if c.Request != nil && c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func lockoutRemaining(email string) time.Duration {
	if email == "" {
		return 0
	}
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	state, ok := loginAttempts[email]
	if !ok {
		return 0
	}
	now := time.Now()
	if now.After(state.lockedTill) {
		// Lock expired; also clean stale state.
		if state.failures == 0 || now.Sub(state.lastFailed) > loginLockoutDuration {
			delete(loginAttempts, email)
			return 0
		}
		return 0
	}
	return state.lockedTill.Sub(now)
}

func registerLoginFailure(email string) {
	if email == "" {
		return
	}
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	now := time.Now()
	state := loginAttempts[email]
	if now.Sub(state.lastFailed) > loginLockoutDuration {
		state.failures = 0
		state.lockedTill = time.Time{}
	}
	state.failures++
	state.lastFailed = now
	if state.failures >= loginMaxFailures {
		state.lockedTill = now.Add(loginLockoutDuration)
		state.failures = 0
	}
	loginAttempts[email] = state
}

func resetLoginFailures(email string) {
	if email == "" {
		return
	}
	loginAttemptsMu.Lock()
	delete(loginAttempts, email)
	loginAttemptsMu.Unlock()
}

func isHoneypotTriggered(v string) bool {
	return strings.TrimSpace(v) != ""
}

func applyBehaviorSignals(c *gin.Context) {
	ip := c.ClientIP()
	scoreHeader := strings.TrimSpace(c.GetHeader("X-Behavior-Score"))
	if scoreHeader != "" {
		score, err := strconv.Atoi(scoreHeader)
		if err == nil {
			switch {
			case score < 20:
				middleware.AddRiskScore(ip, 3, "behavior_score_very_low")
			case score < 40:
				middleware.AddRiskScore(ip, 2, "behavior_score_low")
			case score < 60:
				middleware.AddRiskScore(ip, 1, "behavior_score_medium")
			default:
				// High score is treated as neutral in observe mode.
			}
		}
	}
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Behavior-Autofill")), "1") {
		middleware.AddRiskScore(ip, 1, "behavior_autofill")
	}
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Behavior-FastSubmit")), "1") {
		middleware.AddRiskScore(ip, 2, "behavior_fast_submit")
	}
}

func betaLoginEnabled() bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("BETA_LOGIN_ENABLED")))
	if raw == "" {
		return true
	}
	return raw == "1" || raw == "true" || raw == "yes"
}

func betaLoginEmail(userType string) string {
	raw := strings.TrimSpace(os.Getenv("BETA_LOGIN_EMAIL"))
	if raw != "" {
		return strings.ToLower(raw)
	}
	if userType == "guard" {
		return "beta-guard@bolhsecurity.local"
	}
	return "beta-client@bolhsecurity.local"
}
