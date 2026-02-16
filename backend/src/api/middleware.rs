//! API Middleware

use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use bolh_core::auth::Claims;

/// Extract and validate JWT token
pub async fn auth_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    match auth_header {
        Some(auth) if auth.starts_with("Bearer ") => {
            let token = &auth[7..];
            
            // TODO: Use actual secret from environment
            let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
            
            let validation = Validation::new(Algorithm::HS256);
            
            match decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation) {
                Ok(_token_data) => {
                    // Token is valid, continue to handler
                    // TODO: Add claims to request extensions
                    Ok(next.run(request).await)
                }
                Err(_) => Err(StatusCode::UNAUTHORIZED),
            }
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // TODO: Implement rate limiting using bolh_core
    Ok(next.run(request).await)
}
