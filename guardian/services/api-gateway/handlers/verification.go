package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type VerificationHandlers struct {
	Store store.Store
}

func (h *VerificationHandlers) Status(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	u := h.Store.UserByID(userID)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	req := h.Store.GetVerificationRequest(userID)
	status := "none"
	if req != nil {
		status = req.Status
	}
	c.JSON(http.StatusOK, gin.H{
		"verified":  u.Verified,
		"status":    status,
		"requested": req != nil,
	})
}

func (h *VerificationHandlers) Submit(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		DocumentBase64 string `json:"document_base64"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payload, err := decodeBase64Payload(req.DocumentBase64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document payload"})
		return
	}
	const maxVerificationBytes = 8 * 1024 * 1024
	if len(payload) < 32 || len(payload) > maxVerificationBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document size"})
		return
	}
	_, _, ok := detectMagicFileType(payload)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported document type"})
		return
	}
	// We don't store the document for now; just create a pending request.
	v := &store.VerificationRequest{
		ID:        uuid.New().String(),
		UserID:    userID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	h.Store.CreateVerificationRequest(v)
	c.JSON(http.StatusOK, gin.H{"ok": true, "status": "pending"})
}
