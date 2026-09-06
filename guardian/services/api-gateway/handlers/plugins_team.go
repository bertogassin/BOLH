package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"guardian/api-gateway/store"
)

func (h *PluginHandlers) ListTeam(c *gin.Context) {
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
	members := h.Store.PluginTeamMembers(id)
	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *PluginHandlers) AddTeamMember(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	if _, ok := h.requirePluginTeamAdmin(c, id, userID); !ok {
		return
	}
	var req struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
		Role   string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if !validPluginRole(req.Role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plugin role"})
		return
	}
	targetID := req.UserID
	if targetID == "" && req.Email != "" {
		u := h.Store.UserByEmail(req.Email)
		if u == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		targetID = u.ID
	}
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id or email required"})
		return
	}
	m := &store.PluginTeamMember{
		PluginID: id,
		UserID:   targetID,
		Role:     req.Role,
		AddedBy:  userID,
		AddedAt:  time.Now(),
	}
	h.Store.AddPluginTeamMember(m)
	c.JSON(http.StatusCreated, m)
}

func (h *PluginHandlers) RemoveTeamMember(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	memberID := c.Param("user_id")
	if id == "" || memberID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id and user_id required"})
		return
	}
	if _, ok := h.requirePluginTeamAdmin(c, id, userID); !ok {
		return
	}
	if !h.Store.RemovePluginTeamMember(id, memberID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
