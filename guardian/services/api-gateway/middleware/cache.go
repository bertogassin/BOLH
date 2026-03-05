// Cache GET responses in Redis to reduce backend load.

package middleware

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// CacheMiddleware caches GET requests by path and query.
type CacheMiddleware struct {
	Redis *redis.Client
	TTL   time.Duration
}

// NewCacheMiddleware creates middleware with default TTL of 5 minutes.
func NewCacheMiddleware(r *redis.Client) *CacheMiddleware {
	return &CacheMiddleware{Redis: r, TTL: 5 * time.Minute}
}

// Cache returns gin.HandlerFunc that caches paths with the given prefix.
func (m *CacheMiddleware) Cache(prefixes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}
		path := c.Request.URL.Path
		ok := false
		for _, p := range prefixes {
			if strings.HasPrefix(path, p) {
				ok = true
				break
			}
		}
		if !ok {
			c.Next()
			return
		}
		key := fmt.Sprintf("cache:%s:%s", path, c.Request.URL.RawQuery)
		ctx := c.Request.Context()
		cached, err := m.Redis.Get(ctx, key).Result()
		if err == nil {
			c.Data(http.StatusOK, "application/json", []byte(cached))
			c.Abort()
			return
		}
		w := &cachedWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = w
		c.Next()
		if c.Writer.Status() == http.StatusOK && w.body.Len() > 0 {
			_ = m.Redis.Set(ctx, key, w.body.Bytes(), m.TTL).Err()
		}
	}
}

type cachedWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *cachedWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// InvalidatePath clears cache by path prefix (for example after order update).
func (m *CacheMiddleware) InvalidatePath(ctx context.Context, pathPrefix string) error {
	iter := m.Redis.Scan(ctx, 0, "cache:"+pathPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		_ = m.Redis.Del(ctx, iter.Val()).Err()
	}
	return iter.Err()
}
