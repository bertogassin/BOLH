//! Authentication module
//! 
//! JWT tokens, session management, role-based access

use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// User roles in the system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Client,
    Specialist,
    Admin,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Client => write!(f, "client"),
            UserRole::Specialist => write!(f, "specialist"),
            UserRole::Admin => write!(f, "admin"),
        }
    }
}

/// JWT Claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // User ID
    pub role: UserRole,
    pub exp: i64,           // Expiration time
    pub iat: i64,           // Issued at
    pub jti: String,        // JWT ID
}

impl Claims {
    pub fn new(user_id: i64, role: UserRole, expires_in_hours: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id.to_string(),
            role,
            exp: (now + Duration::hours(expires_in_hours)).timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.exp
    }

    pub fn user_id(&self) -> Option<i64> {
        self.sub.parse().ok()
    }
}

/// Refresh token claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
    pub family: String,     // Token family for rotation
}

impl RefreshClaims {
    pub fn new(user_id: i64, family: Option<String>, expires_in_days: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id.to_string(),
            exp: (now + Duration::days(expires_in_days)).timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
            family: family.unwrap_or_else(|| Uuid::new_v4().to_string()),
        }
    }
}

/// Authentication result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

impl AuthTokens {
    pub fn new(access_token: String, refresh_token: String, expires_in: i64) -> Self {
        Self {
            access_token,
            refresh_token,
            token_type: "Bearer".to_string(),
            expires_in,
        }
    }
}

/// User session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: i64,
    pub role: UserRole,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: i64,
    pub last_active: i64,
    pub expires_at: i64,
}

impl Session {
    pub fn new(user_id: i64, role: UserRole, expires_in_days: i64) -> Self {
        let now = Utc::now().timestamp();
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            role,
            device_id: None,
            device_name: None,
            ip_address: None,
            created_at: now,
            last_active: now,
            expires_at: now + (expires_in_days * 24 * 60 * 60),
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.expires_at
    }

    pub fn touch(&mut self) {
        self.last_active = Utc::now().timestamp();
    }
}

/// Permission checking
#[derive(Debug, Clone)]
pub struct Permissions;

impl Permissions {
    pub fn can_create_order(role: UserRole) -> bool {
        matches!(role, UserRole::Client | UserRole::Admin)
    }

    pub fn can_accept_order(role: UserRole) -> bool {
        matches!(role, UserRole::Specialist | UserRole::Admin)
    }

    pub fn can_manage_specialists(role: UserRole) -> bool {
        matches!(role, UserRole::Admin)
    }

    pub fn can_view_analytics(role: UserRole) -> bool {
        matches!(role, UserRole::Specialist | UserRole::Admin)
    }

    pub fn can_process_payments(role: UserRole) -> bool {
        matches!(role, UserRole::Admin)
    }

    pub fn can_access_admin_panel(role: UserRole) -> bool {
        matches!(role, UserRole::Admin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claims_creation() {
        let claims = Claims::new(123, UserRole::Specialist, 24);
        assert_eq!(claims.user_id(), Some(123));
        assert_eq!(claims.role, UserRole::Specialist);
        assert!(!claims.is_expired());
    }

    #[test]
    fn test_permissions() {
        assert!(Permissions::can_create_order(UserRole::Client));
        assert!(!Permissions::can_accept_order(UserRole::Client));
        assert!(Permissions::can_accept_order(UserRole::Specialist));
        assert!(Permissions::can_access_admin_panel(UserRole::Admin));
    }
}
