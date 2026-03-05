package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"guardian/api-gateway/store"
)

type PluginHandlers struct {
	Store store.Store
}

func (h *PluginHandlers) requireAuthedUserID(c *gin.Context) (string, bool) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return "", false
	}
	return userID, true
}

func (h *PluginHandlers) requireOwnedPlugin(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p := h.Store.PluginByID(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	return p, true
}

func (h *PluginHandlers) requireReadablePlugin(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p := h.Store.PluginByID(id, userID)
	if p != nil {
		return p, true
	}
	p = h.Store.PluginByIDOnly(id)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	if p.UserID == userID {
		return p, true
	}
	for _, m := range h.Store.PluginTeamMembers(id) {
		if m.UserID == userID {
			return p, true
		}
	}
	c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
	return nil, false
}
