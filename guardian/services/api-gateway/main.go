// services/api-gateway/main.go
// API Gateway - Gin, JWT, Store, Order/Bid/Auth routes.

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
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
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"guardian/api-gateway/handlers"
	"guardian/api-gateway/middleware"
	"guardian/api-gateway/store"
)

type Server struct {
	router              *gin.Engine
	redis               *redis.Client
	st                  store.Store
	revokedTokenMu      sync.Mutex
	revokedTokenHashes  map[string]time.Time
	revokedUserBefore   map[string]time.Time
	authHandler         *handlers.AuthHandlers
	orderHandler        *handlers.OrderHandlers
	bidHandler          *handlers.BidHandlers
	cardHandler         *handlers.CardHandlers
	notifyHandler       *handlers.NotificationHandlers
	verificationHandler *handlers.VerificationHandlers
	documentHandler     *handlers.DocumentHandlers
	pluginHandler       *handlers.PluginHandlers
	planHandler         *handlers.PlanHandlers
	companyHandler      *handlers.CompanyHandlers
	escrowHandler       *handlers.EscrowPaymentHandlers
}

type Claims struct {
	UserID   string `json:"user_id"`
	UserType string `json:"user_type"`
	jwt.RegisteredClaims
}

type usedNonce struct {
	createdAt time.Time
}

var (
	signedNonceMu sync.Mutex
	signedNonces  = map[string]usedNonce{}
	signedStatsMu sync.Mutex
	signedStats   = map[string]int{}
)

type signingMode string

const (
	signingModeObserve signingMode = "observe"
	signingModePartial signingMode = "partial"
	signingModeFull    signingMode = "full"
)

func NewServer() *Server {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	secret := getSecret("JWT_SECRET", "dev-secret-change-in-production")
	var st store.Store
	if connStr := os.Getenv("DATABASE_URL"); connStr != "" {
		var err error
		st, err = store.NewPostgresStore(context.Background(), connStr)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		log.Println("using PostgreSQL store")
	} else {
		st = store.NewStore()
		log.Println("using in-memory store (set DATABASE_URL for persistence)")
	}
	seedE2EAdminUser(st)
	s := &Server{
		router:              gin.New(),
		redis:               redis.NewClient(&redis.Options{Addr: addr}),
		st:                  st,
		revokedTokenHashes:  map[string]time.Time{},
		revokedUserBefore:   map[string]time.Time{},
		authHandler:         &handlers.AuthHandlers{Store: st, Secret: secret},
		orderHandler:        &handlers.OrderHandlers{Store: st},
		bidHandler:          &handlers.BidHandlers{Store: st},
		cardHandler:         &handlers.CardHandlers{Store: st},
		notifyHandler:       &handlers.NotificationHandlers{Store: st},
		verificationHandler: &handlers.VerificationHandlers{Store: st},
		documentHandler:     &handlers.DocumentHandlers{Store: st},
		pluginHandler:       &handlers.PluginHandlers{Store: st},
		planHandler:         &handlers.PlanHandlers{Store: st},
		companyHandler:      &handlers.CompanyHandlers{Store: st},
		escrowHandler:       handlers.NewEscrowPaymentHandlers(st),
	}
	s.authHandler.Revoker = s
	if err := s.router.SetTrustedProxies(trustedProxiesFromEnv()); err != nil {
		log.Fatalf("trusted proxies: %v", err)
	}
	s.router.Use(gin.Recovery(), gin.Logger())
	s.router.Use(middleware.SecurityHeaders())
	s.router.Use(middleware.QuarantineShield())
	s.router.Use(middleware.RequestGuard())
	s.router.Use(middleware.RateLimit(100, time.Minute))
	s.router.Use(middleware.Cors(allowedOriginsFromEnv()))
	s.router.Use(s.authMiddleware())
	s.setupRoutes()
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"service":  "guardian-api-gateway",
			"env":      strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))),
			"build_id": appBuildID(),
			"commit":   appCommitSHA(),
		})
	})
	// Honeypot route: any hit is treated as hostile probing.
	s.router.Any("/api/v1/admin/root-shell", s.handleHoneypot)
	s.router.Any(canaryPathFromEnv(), s.handleCanaryToken)
	s.router.Any("/api/v1/documents/export-all.zip", s.handleDocumentCanary)
	return s
}

func seedE2EAdminUser(st store.Store) {
	email := strings.TrimSpace(os.Getenv("E2E_ADMIN_EMAIL"))
	password := os.Getenv("E2E_ADMIN_PASSWORD")
	if email == "" || password == "" {
		return
	}

	if existing := st.UserByEmailWithPassword(email); existing != nil {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("e2e admin seed failed: password hash error: %v", err)
		return
	}

	now := time.Now()
	st.CreateUser(&store.User{
		ID:           uuid.New().String(),
		Email:        email,
		PasswordHash: string(hash),
		FirstName:    "E2E",
		LastName:     "Admin",
		UserType:     "admin",
		Verified:     true,
		CreatedAt:    now,
	})
	log.Printf("e2e admin user seeded: %s", email)
}

func (s *Server) setupRoutes() {
	authBurstLimiter := middleware.RateLimit(10, time.Minute)
	authLoginLimiter := middleware.RateLimit(8, time.Minute)
	authAccountLimiter := middleware.RateLimitByKey(5, time.Minute, loginRateLimitKey)
	authAdaptiveLimiter := middleware.AdaptiveAuthRateLimit(12, time.Minute)
	mountV1Routes := func(base string) {
		s.router.POST(base+"/auth/register", authAdaptiveLimiter, authBurstLimiter, s.authHandler.Register)
		s.router.POST(base+"/auth/login", authAdaptiveLimiter, authLoginLimiter, authAccountLimiter, s.authHandler.Login)

		authorized := s.router.Group(base)
		authorized.Use(s.authRequired())
		{
			authorized.GET("/auth/me", s.authHandler.Me)
			authorized.PATCH("/auth/me", s.authHandler.UpdateMe)
			authorized.POST("/auth/me/password", authAdaptiveLimiter, authLoginLimiter, s.signedRequestRequired(), s.authHandler.ChangePassword)
			authorized.POST("/auth/logout", s.authHandler.Logout)

			authorized.POST("/orders", s.requireUserTypes("client"), s.signedRequestRequired(), s.orderHandler.Create)
			authorized.GET("/orders", s.requireUserTypes("client"), s.orderHandler.List)
			authorized.GET("/orders/:id/messages", s.orderHandler.ListMessages)
			authorized.POST("/orders/:id/messages", s.orderHandler.CreateMessage)
			authorized.GET("/orders/:id", s.requireUserTypes("client"), s.orderHandler.Get)
			authorized.PATCH("/orders/:id", s.requireUserTypes("client"), s.orderHandler.Update)
			authorized.POST("/orders/:id/cancel", s.requireUserTypes("client"), s.orderHandler.Cancel)

			authorized.POST("/bids", s.requireUserTypes("guard"), s.signedRequestRequired(), s.bidHandler.Create)
			authorized.GET("/bids", s.bidHandler.List)
			authorized.GET("/my/bids", s.requireUserTypes("guard"), s.bidHandler.MyBids)
			authorized.GET("/bids/:id", s.requireUserTypes("guard"), s.bidHandler.Get)
			authorized.PATCH("/bids/:id", s.requireUserTypes("guard"), s.bidHandler.Update)

			authorized.GET("/matches", s.handleMatches)
			authorized.POST("/matches/:id/accept", s.handleAcceptMatch)

			authorized.GET("/cards", s.cardHandler.List)
			authorized.POST("/cards", s.cardHandler.Create)
			authorized.DELETE("/cards/:id", s.cardHandler.Delete)
			authorized.POST("/payments/escrow/authorize", s.requireUserTypes("client"), s.signedRequestRequired(), s.escrowHandler.Authorize)
			authorized.GET("/payments/escrow/order/:order_id", s.escrowHandler.ListByOrder)
			authorized.POST("/payments/escrow/:id/release", s.requireUserTypes("client", "admin"), s.signedRequestRequired(), s.escrowHandler.Release)
			authorized.POST("/payments/escrow/:id/cancel", s.requireUserTypes("client", "admin"), s.signedRequestRequired(), s.escrowHandler.Cancel)

			authorized.GET("/notifications", s.notifyHandler.List)
			authorized.PATCH("/notifications/:id/read", s.notifyHandler.MarkRead)

			authorized.GET("/verification/status", s.verificationHandler.Status)
			authorized.POST("/verification", s.verificationHandler.Submit)
			authorized.POST("/company/register", s.requireUserTypes("client", "agency"), s.signedRequestRequired(), s.companyHandler.Register)

			authorized.GET("/documents", s.documentHandler.List)
			authorized.GET("/documents/:id/file", s.documentHandler.GetFile)
			authorized.GET("/documents/:id", s.documentHandler.Get)
			authorized.POST("/documents/upload", s.signedRequestRequired(), s.documentHandler.Upload)
			authorized.POST("/documents/:id/sign", s.documentHandler.Sign)
			authorized.DELETE("/documents/:id", s.documentHandler.Delete)

			authorized.GET("/plugins/templates", s.pluginHandler.Templates)
			authorized.GET("/plugins/my", s.pluginHandler.My)
			authorized.POST("/plugins", s.pluginHandler.Create)
			authorized.GET("/plugins/:id", s.pluginHandler.Get)
			authorized.POST("/plugins/:id/publish", s.pluginHandler.Publish)
			authorized.GET("/plugins/:id/team", s.pluginHandler.ListTeam)
			authorized.POST("/plugins/:id/team", s.pluginHandler.AddTeamMember)
			authorized.DELETE("/plugins/:id/team/:user_id", s.pluginHandler.RemoveTeamMember)
			authorized.GET("/plugins/:id/comments", s.pluginHandler.ListComments)
			authorized.POST("/plugins/:id/comments", s.pluginHandler.AddComment)
			authorized.PATCH("/plugins/:id/comments/:comment_id/resolve", s.pluginHandler.ResolveComment)
			authorized.GET("/plugins/:id/export", s.pluginHandler.Export)

			authorized.GET("/plans", s.planHandler.List)
			authorized.GET("/plans/:id", s.planHandler.Get)
			authorized.POST("/plans", s.planHandler.Create)
			authorized.PATCH("/plans/:id", s.planHandler.Update)
			authorized.DELETE("/plans/:id", s.planHandler.Delete)
			authorized.POST("/plans/:id/tasks", s.planHandler.AddTask)
			authorized.PATCH("/plans/:id/tasks/:task_id", s.planHandler.UpdateTask)
			authorized.DELETE("/plans/:id/tasks/:task_id", s.planHandler.DeleteTask)
		}

		admin := s.router.Group(base + "/admin")
		admin.Use(s.adminRequired())
		{
			admin.GET("/users", s.handleAdminListUsers)
			admin.GET("/users/:id", s.handleAdminGetUser)
			admin.GET("/orders", s.handleAdminListOrders)
			admin.GET("/security/summary", s.handleAdminSecuritySummary)
		}
	}

	// Support both prefixed (/api/v1) and stripped (/v1) routing behind proxies.
	mountV1Routes("/api/v1")
	mountV1Routes("/v1")
}

func (s *Server) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := tokenFromRequest(c)
		if token == "" {
			c.Next()
			return
		}
		claims, err := s.validateToken(token)
		if err != nil {
			c.Next()
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("user_type", claims.UserType)
		c.Next()
	}
}

func tokenFromRequest(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	if cookieToken, err := c.Cookie("guardian_access_token"); err == nil {
		return strings.TrimSpace(cookieToken)
	}
	return ""
}

func (s *Server) authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := c.Get("user_id"); !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
			return
		}
		c.Next()
	}
}

func (s *Server) requireUserTypes(userTypes ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(userTypes))
	for _, t := range userTypes {
		if t != "" {
			allowed[t] = true
		}
	}
	return func(c *gin.Context) {
		userType := c.GetString("user_type")
		if !allowed[userType] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func (s *Server) signedRequestRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		mode := requestSigningMode()
		enforce := shouldEnforceSigningForPath(mode, c.FullPath())
		nonce := strings.TrimSpace(c.GetHeader("X-Request-Nonce"))
		tsRaw := strings.TrimSpace(c.GetHeader("X-Request-Timestamp"))
		sig := strings.TrimSpace(c.GetHeader("X-Request-Signature"))
		integrity := strings.TrimSpace(c.GetHeader("X-Client-Integrity"))
		hasBearer := hasBearerAuthHeader(c)

		if enforce && !hasBearer {
			if token := tokenFromRequest(c); token != "" {
				incSignedStat("cookie_session_compat")
				middleware.LogIncident("signed_request_cookie_session_compat", map[string]string{
					"path": c.FullPath(),
					"mode": string(mode),
				})
				c.Next()
				return
			}
			incSignedStat("rejected_missing_token")
			middleware.LogIncident("signed_request_rejected", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"reason":  "auth_required",
				"enforce": "1",
			})
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
			return
		}

		if nonce == "" || tsRaw == "" || sig == "" {
			if enforce {
				incSignedStat("rejected_missing_headers")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "missing_headers",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "signed request required"})
				return
			}
			incSignedStat("missing_headers")
			middleware.LogIncident("signed_request_missing", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}

		ts, err := strconv.ParseInt(tsRaw, 10, 64)
		if err != nil {
			if enforce {
				incSignedStat("rejected_invalid_timestamp")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "invalid_timestamp",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature timestamp"})
				return
			}
			incSignedStat("invalid_timestamp")
			middleware.AddRiskScore(c.ClientIP(), 1, "signed_request_invalid_timestamp")
			middleware.LogIncident("signed_request_invalid_timestamp", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}
		now := time.Now().Unix()
		if ts < now-180 || ts > now+30 {
			if enforce {
				incSignedStat("rejected_expired")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "expired_signature",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "expired signature"})
				return
			}
			incSignedStat("expired")
			middleware.AddRiskScore(c.ClientIP(), 1, "signed_request_expired")
			middleware.LogIncident("signed_request_expired", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}
		if isNonceUsed(nonce) {
			if enforce {
				incSignedStat("rejected_replay")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "replay_detected",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "replay detected"})
				return
			}
			incSignedStat("replay_observe")
			middleware.AddRiskScore(c.ClientIP(), 1, "signed_request_replay_observe")
			middleware.LogIncident("signed_request_replay_detected", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}

		token := tokenFromRequest(c)
		if token == "" {
			if enforce {
				incSignedStat("rejected_missing_token")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "auth_required",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
				return
			}
			incSignedStat("missing_token")
			middleware.LogIncident("signed_request_missing_token", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}

		expected := signedRequestHash(c.Request.Method, c.FullPath(), tsRaw, nonce, token, integrity)
		if subtle.ConstantTimeCompare([]byte(expected), []byte(strings.ToLower(sig))) != 1 {
			if enforce {
				incSignedStat("rejected_invalid_signature")
				middleware.LogIncident("signed_request_rejected", map[string]string{
					"path":    c.FullPath(),
					"mode":    string(mode),
					"reason":  "invalid_signature",
					"enforce": "1",
				})
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid request signature"})
				return
			}
			incSignedStat("invalid_signature")
			middleware.AddRiskScore(c.ClientIP(), 2, "signed_request_invalid_signature")
			middleware.LogIncident("signed_request_invalid_signature", map[string]string{
				"path":    c.FullPath(),
				"mode":    string(mode),
				"enforce": "0",
			})
			c.Next()
			return
		}

		markNonceUsed(nonce)
		incSignedStat("valid")
		middleware.LogIncident("signed_request_valid", map[string]string{
			"path":    c.FullPath(),
			"mode":    string(mode),
			"enforce": boolToFlag(enforce),
		})
		c.Next()
	}
}

func signedRequestHash(method, path, ts, nonce, token, integrity string) string {
	payload := strings.ToUpper(strings.TrimSpace(method)) + "|" + strings.TrimSpace(path) + "|" + ts + "|" + nonce + "|" + token + "|" + integrity
	sum := sha256.Sum256([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func isNonceUsed(nonce string) bool {
	signedNonceMu.Lock()
	defer signedNonceMu.Unlock()
	cleanupNoncesLocked()
	_, ok := signedNonces[nonce]
	return ok
}

func markNonceUsed(nonce string) {
	signedNonceMu.Lock()
	signedNonces[nonce] = usedNonce{createdAt: time.Now()}
	cleanupNoncesLocked()
	signedNonceMu.Unlock()
}

func cleanupNoncesLocked() {
	cutoff := time.Now().Add(-10 * time.Minute)
	for n, v := range signedNonces {
		if v.createdAt.Before(cutoff) {
			delete(signedNonces, n)
		}
	}
	maxSize := signedNonceCacheMax()
	if len(signedNonces) <= maxSize {
		return
	}
	// Drop arbitrary entries to keep memory bounded in observe mode under floods.
	extra := len(signedNonces) - maxSize
	for n := range signedNonces {
		delete(signedNonces, n)
		extra--
		if extra <= 0 {
			break
		}
	}
}

func requestSigningMode() signingMode {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("STRICT_SIGNED_REQUESTS")), "true") {
		return signingModeFull
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("SIGNED_REQUEST_MODE"))) {
	case string(signingModeFull):
		return signingModeFull
	case string(signingModePartial):
		return signingModePartial
	default:
		return signingModePartial
	}
}

func shouldEnforceSigningForPath(mode signingMode, path string) bool {
	switch mode {
	case signingModeFull:
		return true
	case signingModePartial:
		return partialSigningPaths()[path]
	default:
		return false
	}
}

func partialSigningPaths() map[string]bool {
	paths := map[string]bool{
		"/api/v1/auth/me/password": true,
		"/api/v1/orders":           true,
		"/api/v1/bids":             true,
		"/api/v1/documents/upload": true,
		"/api/v1/company/register": true,
		"/api/v1/payments/escrow/authorize": true,
		"/api/v1/payments/escrow/:id/release": true,
		"/api/v1/payments/escrow/:id/cancel": true,
	}
	if raw := strings.TrimSpace(os.Getenv("SIGNED_REQUEST_PARTIAL_PATHS")); raw != "" {
		custom := map[string]bool{}
		for _, p := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				custom[trimmed] = true
			}
		}
		if len(custom) > 0 {
			return custom
		}
	}
	return paths
}

func signedNonceCacheMax() int {
	raw := strings.TrimSpace(os.Getenv("SIGNED_NONCE_CACHE_MAX"))
	if raw == "" {
		return 10000
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1000 {
		return 10000
	}
	return v
}

func hasBearerAuthHeader(c *gin.Context) bool {
	h := strings.TrimSpace(c.GetHeader("Authorization"))
	return strings.HasPrefix(h, "Bearer ")
}

func boolToFlag(v bool) string {
	if v {
		return "1"
	}
	return "0"
}

func incSignedStat(name string) {
	if strings.TrimSpace(name) == "" {
		return
	}
	signedStatsMu.Lock()
	signedStats[name]++
	signedStatsMu.Unlock()
}

func signedStatsSnapshot() map[string]int {
	signedStatsMu.Lock()
	defer signedStatsMu.Unlock()
	out := make(map[string]int, len(signedStats))
	for k, v := range signedStats {
		out[k] = v
	}
	return out
}

func (s *Server) validateToken(token string) (*Claims, error) {
	var claims Claims
	_, err := jwt.ParseWithClaims(
		token,
		&claims,
		func(t *jwt.Token) (interface{}, error) { return []byte(s.authHandler.Secret), nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, err
	}
	if s.isTokenRevoked(token, &claims) {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return &claims, err
}

func (s *Server) RevokeToken(token string, expiresAt time.Time) {
	token = strings.TrimSpace(token)
	if token == "" {
		return
	}
	now := time.Now()
	if expiresAt.IsZero() || expiresAt.Before(now) {
		expiresAt = now.Add(24 * time.Hour)
	}
	hash := sha256.Sum256([]byte(token))
	encoded := hex.EncodeToString(hash[:])

	s.revokedTokenMu.Lock()
	s.revokedTokenHashes[encoded] = expiresAt
	s.revokedTokenMu.Unlock()
}

func (s *Server) RevokeUserBefore(userID string, revokedAt time.Time) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return
	}
	if revokedAt.IsZero() {
		revokedAt = time.Now()
	}

	s.revokedTokenMu.Lock()
	if prev, ok := s.revokedUserBefore[userID]; !ok || revokedAt.After(prev) {
		s.revokedUserBefore[userID] = revokedAt
	}
	s.revokedTokenMu.Unlock()
}

func (s *Server) isTokenRevoked(token string, claims *Claims) bool {
	now := time.Now()
	hash := sha256.Sum256([]byte(token))
	encoded := hex.EncodeToString(hash[:])

	s.revokedTokenMu.Lock()
	defer s.revokedTokenMu.Unlock()

	for key, exp := range s.revokedTokenHashes {
		if exp.Before(now) {
			delete(s.revokedTokenHashes, key)
		}
	}

	if exp, ok := s.revokedTokenHashes[encoded]; ok && exp.After(now) {
		return true
	}

	if claims == nil {
		return false
	}

	revokedAt, ok := s.revokedUserBefore[claims.UserID]
	if !ok {
		return false
	}
	if claims.IssuedAt == nil {
		return true
	}
	return !claims.IssuedAt.Time.After(revokedAt)
}

func allowedOriginsFromEnv() map[string]bool {
	origins := map[string]bool{
		"https://guardian.app":     true,
		"https://api.guardian.app": true,
	}
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env != "production" {
		origins["http://localhost:3003"] = true
		origins["http://localhost:3000"] = true
		origins["http://localhost:3001"] = true
	}
	if raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); raw != "" {
		for _, origin := range strings.Split(raw, ",") {
			o := strings.TrimSpace(origin)
			if o != "" {
				origins[o] = true
			}
		}
	}
	return origins
}

func (s *Server) adminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Admin-Key")
		secret := getSecret("ADMIN_SECRET", "admin-dev-secret")
		if subtle.ConstantTimeCompare([]byte(key), []byte(secret)) != 1 && c.GetString("user_type") != "admin" {
			log.Printf("audit=admin_access_denied ip=%s path=%s", c.ClientIP(), c.FullPath())
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin required"})
			return
		}
		log.Printf("audit=admin_access_granted ip=%s path=%s", c.ClientIP(), c.FullPath())
		c.Next()
	}
}

func getSecret(name, devFallback string) string {
	_ = devFallback
	value := strings.TrimSpace(os.Getenv(name))
	if value != "" {
		return value
	}
	if isProductionEnv() {
		log.Fatalf("%s must be set in production", name)
	}
	// Never use static fallback secrets, even in development.
	// Generate a process-local secret instead.
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		log.Fatalf("failed to generate %s: %v", name, err)
	}
	generated := base64.RawStdEncoding.EncodeToString(buf)
	log.Printf("warning: %s is not set, generated ephemeral secret for this process", name)
	return generated
}

func isProductionEnv() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
}

func trustedProxiesFromEnv() []string {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if raw == "" {
		return []string{"127.0.0.1", "::1"}
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		p := strings.TrimSpace(part)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"127.0.0.1", "::1"}
	}
	return out
}

func loginRateLimitKey(c *gin.Context) string {
	ip := strings.TrimSpace(c.ClientIP())
	raw, err := c.GetRawData()
	if err != nil {
		return ip
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	if len(raw) == 0 {
		return ip
	}
	var payload struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ip
	}
	email := strings.ToLower(strings.TrimSpace(payload.Email))
	if email == "" {
		return ip
	}
	return ip + "|" + email
}

func (s *Server) handleAdminListOrders(c *gin.Context) {
	orders := s.st.AllOrders()
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func (s *Server) handleAdminListUsers(c *gin.Context) {
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	filter := strings.ToLower(strings.TrimSpace(c.Query("filter")))
	users := s.st.AllUsers()

	out := make([]store.User, 0, len(users))
	for _, u := range users {
		if search != "" {
			fullName := strings.ToLower(strings.TrimSpace(u.FirstName + " " + u.LastName))
			email := strings.ToLower(strings.TrimSpace(u.Email))
			phone := strings.ToLower(strings.TrimSpace(u.Phone))
			if !strings.Contains(fullName, search) && !strings.Contains(email, search) && !strings.Contains(phone, search) {
				continue
			}
		}

		switch filter {
		case "", "all":
		case "client", "guard", "agency":
			if strings.ToLower(strings.TrimSpace(u.UserType)) != filter {
				continue
			}
		case "verified":
			if !u.Verified {
				continue
			}
		case "blocked":
			// Blocked flag is not yet implemented in user domain model.
			continue
		}
		out = append(out, u)
	}

	c.JSON(http.StatusOK, gin.H{"users": out})
}

func (s *Server) handleAdminGetUser(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	u := s.st.UserByID(id)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (s *Server) handleAdminSecuritySummary(c *gin.Context) {
	signedNonceMu.Lock()
	nonceSize := len(signedNonces)
	signedNonceMu.Unlock()
	c.JSON(http.StatusOK, gin.H{
		"signed_request_mode": requestSigningMode(),
		"signed_stats":        signedStatsSnapshot(),
		"nonce_cache_size":    nonceSize,
	})
}

func (s *Server) handleMatches(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	all := s.st.AllMatches()
	var out []store.Match
	for _, m := range all {
		o := s.st.OrderByID(m.OrderID)
		if o != nil && o.ClientID == uid {
			out = append(out, m)
		} else if m.GuardID == uid {
			out = append(out, m)
		}
	}
	c.JSON(http.StatusOK, gin.H{"matches": out})
}

func (s *Server) handleAcceptMatch(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) handleHoneypot(c *gin.Context) {
	ip := c.ClientIP()
	middleware.QuarantineIP(ip, "honeypot_trigger")
	middleware.LogIncident("honeypot_triggered", map[string]string{
		"ip":     ip,
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
	})
	// Return not found to avoid giving attackers useful signals.
	c.AbortWithStatus(http.StatusNotFound)
}

func (s *Server) handleCanaryToken(c *gin.Context) {
	ip := c.ClientIP()
	path := c.Request.URL.Path
	ua := c.GetHeader("User-Agent")
	middleware.QuarantineIP(ip, "canary_token_trigger")
	middleware.LogIncident("canary_triggered", map[string]string{
		"ip":         ip,
		"method":     c.Request.Method,
		"path":       path,
		"user_agent": ua,
	})
	go notifyCanaryAlert(ip, path, ua)
	// Hide existence of canary endpoint.
	c.AbortWithStatus(http.StatusNotFound)
}

func (s *Server) handleDocumentCanary(c *gin.Context) {
	ip := c.ClientIP()
	path := c.Request.URL.Path
	ua := c.GetHeader("User-Agent")
	middleware.QuarantineIP(ip, "document_canary_trigger")
	middleware.LogIncident("document_canary_triggered", map[string]string{
		"ip":         ip,
		"method":     c.Request.Method,
		"path":       path,
		"user_agent": ua,
	})
	go notifyCanaryAlert(ip, path, ua)
	c.AbortWithStatus(http.StatusNotFound)
}

func canaryPathFromEnv() string {
	raw := strings.TrimSpace(os.Getenv("CANARY_TOKEN_PATH"))
	if raw == "" {
		raw = "/.well-known/guardian-security-canary-9f2a7d.txt"
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return raw
}

func appBuildID() string {
	for _, key := range []string{"APP_BUILD_ID", "RELEASE_ID", "GITHUB_SHA"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			if key == "GITHUB_SHA" && len(value) > 12 {
				return value[:12]
			}
			return value
		}
	}
	return "dev"
}

func appCommitSHA() string {
	sha := strings.TrimSpace(os.Getenv("GITHUB_SHA"))
	if sha == "" {
		sha = strings.TrimSpace(os.Getenv("COMMIT_SHA"))
	}
	if len(sha) > 40 {
		sha = sha[:40]
	}
	if sha == "" {
		return "unknown"
	}
	return sha
}

func notifyCanaryAlert(ip, path, userAgent string) {
	webhook := strings.TrimSpace(os.Getenv("CANARY_ALERT_WEBHOOK"))
	if webhook == "" {
		return
	}
	payload := map[string]string{
		"event":      "canary_token_triggered",
		"ip":         ip,
		"path":       path,
		"user_agent": userAgent,
		"at":         time.Now().UTC().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		middleware.LogIncident("canary_alert_failed", map[string]string{
			"reason": "marshal_error",
			"error":  err.Error(),
		})
		return
	}
	req, err := http.NewRequest(http.MethodPost, webhook, bytes.NewReader(body))
	if err != nil {
		middleware.LogIncident("canary_alert_failed", map[string]string{
			"reason": "request_build",
			"error":  err.Error(),
		})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		middleware.LogIncident("canary_alert_failed", map[string]string{
			"reason": "webhook_unreachable",
			"error":  err.Error(),
		})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		middleware.LogIncident("canary_alert_failed", map[string]string{
			"reason": "webhook_status",
			"status": strconv.Itoa(resp.StatusCode),
		})
	}
}

func main() {
	server := NewServer()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(server.router.Run(":" + port))
}
