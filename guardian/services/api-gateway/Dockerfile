# API Gateway (Go)
FROM golang:1.25.8-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o api-gateway .

FROM alpine:latest

RUN apk --no-cache add ca-certificates
COPY --from=builder /app/api-gateway /usr/local/bin/

EXPOSE 8080
CMD ["/usr/local/bin/api-gateway"]
