package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type CardHandlers struct {
	Store store.Store
}

func (h *CardHandlers) List(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	cards := h.Store.CardsByUserID(userID)
	c.JSON(http.StatusOK, gin.H{"cards": cards})
}

func (h *CardHandlers) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		LastFour string `json:"last_four" binding:"required,len=4"`
		Brand    string `json:"brand"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Brand == "" {
		req.Brand = "card"
	}
	card := &store.PaymentCard{
		ID:        uuid.New().String(),
		UserID:    userID,
		LastFour:  req.LastFour,
		Brand:     req.Brand,
		CreatedAt: time.Now(),
	}
	h.Store.CreateCard(card)
	c.JSON(http.StatusCreated, gin.H{"card": card})
}

func (h *CardHandlers) Delete(c *gin.Context) {
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
	if !h.Store.DeleteCard(id, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
