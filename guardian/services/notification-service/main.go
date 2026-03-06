// Notification Service: HTTP API for sending email (registration and other events). SMTP when SMTP_HOST is set.
package main

import (
	"crypto/subtle"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type NotificationService struct {
	smtpHost string
	smtpPort string
	smtpUser string
	smtpPass string
	from     string
}

func (s *NotificationService) sendEmail(to, subject, body string) error {
	if s.smtpHost == "" {
		log.Printf("[email] (no SMTP) to=%s subject=%s", to, subject)
		return nil
	}
	addr := s.smtpHost
	if s.smtpPort != "" {
		addr = s.smtpHost + ":" + s.smtpPort
	}
	msg := []byte("To: " + to + "\r\nSubject: " + subject + "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + body)
	auth := smtp.PlainAuth("", s.smtpUser, s.smtpPass, strings.Split(s.smtpHost, ":")[0])
	return smtp.SendMail(addr, auth, s.from, []string{to}, msg)
}

func main() {
	svc := &NotificationService{
		smtpHost: os.Getenv("SMTP_HOST"),
		smtpPort: os.Getenv("SMTP_PORT"),
		smtpUser: os.Getenv("SMTP_USER"),
		smtpPass: os.Getenv("SMTP_PASS"),
		from:     os.Getenv("SMTP_FROM"),
	}
	if svc.from == "" {
		svc.from = "noreply@guardian.app"
	}

	r := gin.Default()
	requireInternalAuth := func(c *gin.Context) bool {
		token := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN"))
		allowInsecure := strings.EqualFold(strings.TrimSpace(os.Getenv("ALLOW_INSECURE_INTERNAL_AUTH")), "true")
		if token == "" {
			if allowInsecure {
				return true
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "service auth required"})
			return false
		}
		provided := c.GetHeader("X-Internal-Token")
		if subtle.ConstantTimeCompare([]byte(provided), []byte(token)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "service auth required"})
			return false
		}
		return true
	}
	r.POST("/notify/email", func(c *gin.Context) {
		if !requireInternalAuth(c) {
			return
		}
		var req struct {
			To      string `json:"to" binding:"required"`
			Subject string `json:"subject" binding:"required"`
			Body    string `json:"body" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := svc.sendEmail(req.To, req.Subject, req.Body); err != nil {
			log.Printf("sendEmail: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.POST("/notify/register", func(c *gin.Context) {
		if !requireInternalAuth(c) {
			return
		}
		var req struct {
			Email     string `json:"email" binding:"required"`
			FirstName string `json:"first_name"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		subject := "Welcome to Guardian"
		body := "Hello, " + req.FirstName + "!\n\nYour account is registered. Sign in to the app and create your first order.\n\n- Guardian"
		if err := svc.sendEmail(req.Email, subject, body); err != nil {
			log.Printf("sendEmail register: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.POST("/notify/match", func(c *gin.Context) {
		if !requireInternalAuth(c) {
			return
		}
		var req struct {
			ClientEmail string  `json:"client_email" binding:"required"`
			OrderID     string  `json:"order_id"`
			OrderTitle  string  `json:"order_title"`
			FinalPrice  float64 `json:"final_price"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		subject := "BOLH SECURITY - Guard assigned"
		body := "Your reservation \"" + req.OrderTitle + "\" has been matched with a guard. Price: " + fmt.Sprintf("%.2f", req.FinalPrice) + " EUR.\n\n- BOLH SECURITY"
		if err := svc.sendEmail(req.ClientEmail, subject, body); err != nil {
			log.Printf("sendEmail match: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}
	log.Printf("notification-service listening on :%s (SMTP: %v)", port, svc.smtpHost != "")
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
