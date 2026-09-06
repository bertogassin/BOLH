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

func validPluginRole(role string) bool {
	switch role {
	case "admin", "editor", "reviewer", "viewer":
		return true
	default:
		return false
	}
}

func (h *PluginHandlers) pluginRole(id, userID string) (*store.Plugin, string, bool) {
	p := h.Store.PluginByIDOnly(id)
	if p == nil {
		return nil, "", false
	}
	if p.UserID == userID {
		return p, "owner", true
	}
	for _, m := range h.Store.PluginTeamMembers(id) {
		if m.UserID == userID {
			return p, m.Role, true
		}
	}
	return p, "", false
}

func (h *PluginHandlers) requirePluginOwner(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p := h.Store.PluginByIDOnly(id)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	if p.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner access required"})
		return nil, false
	}
	return p, true
}

func (h *PluginHandlers) requirePluginTeamAdmin(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p, role, ok := h.pluginRole(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	if !ok || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "plugin admin access required"})
		return nil, false
	}
	return p, true
}

func (h *PluginHandlers) requirePluginReviewer(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p, role, ok := h.pluginRole(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	if !ok || (role != "owner" && role != "admin" && role != "editor" && role != "reviewer") {
		c.JSON(http.StatusForbidden, gin.H{"error": "plugin review access required"})
		return nil, false
	}
	return p, true
}

func (h *PluginHandlers) requirePluginPublisher(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	return h.requirePluginTeamAdmin(c, id, userID)
}

func (h *PluginHandlers) requireReadablePlugin(c *gin.Context, id, userID string) (*store.Plugin, bool) {
	p, _, ok := h.pluginRole(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plugin not found"})
		return nil, false
	}
	if !ok && !p.IsPublic {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return nil, false
	}
	return p, true
}
