//! Backend authentication service

use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, Algorithm};
use guardio_core::auth::{Claims, RefreshClaims, AuthTokens, UserRole};

pub struct AuthService {
    jwt_secret: String,
    access_token_expiry_hours: i64,
    refresh_token_expiry_days: i64,
}

impl AuthService {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            jwt_secret,
            access_token_expiry_hours: 1,
            refresh_token_expiry_days: 30,
        }
    }

    pub fn from_env() -> Self {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret".into());
        Self::new(secret)
    }

    /// Generate access and refresh tokens
    pub fn generate_tokens(&self, user_id: i64, role: UserRole) -> Result<AuthTokens, AuthError> {
        let access_claims = Claims::new(user_id, role, self.access_token_expiry_hours);
        let refresh_claims = RefreshClaims::new(user_id, None, self.refresh_token_expiry_days);

        let access_token = encode(
            &Header::default(),
            &access_claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        ).map_err(|_| AuthError::TokenCreationFailed)?;

        let refresh_token = encode(
            &Header::default(),
            &refresh_claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        ).map_err(|_| AuthError::TokenCreationFailed)?;

        Ok(AuthTokens::new(
            access_token,
            refresh_token,
            self.access_token_expiry_hours * 3600,
        ))
    }

    /// Validate access token
    pub fn validate_access_token(&self, token: &str) -> Result<Claims, AuthError> {
        let validation = Validation::new(Algorithm::HS256);
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|_| AuthError::InvalidToken)
    }

    /// Validate refresh token
    pub fn validate_refresh_token(&self, token: &str) -> Result<RefreshClaims, AuthError> {
        let validation = Validation::new(Algorithm::HS256);
        
        decode::<RefreshClaims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|_| AuthError::InvalidToken)
    }

    /// Refresh tokens
    pub fn refresh_tokens(&self, refresh_token: &str, role: UserRole) -> Result<AuthTokens, AuthError> {
        let claims = self.validate_refresh_token(refresh_token)?;
        let user_id: i64 = claims.sub.parse().map_err(|_| AuthError::InvalidToken)?;
        
        self.generate_tokens(user_id, role)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Token creation failed")]
    TokenCreationFailed,
    #[error("Invalid token")]
    InvalidToken,
    #[error("Token expired")]
    TokenExpired,
}
