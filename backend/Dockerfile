# Build stage
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    postgresql-dev

WORKDIR /app

# Copy only backend Cargo files
COPY backend/Cargo.toml ./
COPY backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/migrations ./migrations

# Build backend only
RUN cargo build --release

# Runtime stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    libpq \
    openssl \
    ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/backend/target/release/guardio-server /app/guardio-server

# Create non-root user
RUN addgroup -g 1001 -S guardio && \
    adduser -u 1001 -S guardio -G guardio

USER guardio

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./guardio-server"]
