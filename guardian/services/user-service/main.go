// User Service: HTTP API - Register (Argon2), GetProfile. In-memory store (production: PostgreSQL, Redis cache).
package main

import (
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	PasswordHash string   `json:"-"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	UserType    string    `json:"user_type"`
	Verified    bool      `json:"verified"`
	CreatedAt   time.Time `json:"created_at"`
}

type UserStore struct {
	mu    sync.RWMutex
	byID  map[string]*User
	byEmail map[string]*User
}

func NewUserStore() *UserStore {
	return &UserStore{
		byID:    make(map[string]*User),
		byEmail: make(map[string]*User),
	}
}

func (s *UserStore) Create(u *User) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byID[u.ID] = u
	s.byEmail[u.Email] = u
}

func (s *UserStore) ByID(id string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.byID[id]
	if !ok {
		return nil
	}
	cp := *u
	cp.PasswordHash = ""
	return &cp
}

func (s *UserStore) ByEmail(email string) *User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.byEmail[email]
}

func hashPassword(pass string) []byte {
	return argon2.IDKey([]byte(pass), []byte("guardian-user-svc"), 1, 64*1024, 4, 32)
}

func main() {
	store := NewUserStore()
	r := gin.Default()

	r.POST("/register", func(c *gin.Context) {
		var req struct {
			Email     string `json:"email" binding:"required,email"`
			Password  string `json:"password" binding:"required,min=6"`
			FirstName string `json:"first_name" binding:"required"`
			LastName  string `json:"last_name" binding:"required"`
			UserType  string `json:"user_type"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.UserType == "" {
			req.UserType = "client"
		}
		if store.ByEmail(req.Email) != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		id := uuid.New().String()
		u := &User{
			ID:           id,
			Email:        req.Email,
			PasswordHash: string(hashPassword(req.Password)),
			FirstName:    req.FirstName,
			LastName:     req.LastName,
			UserType:     req.UserType,
			Verified:     false,
			CreatedAt:    time.Now(),
		}
		store.Create(u)
		c.JSON(http.StatusCreated, gin.H{"user_id": id, "email": u.Email})
	})

	r.GET("/profile/:id", func(c *gin.Context) {
		id := c.Param("id")
		u := store.ByID(id)
		if u == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, u)
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	_ = json.Marshal
	log.Printf("user-service listening on :%s (HTTP)", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
