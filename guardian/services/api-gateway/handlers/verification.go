package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	c.JSON(http.StatusOK, gin.H{"verified": u.Verified, "status": status, "requested": req != nil})
}

func verificationStorageRoot() (string, error) {
	production := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
	if v := strings.TrimSpace(os.Getenv("VERIFICATION_UPLOAD_DIR")); v != "" {
		if production && !filepath.IsAbs(v) {
			return "", fmt.Errorf("VERIFICATION_UPLOAD_DIR must be absolute in production")
		}
		return v, nil
	}
	if v := strings.TrimSpace(os.Getenv("UPLOAD_DIR")); v != "" {
		if production && !filepath.IsAbs(v) {
			return "", fmt.Errorf("UPLOAD_DIR must be absolute in production")
		}
		return filepath.Join(v, "verification"), nil
	}
	if production {
		return "", fmt.Errorf("persistent verification storage is not configured")
	}
	return filepath.Join("uploads", "verification"), nil
}

func (h *VerificationHandlers) Submit(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	if current := h.Store.GetVerificationRequest(userID); current != nil && (current.Status == "pending" || current.Status == "under_review" || current.Status == "approved") {
		c.JSON(http.StatusConflict, gin.H{"error": "verification request already active", "status": current.Status})
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
	mimeType, ext, ok := detectMagicFileType(payload)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported document type"})
		return
	}

	now := time.Now()
	v := &store.VerificationRequest{ID: uuid.New().String(), UserID: userID, Status: "pending", CreatedAt: now, UpdatedAt: now}
	storageRoot, err := verificationStorageRoot()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "verification storage is not configured"})
		return
	}
	dir := filepath.Join(storageRoot, userID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare verification storage"})
		return
	}
	_ = os.Chmod(dir, 0700)
	objectPath := filepath.Join(dir, v.ID+ext)
	if err := os.WriteFile(objectPath, payload, 0600); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist verification document"})
		return
	}
	if err := h.Store.CreateVerificationRequest(v); err != nil {
		_ = os.Remove(objectPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist verification request"})
		return
	}
	hash := sha256.Sum256(payload)
	a := &store.VerificationArtifact{ID: uuid.New().String(), VerificationID: v.ID, UserID: userID, ObjectKey: objectPath, MimeType: mimeType, SizeBytes: int64(len(payload)), SHA256: hex.EncodeToString(hash[:]), CreatedAt: now}
	if err := h.Store.CreateVerificationArtifact(a); err != nil {
		_ = os.Remove(objectPath)
		v.Status = "rejected"
		v.RejectionReason = "storage persistence failure"
		v.UpdatedAt = time.Now()
		_ = h.Store.UpdateVerificationRequest(v)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist verification artifact"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true, "status": "pending", "verification_id": v.ID})
}

func (h *VerificationHandlers) AdminList(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"requests": h.Store.VerificationRequests()})
}

func (h *VerificationHandlers) AdminApprove(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	v := h.Store.VerificationRequestByID(id)
	if v == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "verification request not found"})
		return
	}
	if len(h.Store.VerificationArtifactsByRequestID(id)) == 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "verification evidence missing"})
		return
	}
	u := h.Store.UserByID(v.UserID)
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if !h.Store.SetUserVerified(u.ID, true) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark user verified"})
		return
	}
	v.Status = "approved"
	v.RejectionReason = ""
	v.UpdatedAt = time.Now()
	if err := h.Store.UpdateVerificationRequest(v); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update verification"})
		return
	}
	h.Store.AddNotification(&store.Notification{ID: uuid.New().String(), UserID: v.UserID, Title: "Verification approved", Body: "Your identity verification has been approved.", CreatedAt: time.Now()})
	c.JSON(http.StatusOK, gin.H{"verification": v, "verified": true})
}

func (h *VerificationHandlers) AdminReject(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	v := h.Store.VerificationRequestByID(id)
	if v == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "verification request not found"})
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 3 || len(reason) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid rejection reason required"})
		return
	}
	v.Status = "rejected"
	v.RejectionReason = reason
	v.UpdatedAt = time.Now()
	if err := h.Store.UpdateVerificationRequest(v); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update verification"})
		return
	}
	h.Store.AddNotification(&store.Notification{ID: uuid.New().String(), UserID: v.UserID, Title: "Verification rejected", Body: "Your identity verification needs attention.", CreatedAt: time.Now()})
	c.JSON(http.StatusOK, gin.H{"verification": v})
}

func (h *VerificationHandlers) AdminArtifact(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	artifacts := h.Store.VerificationArtifactsByRequestID(id)
	if len(artifacts) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "verification artifact not found"})
		return
	}
	a := artifacts[0]
	if _, err := os.Stat(a.ObjectKey); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "verification file not found"})
		return
	}
	c.Header("Content-Type", a.MimeType)
	c.Header("Content-Disposition", "inline; filename=\"verification-"+id+filepath.Ext(a.ObjectKey)+"\"")
	c.File(a.ObjectKey)
}

func (h *VerificationHandlers) AdminSetGuardLicenses(c *gin.Context) {
	guardID := strings.TrimSpace(c.Param("id"))
	u := h.Store.UserByID(guardID)
	if u == nil || u.UserType != "guard" {
		c.JSON(http.StatusNotFound, gin.H{"error": "guard not found"})
		return
	}
	if !u.Verified {
		c.JSON(http.StatusConflict, gin.H{"error": "guard identity must be verified first"})
		return
	}
	var req struct {
		Licenses []string `json:"licenses"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Licenses) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many licenses"})
		return
	}
	if err := h.Store.SetVerifiedGuardLicenses(guardID, req.Licenses); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"guard_id": guardID, "licenses": h.Store.VerifiedLicensesByGuardID(guardID)})
}
