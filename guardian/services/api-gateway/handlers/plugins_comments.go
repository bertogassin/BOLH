package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

func (h *PluginHandlers) ListComments(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if _, ok := h.requireReadablePlugin(c, id, userID); !ok {
		return
	}
	comments := h.Store.PluginComments(id)
	c.JSON(http.StatusOK, gin.H{"comments": comments})
}

func (h *PluginHandlers) AddComment(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if _, ok := h.requireReadablePlugin(c, id, userID); !ok {
		return
	}
	var req struct {
		Content  string `json:"content"`
		ParentID string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content required"})
		return
	}
	comment := &store.PluginComment{
		ID:        uuid.New().String(),
		PluginID:  id,
		UserID:    userID,
		Content:   strings.TrimSpace(req.Content),
		ParentID:  req.ParentID,
		Resolved:  false,
		CreatedAt: time.Now(),
	}
	h.Store.AddPluginComment(comment)
	c.JSON(http.StatusCreated, comment)
}

func (h *PluginHandlers) ResolveComment(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	cid := c.Param("comment_id")
	if id == "" || cid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id and comment_id required"})
		return
	}
	if _, ok := h.requirePluginReviewer(c, id, userID); !ok {
		return
	}
	var req struct {
		Resolved bool `json:"resolved"`
	}
	_ = c.ShouldBindJSON(&req)
	if !h.Store.SetCommentResolved(cid, id, req.Resolved) {
		c.JSON(http.StatusNotFound, gin.H{"error": "comment not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
