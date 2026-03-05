package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

func (h *PluginHandlers) Create(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	var req struct {
		UserType    string                   `json:"user_type"`
		PluginType  string                   `json:"plugin_type"`
		Name        string                   `json:"name"`
		Description string                   `json:"description"`
		Icon        string                   `json:"icon"`
		ColorScheme map[string]string        `json:"color_scheme"`
		Components  []map[string]interface{} `json:"components"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.PluginType == "" {
		req.PluginType = "agent"
	}
	if req.Icon == "" {
		req.Icon = "puzzlepiece"
	}
	if req.ColorScheme == nil {
		req.ColorScheme = map[string]string{
			"primary":    "#0055FF",
			"secondary":  "#00C48C",
			"background": "#FFFFFF",
		}
	}
	now := time.Now()
	p := &store.Plugin{
		ID:          uuid.New().String(),
		UserID:      userID,
		UserType:    req.UserType,
		PluginType:  req.PluginType,
		Name:        req.Name,
		Description: req.Description,
		Icon:        req.Icon,
		ColorScheme: req.ColorScheme,
		Config:      map[string]interface{}{},
		Components:  req.Components,
		CreatedAt:   now,
		UpdatedAt:   now,
		Status:      "draft",
		Version:     1,
	}
	h.Store.CreatePlugin(p)
	c.JSON(http.StatusCreated, p)
}

func (h *PluginHandlers) My(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	pluginType := c.Query("plugin_type")
	plugins := h.Store.PluginsByUserID(userID)
	out := make([]store.Plugin, 0, len(plugins))
	for _, p := range plugins {
		if pluginType != "" && p.PluginType != pluginType {
			continue
		}
		out = append(out, p)
	}
	c.JSON(http.StatusOK, gin.H{"plugins": out})
}

func (h *PluginHandlers) Templates(c *gin.Context) {
	templates := []gin.H{
		{
			"id":          "daily_report",
			"name":        "Ежедневный отчёт",
			"description": "Автоматическое создание отчётов о смене с фото и подписью",
			"icon":        "doc.text.fill",
			"category":    "Отчёты",
			"components":  []string{"title", "date", "text", "signature", "photo"},
		},
		{
			"id":          "contract",
			"name":        "Контракт за минуту",
			"description": "Генератор договоров с клиентами по шаблону",
			"icon":        "doc.text.magnifyingglass",
			"category":    "Контракты",
			"components":  []string{"title", "text", "signature", "date"},
		},
		{
			"id":          "branding",
			"name":        "Фирменный стиль",
			"description": "Брендирование всех документов логотипом компании",
			"icon":        "paintbrush.fill",
			"category":    "Брендинг",
			"components":  []string{"logo", "colors", "header"},
		},
		{
			"id":          "receipt",
			"name":        "Чеки и квитанции",
			"description": "Создание и печать чеков для клиентов",
			"icon":        "receipt.fill",
			"category":    "Финансы",
			"components":  []string{"items", "total", "signature"},
		},
	}
	c.JSON(http.StatusOK, gin.H{"templates": templates})
}

func (h *PluginHandlers) Publish(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	var req struct {
		IsPublic bool `json:"is_public"`
	}
	_ = c.ShouldBindJSON(&req)
	p, ok := h.requireOwnedPlugin(c, id, userID)
	if !ok {
		return
	}
	p.Status = "active"
	p.IsPublic = req.IsPublic
	p.UpdatedAt = time.Now()
	h.Store.UpdatePlugin(p)
	c.JSON(http.StatusOK, gin.H{"status": "published"})
}

func (h *PluginHandlers) Get(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	p, ok := h.requireReadablePlugin(c, id, userID)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *PluginHandlers) Export(c *gin.Context) {
	userID, ok := h.requireAuthedUserID(c)
	if !ok {
		return
	}
	id := c.Param("id")
	format := c.Query("format")
	if format == "" {
		format = "html"
	}
	p, ok := h.requireReadablePlugin(c, id, userID)
	if !ok {
		return
	}
	primary := "#0055FF"
	if p.ColorScheme != nil {
		if v, hasPrimary := p.ColorScheme["primary"]; hasPrimary {
			primary = v
		}
	}
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>%s</title>
<style>body{font-family:system-ui;background:#1a1b26;color:#fff;padding:24px;max-width:600px;margin:0 auto;}
.plugin{background:rgba(255,255,255,0.1);border-radius:16px;padding:24px;}
h1{color:%s;margin:0 0 8px 0;}
p{color:rgba(255,255,255,0.7);margin:0;}
</style></head><body>
<div class="plugin"><h1>%s</h1><p>%s</p></div>
</body></html>`,
		p.Name, primary, p.Name, p.Description)
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=\""+p.Name+".html\"")
	c.String(http.StatusOK, html)
}
