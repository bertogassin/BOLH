package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
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
const sniffHeaderBytes = 512

var allowedDocumentTypes = map[string]bool{
	"document":        true,
	"passport":        true,
	"contract":        true,
	"receipt":         true,
	"invoice":         true,
	"daily_report":    true,
	"incident_report": true,
}

type documentResponse struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	UserType       string     `json:"user_type"`
	DocType        string     `json:"doc_type"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	FileName       string     `json:"file_name"`
	FileSize       int64      `json:"file_size"`
	MimeType       string     `json:"mime_type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	Status         string     `json:"status"`
	Tags           []string   `json:"tags"`
	Version        int        `json:"version"`
	ParentID       string     `json:"parent_id,omitempty"`
	Signature      string     `json:"signature,omitempty"`
	SignatureDate  *time.Time `json:"signature_date,omitempty"`
	SignedBy       string     `json:"signed_by,omitempty"`
	ContentSHA256  string     `json:"content_sha256,omitempty"`
	SignatureProof string     `json:"signature_proof,omitempty"`
	OCRText        string     `json:"ocr_text,omitempty"`
	ThumbnailPath  string     `json:"thumbnail_path,omitempty"`
	IsFavorite     bool       `json:"is_favorite"`
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
	safe := make([]documentResponse, 0, len(out))
	for _, d := range out {
		safe = append(safe, toDocumentResponse(&d))
	}
	c.JSON(http.StatusOK, gin.H{"documents": safe})
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
	c.JSON(http.StatusOK, toDocumentResponse(doc))
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
	docType = strings.ToLower(strings.TrimSpace(docType))
	if !allowedDocumentTypes[docType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document type"})
		return
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
	if strings.TrimSpace(file.Filename) == "" || len(file.Filename) > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file name"})
		return
	}
	opened, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open uploaded file"})
		return
	}
	defer opened.Close()
	head := make([]byte, sniffHeaderBytes)
	n, readErr := opened.Read(head)
	if readErr != nil && readErr != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read uploaded file"})
		return
	}
	mimeType, ext, ok := detectMagicFileType(head[:n])
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}
	uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	production := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
	if uploadDir == "" {
		if production {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "persistent document storage is not configured"})
			return
		}
		uploadDir = "uploads"
	}
	if production && !filepath.IsAbs(uploadDir) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "UPLOAD_DIR must be an absolute persistent path in production"})
		return
	}
	dir := filepath.Join(uploadDir, userID)
	if err := os.MkdirAll(dir, 0700); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create upload dir"})
		return
	}
	_ = os.Chmod(dir, 0700)
	docID := uuid.New().String()
	savePath := filepath.Join(dir, docID+ext)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	if err := os.Chmod(savePath, 0600); err != nil {
		_ = os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to secure uploaded file"})
		return
	}
	contentHash, err := sha256File(savePath)
	if err != nil {
		_ = os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash uploaded file"})
		return
	}
	now := time.Now()
	doc := &store.Document{
		ID:            docID,
		UserID:        userID,
		UserType:      c.GetString("user_type"),
		DocType:       docType,
		Title:         file.Filename,
		FilePath:      savePath,
		FileName:      file.Filename,
		FileSize:      file.Size,
		MimeType:      mimeType,
		ContentSHA256: contentHash,
		CreatedAt:     now,
		UpdatedAt:     now,
		Status:        "active",
		Tags:          []string{},
		Version:       1,
	}
	if doc.MimeType == "" {
		doc.MimeType = "application/octet-stream"
	}
	h.Store.CreateDocument(doc)
	c.JSON(http.StatusCreated, gin.H{"id": doc.ID, "document": toDocumentResponse(doc)})
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
	req.Signature = strings.TrimSpace(req.Signature)
	if len(req.Signature) < 2 || len(req.Signature) > 4096 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}
	doc := h.Store.DocumentByID(id, userID)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	now := time.Now()
	if doc.ContentSHA256 == "" && doc.FilePath != "" {
		if contentHash, err := sha256File(doc.FilePath); err == nil {
			doc.ContentSHA256 = contentHash
		}
	}
	if doc.ContentSHA256 == "" {
		c.JSON(http.StatusConflict, gin.H{"error": "document content hash unavailable"})
		return
	}
	proofInput := doc.ContentSHA256 + "|" + req.Signature + "|" + userID + "|" + now.UTC().Format(time.RFC3339Nano)
	proof := sha256.Sum256([]byte(proofInput))
	doc.Status = "signed"
	doc.Signature = req.Signature
	doc.SignatureDate = &now
	doc.SignedBy = userID
	doc.SignatureProof = hex.EncodeToString(proof[:])
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
	doc := h.Store.DocumentByID(id, userID)
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
		return
	}
	if doc.FilePath != "" {
		if err := os.Remove(doc.FilePath); err != nil && !os.IsNotExist(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove document file"})
			return
		}
	}
	if !h.Store.DeleteDocument(id, userID) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete document metadata"})
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

func sha256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
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

func toDocumentResponse(doc *store.Document) documentResponse {
	if doc == nil {
		return documentResponse{}
	}
	return documentResponse{
		ID:             doc.ID,
		UserID:         doc.UserID,
		UserType:       doc.UserType,
		DocType:        doc.DocType,
		Title:          doc.Title,
		Description:    doc.Description,
		FileName:       doc.FileName,
		FileSize:       doc.FileSize,
		MimeType:       doc.MimeType,
		CreatedAt:      doc.CreatedAt,
		UpdatedAt:      doc.UpdatedAt,
		ExpiresAt:      doc.ExpiresAt,
		Status:         doc.Status,
		Tags:           doc.Tags,
		Version:        doc.Version,
		ParentID:       doc.ParentID,
		Signature:      doc.Signature,
		SignatureDate:  doc.SignatureDate,
		SignedBy:       doc.SignedBy,
		ContentSHA256:  doc.ContentSHA256,
		SignatureProof: doc.SignatureProof,
		OCRText:        doc.OCRText,
		ThumbnailPath:  doc.ThumbnailPath,
		IsFavorite:     doc.IsFavorite,
	}
}

func detectMagicFileType(sample []byte) (mimeType string, ext string, ok bool) {
	if len(sample) >= 4 && string(sample[:4]) == "%PDF" {
		return "application/pdf", ".pdf", true
	}
	if len(sample) >= 8 &&
		sample[0] == 0x89 &&
		sample[1] == 0x50 &&
		sample[2] == 0x4E &&
		sample[3] == 0x47 &&
		sample[4] == 0x0D &&
		sample[5] == 0x0A &&
		sample[6] == 0x1A &&
		sample[7] == 0x0A {
		return "image/png", ".png", true
	}
	if len(sample) >= 3 && sample[0] == 0xFF && sample[1] == 0xD8 && sample[2] == 0xFF {
		return "image/jpeg", ".jpg", true
	}
	if len(sample) >= 12 && string(sample[:4]) == "RIFF" && string(sample[8:12]) == "WEBP" {
		return "image/webp", ".webp", true
	}
	return "", "", false
}
