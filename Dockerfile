FROM golang:1.25.8-alpine AS builder

WORKDIR /app

# Cache dependencies first for faster rebuilds.
COPY go.mod go.sum ./
RUN go mod download

# Build the API binary from the root module.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/bolh-api ./cmd/api

FROM alpine:3.20
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /out/bolh-api /usr/local/bin/bolh-api

EXPOSE 8080
ENV API_ADDR=:8080
CMD ["/usr/local/bin/bolh-api"]
