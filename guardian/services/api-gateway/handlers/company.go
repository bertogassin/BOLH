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

	now := time.Now()
	app := &store.CompanyApplication{
		ID: uuid.New().String(), UserID: userID, Status: "pending", CreatedAt: now, UpdatedAt: now,
		Payload: map[string]string{
			"company_name": req.CompanyName, "registration_number": req.RegistrationNumber, "country_code": req.CountryCode,
			"owner_full_name": req.OwnerFullName, "owner_role": req.OwnerRole, "contact_email": req.ContactEmail,
			"contact_phone": req.ContactPhone, "website": req.Website,
		},
	}
	if err := h.Store.CreateCompanyApplication(app); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist company application"})
		return
	}
	h.Store.AddNotification(&store.Notification{ID: uuid.New().String(), UserID: userID, Title: "Company registration submitted", Body: "Your company application is pending review.", Read: false, CreatedAt: now})
	c.JSON(http.StatusCreated, gin.H{"ok": true, "status": app.Status, "application_id": app.ID, "submitted_at": now.UTC().Format(time.RFC3339), "normalized_email": req.ContactEmail, "country_code": req.CountryCode})
}

func (h *CompanyHandlers) AdminList(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"applications": h.Store.AllCompanyApplications()})
}

func (h *CompanyHandlers) AdminReview(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	var app *store.CompanyApplication
	applications := h.Store.AllCompanyApplications()
	for i := range applications {
		if applications[i].ID == id {
			app = &applications[i]
			break
		}
	}
	if app == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "company application not found"})
		return
	}
	var req struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Status != "approved" && req.Status != "rejected" && req.Status != "under_review" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review status"})
		return
	}
	if req.Status == "rejected" && (len(req.Reason) < 3 || len(req.Reason) > 500) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rejection reason required"})
		return
	}
	app.Status = req.Status
	app.RejectionReason = req.Reason
	app.UpdatedAt = time.Now()
	if err := h.Store.UpdateCompanyApplication(app); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update company application"})
		return
	}
	h.Store.AddNotification(&store.Notification{ID: uuid.New().String(), UserID: app.UserID, Title: "Company application updated", Body: "Your company application status is now " + app.Status + ".", CreatedAt: time.Now()})
	c.JSON(http.StatusOK, gin.H{"application": app})
}
