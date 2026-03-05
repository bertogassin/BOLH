package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

func (h *OrderHandlers) ListMessages(c *gin.Context) {
	userID := c.GetString("user_id")
	orderID := c.Param("id")
	o := h.Store.OrderByID(orderID)
	if o == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if o.ClientID != userID {
		matches := h.Store.MatchesByOrderID(orderID)
		guardMatch := false
		for _, m := range matches {
			if m.GuardID == userID {
				guardMatch = true
				break
			}
		}
		if !guardMatch {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	}
	msgs := h.Store.MessagesByOrderID(orderID)
	c.JSON(http.StatusOK, gin.H{"messages": msgs})
}

func (h *OrderHandlers) CreateMessage(c *gin.Context) {
	userID := c.GetString("user_id")
	orderID := c.Param("id")
	o := h.Store.OrderByID(orderID)
	if o == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	if o.ClientID != userID {
		matches := h.Store.MatchesByOrderID(orderID)
		guardMatch := false
		for _, m := range matches {
			if m.GuardID == userID {
				guardMatch = true
				break
			}
		}
		if !guardMatch {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	}
	var req struct {
		Text string `json:"text" binding:"required,max=2000"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	msg := &store.Message{
		ID:        uuid.New().String(),
		OrderID:   orderID,
		SenderID:  userID,
		Text:      req.Text,
		CreatedAt: time.Now(),
	}
	h.Store.CreateMessage(msg)
	c.JSON(http.StatusCreated, gin.H{"message": msg})
}
