package store

import (
	"sync"
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone,omitempty"`
	PasswordHash string    `json:"-"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	UserType     string    `json:"user_type"` // client, guard, agency, admin
	Verified     bool      `json:"verified"`
	CreatedAt    time.Time `json:"created_at"`
}

type Order struct {
	ID               string    `json:"id"`
	ClientID         string    `json:"client_id"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	RequiredLicenses []string  `json:"required_licenses"`
	BudgetMin        float64   `json:"budget_min"`
	BudgetMax        float64   `json:"budget_max"`
	Latitude         float64   `json:"latitude"`
	Longitude        float64   `json:"longitude"`
	StartTime        time.Time `json:"start_time"`
	EndTime          time.Time `json:"end_time"`
	Status           string    `json:"status"` // draft, published, searching, matched, in_progress, completed, cancelled
	GuardCount       int       `json:"guard_count"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Bid struct {
	ID           string    `json:"id"`
	GuardID      string    `json:"guard_id"`
	Title        string    `json:"title"`
	Licenses     []string  `json:"licenses"`
	PricePerHour float64   `json:"price_per_hour"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	RadiusKm     float64   `json:"radius_km"`
	Active       bool      `json:"active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Store is the interface for user/order/bid persistence (memory or PostgreSQL).
type Store interface {
	UserByID(id string) *User
	AllUsers() []User
	UserByEmail(email string) *User
	UserByEmailWithPassword(email string) *User
	CreateUser(u *User)
	UpdateUser(u *User)
	SetUserPasswordHash(userID, hash string) bool
	SetUserVerified(userID string, verified bool) bool
	VerifiedLicensesByGuardID(guardID string) []string
	SetVerifiedGuardLicenses(guardID string, licenses []string) error
	OrdersByClientID(clientID string) []Order
	OrderByID(id string) *Order
	CreateOrder(o *Order)
	UpdateOrder(o *Order)
	CancelOrder(orderID, clientID string) (*Order, error)
	BidsByGuardID(guardID string) []Bid
	BidByID(id string) *Bid
	CreateBid(b *Bid)
	UpdateBid(b *Bid)
	AllOrders() []Order
	AllBids() []Bid
	CreateMatch(m *Match)
	MatchByID(id string) *Match
	MatchesByOrderID(orderID string) []Match
	AllMatches() []Match
	OfferMatch(m *Match) (*Order, error)
	AcceptMatch(matchID, guardID string) (*Match, *Order, error)
	RejectMatch(matchID, guardID string) (*Match, *Order, error)
	CardsByUserID(userID string) []PaymentCard
	CreateCard(c *PaymentCard)
	DeleteCard(id, userID string) bool
	NotificationsByUserID(userID string) []Notification
	AddNotification(n *Notification)
	MarkNotificationRead(id, userID string) bool
	MessagesByOrderID(orderID string) []Message
	CreateMessage(m *Message)
	GetVerificationRequest(userID string) *VerificationRequest
	VerificationRequestByID(id string) *VerificationRequest
	VerificationRequests() []VerificationRequest
	CreateVerificationRequest(v *VerificationRequest) error
	UpdateVerificationRequest(v *VerificationRequest) error
	CreateVerificationArtifact(a *VerificationArtifact) error
	VerificationArtifactsByRequestID(requestID string) []VerificationArtifact
	CreateCompanyApplication(a *CompanyApplication) error
	CompanyApplicationsByUserID(userID string) []CompanyApplication
	AllCompanyApplications() []CompanyApplication
	UpdateCompanyApplication(a *CompanyApplication) error

	RevokeTokenHash(tokenHash string, expiresAt time.Time)
	IsTokenHashRevoked(tokenHash string, now time.Time) bool
	RevokeUserBefore(userID string, revokedAt time.Time)
	UserRevokedBefore(userID string) *time.Time
	UseSignedNonce(nonce string, expiresAt time.Time) bool

	EscrowPaymentByID(id string) *EscrowPayment
	EscrowPaymentByProviderRef(providerRef string) *EscrowPayment
	EscrowPaymentByIdempotencyKey(key string) *EscrowPayment
	EscrowPaymentsByOrderID(orderID string) []EscrowPayment
	CreateEscrowPayment(p *EscrowPayment) error
	UpdateEscrowPayment(p *EscrowPayment) error

	DocumentsByUserID(userID string) []Document
	DocumentByID(id, userID string) *Document
	CreateDocument(d *Document)
	UpdateDocument(d *Document)
	DeleteDocument(id, userID string) bool

	PluginsByUserID(userID string) []Plugin
	PluginByID(id, userID string) *Plugin
	PluginByIDOnly(id string) *Plugin
	CreatePlugin(p *Plugin)
	UpdatePlugin(p *Plugin)

	PluginTeamMembers(pluginID string) []PluginTeamMember
	AddPluginTeamMember(m *PluginTeamMember)
	RemovePluginTeamMember(pluginID, userID string) bool
	PluginComments(pluginID string) []PluginComment
	AddPluginComment(c *PluginComment)
	SetCommentResolved(commentID, pluginID string, resolved bool) bool

	PlansByUserID(userID string) []Plan
	PlanByID(id, userID string) *Plan
	CreatePlan(p *Plan)
	UpdatePlan(p *Plan)
	DeletePlan(id, userID string) bool
	PlanTasks(planID string) []PlanTask
	AddPlanTask(t *PlanTask)
	UpdatePlanTask(t *PlanTask)
	DeletePlanTask(taskID, planID, userID string) bool
}

// Plan - professional plan for self or team members.
type Plan struct {
	ID          string    `json:"id"`
	OwnerID     string    `json:"owner_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PlanTask - task in a plan; assignee_id can be self or a teammate.
type PlanTask struct {
	ID          string     `json:"id"`
	PlanID      string     `json:"plan_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	DueAt       *time.Time `json:"due_at,omitempty"`
	AssigneeID  string     `json:"assignee_id"`
	Status      string     `json:"status"` // todo, in_progress, done
	SortOrder   int        `json:"sort_order"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// PluginTeamMember - v2 plugin team member (owner, admin, editor, reviewer, viewer).
type PluginTeamMember struct {
	PluginID string    `json:"plugin_id"`
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	AddedBy  string    `json:"added_by"`
	AddedAt  time.Time `json:"added_at"`
}

// PluginComment - v2 comment/review for a plugin.
type PluginComment struct {
	ID        string    `json:"id"`
	PluginID  string    `json:"plugin_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	ParentID  string    `json:"parent_id,omitempty"`
	Resolved  bool      `json:"resolved"`
	CreatedAt time.Time `json:"created_at"`
}

type VerificationRequest struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Status          string    `json:"status"` // pending, under_review, approved, rejected
	RejectionReason string    `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type VerificationArtifact struct {
	ID             string    `json:"id"`
	VerificationID string    `json:"verification_id"`
	UserID         string    `json:"user_id"`
	ObjectKey      string    `json:"-"`
	MimeType       string    `json:"mime_type"`
	SizeBytes      int64     `json:"size_bytes"`
	SHA256         string    `json:"sha256"`
	CreatedAt      time.Time `json:"created_at"`
}

type CompanyApplication struct {
	ID              string            `json:"id"`
	UserID          string            `json:"user_id"`
	Payload         map[string]string `json:"payload"`
	Status          string            `json:"status"`
	RejectionReason string            `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type Message struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	SenderID  string    `json:"sender_id"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"created_at"`
}

type Match struct {
	ID         string    `json:"id"`
	OrderID    string    `json:"order_id"`
	BidID      string    `json:"bid_id"`
	GuardID    string    `json:"guard_id"`
	FinalPrice float64   `json:"final_price"`
	Status     string    `json:"status"` // offered, accepted, rejected
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type EscrowPayment struct {
	ID                string     `json:"id"`
	OrderID           string     `json:"order_id"`
	ClientID          string     `json:"client_id"`
	AmountMinor       int64      `json:"amount_minor"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	Provider          string     `json:"provider"`
	ProviderRef       string     `json:"provider_ref,omitempty"`
	IdempotencyKey    string     `json:"-"`
	PaymentMethodHint string     `json:"payment_method_hint,omitempty"`
	Status            string     `json:"status"`
	Description       string     `json:"description,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	AuthorizedAt      *time.Time `json:"authorized_at,omitempty"`
	ReleasedAt        *time.Time `json:"released_at,omitempty"`
	CancelledAt       *time.Time `json:"cancelled_at,omitempty"`
}

type PaymentCard struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	LastFour  string    `json:"last_four"`
	Brand     string    `json:"brand"`
	CreatedAt time.Time `json:"created_at"`
}

// Document - BOLH Document Hub: personal docs, contracts, receipts, reports.
type Document struct {
	ID             string     `json:"id"`
	UserID         string     `json:"user_id"`
	UserType       string     `json:"user_type"`
	DocType        string     `json:"doc_type"` // passport, contract, receipt, daily_report, etc.
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	FilePath       string     `json:"file_path"`
	FileName       string     `json:"file_name"`
	FileSize       int64      `json:"file_size"`
	MimeType       string     `json:"mime_type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	Status         string     `json:"status"` // draft, pending, active, expired, archived, signed, rejected
	Tags           []string   `json:"tags"`
	Version        int        `json:"version"`
	ParentID       string     `json:"parent_id,omitempty"`
	Signature      string     `json:"signature,omitempty"`
	SignatureDate  *time.Time `json:"signature_date,omitempty"`
	SignedBy       string     `json:"signed_by,omitempty"`
	ContentSHA256  string     `json:"content_sha256,omitempty"`
	SignatureProof string     `json:"signature_proof,omitempty"`
	OCRText        string     `json:"ocr_text,omitempty"`
	ThumbnailPath  string     `json:"thumbnail_path,omitempty"`
	IsFavorite     bool       `json:"is_favorite"`
}

// Plugin - plugin builder for firms and agents.
type Plugin struct {
	ID          string                   `json:"id"`
	UserID      string                   `json:"user_id"`
	UserType    string                   `json:"user_type"`
	PluginType  string                   `json:"plugin_type"` // firm, agent
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Icon        string                   `json:"icon"`
	ColorScheme map[string]string        `json:"color_scheme"`
	Config      map[string]interface{}   `json:"config"`
	Components  []map[string]interface{} `json:"components"`
	CreatedAt   time.Time                `json:"created_at"`
	UpdatedAt   time.Time                `json:"updated_at"`
	Status      string                   `json:"status"` // draft, active, disabled
	Version     int                      `json:"version"`
	IsPublic    bool                     `json:"is_public"`
}

type MemoryStore struct {
	mu                    sync.RWMutex
	users                 map[string]*User
	orders                map[string]*Order
	bids                  map[string]*Bid
	matches               map[string]*Match
	cards                 map[string]*PaymentCard
	notifications         map[string]*Notification
	messages              map[string]*Message
	verificationRequests  map[string]*VerificationRequest
	documents             map[string]*Document
	plugins               map[string]*Plugin
	pluginTeamMembers     map[string][]*PluginTeamMember // key: pluginID
	pluginComments        map[string][]*PluginComment    // key: pluginID
	plans                 map[string]*Plan               // key: plan ID
	planTasks             map[string][]*PlanTask         // key: planID
	revokedTokenHashes    map[string]time.Time
	revokedUserBefore     map[string]time.Time
	signedNonces          map[string]time.Time
	escrowPayments        map[string]*EscrowPayment
	verificationArtifacts map[string]*VerificationArtifact
	companyApplications   map[string]*CompanyApplication
	verifiedGuardLicenses map[string][]string
}

func NewStore() Store {
	return NewMemoryStore()
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:                 make(map[string]*User),
		orders:                make(map[string]*Order),
		bids:                  make(map[string]*Bid),
		matches:               make(map[string]*Match),
		cards:                 make(map[string]*PaymentCard),
		notifications:         make(map[string]*Notification),
		messages:              make(map[string]*Message),
		verificationRequests:  make(map[string]*VerificationRequest),
		documents:             make(map[string]*Document),
		plugins:               make(map[string]*Plugin),
		pluginTeamMembers:     make(map[string][]*PluginTeamMember),
		pluginComments:        make(map[string][]*PluginComment),
		plans:                 make(map[string]*Plan),
		planTasks:             make(map[string][]*PlanTask),
		revokedTokenHashes:    make(map[string]time.Time),
		revokedUserBefore:     make(map[string]time.Time),
		signedNonces:          make(map[string]time.Time),
		escrowPayments:        make(map[string]*EscrowPayment),
		verificationArtifacts: make(map[string]*VerificationArtifact),
		companyApplications:   make(map[string]*CompanyApplication),
		verifiedGuardLicenses: make(map[string][]string),
	}
}
