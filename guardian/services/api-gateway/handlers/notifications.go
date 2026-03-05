package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"guardian/api-gateway/store"
)

type NotificationHandlers struct {
	Store store.Store
}

func (h *NotificationHandlers) List(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	list := h.Store.NotificationsByUserID(userID)
	c.JSON(http.StatusOK, gin.H{"notifications": list})
}

func (h *NotificationHandlers) MarkRead(c *gin.Context) {
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
	if !h.Store.MarkNotificationRead(id, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
