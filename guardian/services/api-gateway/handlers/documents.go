package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

const downloadDisposition = "attachment"
const maxUploadFileBytes = 10 * 1024 * 1024 // 10 MB

var allowedMimeTypes = map[string]bool{
	"application/pdf": true,
	"image/png":       true,
	"image/jpeg":      true,
	"image/webp":      true,
	"text/plain":      true,
}

type DocumentHandlers struct {
	Store store.Store
}

func (h *DocumentHandlers) List(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	docType := c.Query("doc_type")
	status := c.Query("status")
	docs := h.Store.DocumentsByUserID(userID)
	out := make([]store.Document, 0, len(docs))
	for _, d := range docs {
		if docType != "" && d.DocType != docType {
			continue
		}
		if status != "" && d.Status != status {
			continue
		}
		out = append(out, d)
	}
	c.JSON(http.StatusOK, gin.H{"documents": out})
}

func (h *DocumentHandlers) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	doc := h.Store.DocumentByID(id, userID)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

func (h *DocumentHandlers) Upload(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	docType := c.PostForm("doc_type")
	if docType == "" {
		docType = "document"
	}
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
		return
	}
	if file.Size <= 0 || file.Size > maxUploadFileBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size exceeds limit"})
		return
	}
	mimeType := strings.ToLower(strings.TrimSpace(file.Header.Get("Content-Type")))
	if !allowedMimeTypes[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	dir := filepath.Join(uploadDir, userID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create upload dir"})
		return
	}
	docID := uuid.New().String()
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".bin"
	}
	savePath := filepath.Join(dir, docID+ext)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	now := time.Now()
	doc := &store.Document{
		ID:        docID,
		UserID:    userID,
		UserType:  c.GetString("user_type"),
		DocType:   docType,
		Title:     file.Filename,
		FilePath:  savePath,
		FileName:  file.Filename,
		FileSize:  file.Size,
		MimeType:  mimeType,
		CreatedAt: now,
		UpdatedAt: now,
		Status:    "active",
		Tags:      []string{},
		Version:   1,
	}
	if doc.MimeType == "" {
		doc.MimeType = "application/octet-stream"
	}
	h.Store.CreateDocument(doc)
	c.JSON(http.StatusCreated, gin.H{"id": doc.ID, "document": doc})
}

func (h *DocumentHandlers) Sign(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	var req struct {
		Signature string `json:"signature"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	doc := h.Store.DocumentByID(id, userID)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	now := time.Now()
	doc.Status = "signed"
	doc.Signature = req.Signature
	doc.SignatureDate = &now
	doc.SignedBy = userID
	doc.UpdatedAt = now
	h.Store.UpdateDocument(doc)
	c.JSON(http.StatusOK, gin.H{"status": "signed"})
}

func (h *DocumentHandlers) Delete(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if !h.Store.DeleteDocument(id, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *DocumentHandlers) GetFile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	doc := h.Store.DocumentByID(id, userID)
	if doc == nil || doc.FilePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	if _, err := os.Stat(doc.FilePath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	name := doc.FileName
	if name == "" {
		name = filepath.Base(doc.FilePath)
	}
	c.Header("Content-Disposition", downloadDisposition+"; filename=\""+safeDownloadName(name)+"\"")
	if doc.MimeType != "" {
		c.Header("Content-Type", doc.MimeType)
	}
	c.File(doc.FilePath)
}

func safeDownloadName(name string) string {
	clean := strings.ReplaceAll(name, "\r", "")
	clean = strings.ReplaceAll(clean, "\n", "")
	clean = strings.ReplaceAll(clean, "\"", "")
	if clean == "" {
		return "document.bin"
	}
	return clean
}
