# Matching Engine (Rust). Build from guardian repo root: docker build -f services/matching/Dockerfile .
FROM rust:1.70-slim AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY core ./core
COPY services/matching ./services/matching
COPY services/order-service ./services/order-service
COPY services/bid-service ./services/bid-service

RUN cargo build --release -p matching

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/matching /usr/local/bin/

EXPOSE 8080
CMD ["/usr/local/bin/matching"]
