// Защита API: rate limiting, CORS, security headers.

package middleware

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimit — защита от DDoS. requests в per (например 100 в time.Minute).
func RateLimit(requests int, per time.Duration) gin.HandlerFunc {
	return rateLimitByKey(requests, per, func(c *gin.Context) string {
		return c.ClientIP()
	})
}

// RateLimitByKey — лимитирует запросы по произвольному ключу (например ip+email).
func RateLimitByKey(requests int, per time.Duration, keyFn func(c *gin.Context) string) gin.HandlerFunc {
	if keyFn == nil {
		keyFn = func(c *gin.Context) string { return c.ClientIP() }
	}
	return rateLimitByKey(requests, per, keyFn)
}

func rateLimitByKey(requests int, per time.Duration, keyFn func(c *gin.Context) string) gin.HandlerFunc {
	if requests <= 0 {
		requests = 1
	}
	if per <= 0 {
		per = time.Minute
	}
	type client struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}
	var (
		mu      sync.Mutex
		clients = make(map[string]*client)
	)
	go func() {
		for range time.NewTicker(time.Minute).C {
			mu.Lock()
			for ip, c := range clients {
				if time.Since(c.lastSeen) > 3*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()
	return func(c *gin.Context) {
		key := strings.TrimSpace(keyFn(c))
		if key == "" {
			key = c.ClientIP()
		}
		mu.Lock()
		if _, exists := clients[key]; !exists {
			clients[key] = &client{
				limiter: rate.NewLimiter(rate.Every(per/time.Duration(requests)), requests),
			}
		}
		clients[key].lastSeen = time.Now()
		if !clients[key].limiter.Allow() {
			mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too many requests",
				"retry_after": "1m",
			})
			return
		}
		mu.Unlock()
		c.Next()
	}
}

// Cors — строгие правила. allowedOrigins задаётся снаружи.
func Cors(allowedOrigins map[string]bool) gin.HandlerFunc {
	if allowedOrigins == nil {
		allowedOrigins = map[string]bool{}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
			c.Writer.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Behavior-Score, X-Behavior-Autofill, X-Behavior-FastSubmit, X-Client-Integrity, X-Request-Timestamp, X-Request-Nonce, X-Request-Signature",
			)
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// SecurityHeaders — заголовки безопасности.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		// Legacy header for old user agents; modern browsers ignore it.
		c.Writer.Header().Set("X-XSS-Protection", "0")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Writer.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		c.Writer.Header().Set("Cross-Origin-Resource-Policy", "same-site")
		c.Writer.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
		c.Writer.Header().Set(
			"Content-Security-Policy",
			"default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;",
		)
		if isTLSRequest(c) {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		c.Next()
	}
}

func isTLSRequest(c *gin.Context) bool {
	if c.Request != nil && c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

type quarantinedClient struct {
	until  time.Time
	reason string
}

var (
	quarantineMu      sync.Mutex
	quarantinedByIP   = map[string]quarantinedClient{}
	defaultQuarantine = 15 * time.Minute
)

type riskScoreState struct {
	score    int
	lastSeen time.Time
}

var (
	riskMu       sync.Mutex
	riskByIP     = map[string]riskScoreState{}
	riskMaxScore = 10
)

// QuarantineShield blocks requests from suspicious IPs for a limited time.
func QuarantineShield() gin.HandlerFunc {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now()
			quarantineMu.Lock()
			for ip, entry := range quarantinedByIP {
				if now.After(entry.until) {
					delete(quarantinedByIP, ip)
				}
			}
			quarantineMu.Unlock()
		}
	}()
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if ip == "" {
			c.Next()
			return
		}
		quarantineMu.Lock()
		entry, blocked := quarantinedByIP[ip]
		quarantineMu.Unlock()
		if blocked && time.Now().Before(entry.until) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "request temporarily blocked",
				"retry_after": "15m",
			})
			return
		}
		c.Next()
	}
}

// QuarantineIP marks an IP as suspicious and blocks it temporarily.
func QuarantineIP(ip, reason string) {
	if strings.TrimSpace(ip) == "" {
		return
	}
	AddRiskScore(ip, 5, "quarantine:"+reason)
	if strings.TrimSpace(reason) == "" {
		reason = "suspicious_activity"
	}
	quarantineMu.Lock()
	quarantinedByIP[ip] = quarantinedClient{
		until:  time.Now().Add(defaultQuarantine),
		reason: reason,
	}
	quarantineMu.Unlock()
	LogIncident("quarantine", map[string]string{
		"ip":       ip,
		"reason":   reason,
		"duration": defaultQuarantine.String(),
	})
}

// AddRiskScore increases suspicion score for an IP.
func AddRiskScore(ip string, delta int, reason string) {
	ip = strings.TrimSpace(ip)
	if ip == "" || delta <= 0 {
		return
	}
	now := time.Now()
	riskMu.Lock()
	state := riskByIP[ip]
	if !state.lastSeen.IsZero() {
		// Time decay: reduce score by 1 per minute of inactivity.
		minutes := int(now.Sub(state.lastSeen).Minutes())
		if minutes > 0 {
			state.score -= minutes
			if state.score < 0 {
				state.score = 0
			}
		}
	}
	state.score += delta
	if state.score > riskMaxScore {
		state.score = riskMaxScore
	}
	state.lastSeen = now
	riskByIP[ip] = state
	riskMu.Unlock()
	if strings.TrimSpace(reason) != "" {
		LogIncident("risk_score_increase", map[string]string{
			"ip":     ip,
			"score":  fmt.Sprintf("%d", state.score),
			"reason": reason,
		})
	}
}

// ResetRiskScore clears accumulated suspicion score (used on trusted success).
func ResetRiskScore(ip string) {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return
	}
	riskMu.Lock()
	delete(riskByIP, ip)
	riskMu.Unlock()
}

func currentRiskScore(ip string) int {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return 0
	}
	now := time.Now()
	riskMu.Lock()
	defer riskMu.Unlock()
	state, ok := riskByIP[ip]
	if !ok {
		return 0
	}
	minutes := int(now.Sub(state.lastSeen).Minutes())
	if minutes > 0 {
		state.score -= minutes
		if state.score < 0 {
			delete(riskByIP, ip)
			return 0
		}
		state.lastSeen = now
		riskByIP[ip] = state
	}
	return state.score
}

// AdaptiveAuthRateLimit dynamically tightens limits for suspicious IPs.
func AdaptiveAuthRateLimit(baseRequests int, per time.Duration) gin.HandlerFunc {
	if baseRequests <= 0 {
		baseRequests = 10
	}
	if per <= 0 {
		per = time.Minute
	}
	type entry struct {
		limiter    *rate.Limiter
		lastSeen   time.Time
		lastBucket int
	}
	var (
		mu      sync.Mutex
		clients = make(map[string]*entry)
	)
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			mu.Lock()
			for ip, e := range clients {
				if time.Since(e.lastSeen) > 10*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()
	return func(c *gin.Context) {
		ip := c.ClientIP()
		score := currentRiskScore(ip)
		allowed := baseRequests - score
		if allowed < 2 {
			allowed = 2
		}

		// Passive suspicious signals.
		if strings.TrimSpace(c.GetHeader("User-Agent")) == "" {
			AddRiskScore(ip, 1, "missing_user_agent")
		}
		if c.Request.Method == http.MethodPost {
			ct := strings.ToLower(strings.TrimSpace(c.GetHeader("Content-Type")))
			if ct != "" && !strings.Contains(ct, "application/json") {
				AddRiskScore(ip, 1, "unexpected_content_type")
			}
		}

		mu.Lock()
		e, ok := clients[ip]
		if !ok {
			e = &entry{
				limiter:    rate.NewLimiter(rate.Every(per/time.Duration(allowed)), allowed),
				lastSeen:   time.Now(),
				lastBucket: allowed,
			}
			clients[ip] = e
		} else if e.lastBucket != allowed {
			e.limiter = rate.NewLimiter(rate.Every(per/time.Duration(allowed)), allowed)
			e.lastBucket = allowed
		}
		e.lastSeen = time.Now()
		if !e.limiter.Allow() {
			mu.Unlock()
			AddRiskScore(ip, 1, "adaptive_rate_limit_hit")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too many requests",
				"retry_after": "1m",
			})
			return
		}
		mu.Unlock()
		c.Next()
	}
}

// RequestGuard is a lightweight runtime protection layer against obvious payload abuse.
func RequestGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		target := strings.ToLower(c.Request.URL.Path + "?" + c.Request.URL.RawQuery)
		if isSuspiciousPayload(target) {
			ip := c.ClientIP()
			AddRiskScore(ip, 3, "request_guard_path_query")
			QuarantineIP(ip, "request_guard_path_query")
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		if needsBodyInspection(c.Request.Method) && strings.Contains(strings.ToLower(c.GetHeader("Content-Type")), "application/json") {
			raw, err := c.GetRawData()
			if err == nil {
				c.Request.Body = io.NopCloser(bytes.NewReader(raw))
				// Inspect only first chunk to avoid overhead.
				maxInspect := 8192
				if len(raw) < maxInspect {
					maxInspect = len(raw)
				}
				bodySample := strings.ToLower(string(raw[:maxInspect]))
				if isSuspiciousPayload(bodySample) {
					ip := c.ClientIP()
					AddRiskScore(ip, 3, "request_guard_body")
					QuarantineIP(ip, "request_guard_body")
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
					return
				}
			}
		}
		c.Next()
	}
}

func needsBodyInspection(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func isSuspiciousPayload(v string) bool {
	s := strings.ToLower(v)
	signatures := []string{
		" union select ",
		"' or 1=1",
		"\" or 1=1",
		"<script",
		"javascript:",
		"../",
		"..\\",
		"%2e%2e%2f",
		"%00",
		"sleep(",
		"benchmark(",
		"information_schema",
	}
	for _, sig := range signatures {
		if strings.Contains(s, sig) {
			return true
		}
	}
	return false
}

// LogIncident writes security events in consistent key-value format.
func LogIncident(event string, fields map[string]string) {
	if strings.TrimSpace(event) == "" {
		event = "unknown_event"
	}
	parts := []string{"incident=" + event}
	if len(fields) > 0 {
		keys := make([]string, 0, len(fields))
		for k := range fields {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			v := strings.TrimSpace(fields[k])
			if v == "" {
				continue
			}
			parts = append(parts, k+"="+v)
		}
	}
	log.Print(strings.Join(parts, " "))
}
