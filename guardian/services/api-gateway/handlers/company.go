package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guardian/api-gateway/store"
)

var allowedCompanyCountries = map[string]bool{
	"FR": true,
	"DE": true,
	"ES": true,
	"IT": true,
	"TR": true,
	"GB": true,
	"US": true,
}

type CompanyHandlers struct {
	Store store.Store
}

func (h *CompanyHandlers) Register(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "auth required"})
		return
	}

	var req struct {
		CompanyName        string `json:"companyName"`
		RegistrationNumber string `json:"registrationNumber"`
		CountryCode        string `json:"countryCode"`
		OwnerFullName      string `json:"ownerFullName"`
		OwnerRole          string `json:"ownerRole"`
		ContactEmail       string `json:"contactEmail"`
		ContactPhone       string `json:"contactPhone"`
		Website            string `json:"website"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.CompanyName = strings.Join(strings.Fields(strings.TrimSpace(req.CompanyName)), " ")
	req.RegistrationNumber = strings.TrimSpace(req.RegistrationNumber)
	req.CountryCode = strings.ToUpper(strings.TrimSpace(req.CountryCode))
	req.OwnerFullName = normalizeName(req.OwnerFullName)
	req.OwnerRole = strings.Join(strings.Fields(strings.TrimSpace(req.OwnerRole)), " ")
	req.ContactEmail = normalizeEmailStrict(req.ContactEmail)
	req.ContactPhone = strings.TrimSpace(req.ContactPhone)
	req.Website = strings.TrimSpace(req.Website)

	if len(req.CompanyName) < 2 || len(req.CompanyName) > 120 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company name"})
		return
	}
	if !allowedCompanyCountries[req.CountryCode] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid country code"})
		return
	}
	if !isReasonableName(req.OwnerFullName) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid owner full name"})
		return
	}
	if len(req.OwnerRole) < 2 || len(req.OwnerRole) > 80 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid owner role"})
		return
	}
	if !isStrictEmail(req.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company email"})
		return
	}
	if !isCorporateEmail(req.ContactEmail) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "corporate email required"})
		return
	}
	if !isReasonablePhone(req.ContactPhone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business phone"})
		return
	}
	if !isReasonableWebsite(req.Website) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company website"})
		return
	}

	regDigits := onlyDigits(req.RegistrationNumber)
	if req.CountryCode == "FR" {
		if !(len(regDigits) == 9 || len(regDigits) == 14) || !luhnCheck(regDigits) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid registration number"})
			return
		}
	} else if len(regDigits) < 6 || len(regDigits) > 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid registration number"})
		return
	}

	notification := &store.Notification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     "Company registration submitted",
		Body:      "Your company application is pending review.",
		Read:      false,
		CreatedAt: time.Now(),
	}
	h.Store.AddNotification(notification)

	c.JSON(http.StatusCreated, gin.H{
		"ok":               true,
		"status":           "pending",
		"application_id":   uuid.New().String(),
		"submitted_at":     time.Now().UTC().Format(time.RFC3339),
		"normalized_email": req.ContactEmail,
		"country_code":     req.CountryCode,
	})
}
