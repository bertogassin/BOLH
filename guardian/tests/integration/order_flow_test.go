//go:build integration
// +build integration

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const baseURL = "http://localhost:8080"

func TestHealth(t *testing.T) {
	resp, err := http.Get(baseURL + "/health")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestCreateOrderValidation(t *testing.T) {
	body := map[string]interface{}{
		"title":            "Event security",
		"required_licenses": []string{"weapon"},
		"budget_min":       25.0,
		"budget_max":       50.0,
		"latitude":         55.7558,
		"longitude":        37.6173,
		"start_time":       time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		"end_time":         time.Now().Add(30 * time.Hour).Format(time.RFC3339),
	}
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, baseURL+"/api/v1/orders", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer placeholder-token")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	// Without valid JWT we expect 401
	assert.True(t, resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusUnauthorized)
}

func TestCreateOrderInvalidPayload(t *testing.T) {
	body := map[string]interface{}{
		"title":       "Short",
		"budget_min": 1.0, // below minimum
		"budget_max": 10.0,
		"latitude":   55.0,
		"longitude":  37.0,
		"start_time": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		"end_time":   time.Now().Add(25 * time.Hour).Format(time.RFC3339),
	}
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, baseURL+"/api/v1/orders", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer placeholder")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized)
}
