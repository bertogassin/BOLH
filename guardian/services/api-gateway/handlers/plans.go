package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

type PlanHandlers struct {
	Store store.Store
}

func (h *PlanHandlers) List(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	plans := h.Store.PlansByUserID(userID)
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}

func (h *PlanHandlers) Get(c *gin.Context) {
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
	p := h.Store.PlanByID(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}
	tasks := h.Store.PlanTasks(id)
	c.JSON(http.StatusOK, gin.H{"plan": p, "tasks": tasks})
}

func (h *PlanHandlers) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title required"})
		return
	}
	now := time.Now()
	p := &store.Plan{
		ID:          uuid.New().String(),
		OwnerID:     userID,
		Title:       req.Title,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	h.Store.CreatePlan(p)
	c.JSON(http.StatusCreated, p)
}

func (h *PlanHandlers) Update(c *gin.Context) {
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
	p := h.Store.PlanByID(id, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		p.Title = *req.Title
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	p.UpdatedAt = time.Now()
	h.Store.UpdatePlan(p)
	c.JSON(http.StatusOK, p)
}

func (h *PlanHandlers) Delete(c *gin.Context) {
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
	if !h.Store.DeletePlan(id, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *PlanHandlers) AddTask(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan id required"})
		return
	}
	p := h.Store.PlanByID(planID, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}
	var req struct {
		Title         string  `json:"title"`
		Description   string  `json:"description"`
		DueAt         *string `json:"due_at"`
		AssigneeID    string  `json:"assignee_id"`
		AssigneeEmail string  `json:"assignee_email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Title) == 0 || len(req.Title) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title must be between 1 and 200 characters"})
		return
	}
	if len(req.Description) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "description too long"})
		return
	}
	assigneeID := req.AssigneeID
	if assigneeID == "" && req.AssigneeEmail != "" {
		u := h.Store.UserByEmail(req.AssigneeEmail)
		if u == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user not found by email"})
			return
		}
		assigneeID = u.ID
	}
	if assigneeID == "" {
		assigneeID = userID
	}
	if h.Store.UserByID(assigneeID) == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assignee user not found"})
		return
	}
	var dueAt *time.Time
	if req.DueAt != nil && *req.DueAt != "" {
		t, err := time.Parse(time.RFC3339, *req.DueAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "due_at must be RFC3339"})
			return
		}
		dueAt = &t
	}
	tasks := h.Store.PlanTasks(planID)
	sortOrder := len(tasks)
	now := time.Now()
	t := &store.PlanTask{
		ID:          uuid.New().String(),
		PlanID:      planID,
		Title:       req.Title,
		Description: req.Description,
		DueAt:       dueAt,
		AssigneeID:  assigneeID,
		Status:      "todo",
		SortOrder:   sortOrder,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	h.Store.AddPlanTask(t)
	c.JSON(http.StatusCreated, t)
}

func (h *PlanHandlers) UpdateTask(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	planID := c.Param("id")
	taskID := c.Param("task_id")
	if planID == "" || taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan id and task id required"})
		return
	}
	p := h.Store.PlanByID(planID, userID)
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}
	tasks := h.Store.PlanTasks(planID)
	var task *store.PlanTask
	for i := range tasks {
		if tasks[i].ID == taskID {
			task = &tasks[i]
			break
		}
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		DueAt       *string `json:"due_at"`
		AssigneeID  *string `json:"assignee_id"`
		Status      *string `json:"status"`
		SortOrder   *int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title != nil {
		if len(*req.Title) == 0 || len(*req.Title) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title must be between 1 and 200 characters"})
			return
		}
		task.Title = *req.Title
	}
	if req.Description != nil {
		if len(*req.Description) > 5000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "description too long"})
			return
		}
		task.Description = *req.Description
	}
	if req.DueAt != nil {
		if *req.DueAt == "" {
			task.DueAt = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.DueAt)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "due_at must be RFC3339"})
				return
			}
			task.DueAt = &t
		}
	}
	if req.AssigneeID != nil {
		assigneeID := *req.AssigneeID
		if assigneeID == "" {
			assigneeID = userID
		}
		if h.Store.UserByID(assigneeID) == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "assignee user not found"})
			return
		}
		task.AssigneeID = assigneeID
	}
	if req.Status != nil {
		s := *req.Status
		if s != "todo" && s != "in_progress" && s != "done" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task status"})
			return
		}
		task.Status = s
	}
	if req.SortOrder != nil {
		if *req.SortOrder < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sort_order must be non-negative"})
			return
		}
		task.SortOrder = *req.SortOrder
	}
	task.UpdatedAt = time.Now()
	h.Store.UpdatePlanTask(task)
	c.JSON(http.StatusOK, task)
}

func (h *PlanHandlers) DeleteTask(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}
	planID := c.Param("id")
	taskID := c.Param("task_id")
	if planID == "" || taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan id and task id required"})
		return
	}
	if !h.Store.DeletePlanTask(taskID, planID, userID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "task or plan not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
