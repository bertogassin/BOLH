# BOLH

Platform for specialists and clients — modern stack for performance and maintainability.

## Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **UI** | SolidJS + TypeScript | 5-10x faster than React, reactive without Virtual DOM |
| **Mobile/Desktop** | Tauri 2.0 | Rust core, tiny bundle (3-5MB vs 50MB Flutter) |
| **Shared Core** | Rust | Memory safety, performance, compiles everywhere |
| **Backend** | Rust + Axum | Async, fast, same language as core |
| **Database** | PostgreSQL + Redis | Reliability + caching |
| **Real-time** | WebSocket | Native Rust integration |

## Project Structure

```
bolh/
├── apps/
│   ├── mobile/          # Tauri 2.0 mobile app (Android/iOS)
│   │   ├── src-tauri/   # Rust backend for Tauri
│   │   └── src/         # SolidJS frontend
│   ├── desktop/         # Tauri desktop app
│   └── web/             # SolidJS web app
├── packages/
│   ├── core/            # Shared Rust core library
│   ├── ui/              # Shared SolidJS components
│   └── api-client/      # Generated API client
├── backend/             # Rust/Axum backend server
├── shared/
│   └── types/           # Shared TypeScript types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust 1.75+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone the repository
git clone https://github.com/bertogassin/BOLH.git
cd BOLH

# Install dependencies
pnpm install

# Setup environment
cp backend/.env.example backend/.env
# Edit .env with your database credentials

# Build Rust packages
cargo build --workspace
```

### Development

```bash
# Start all services (web + backend)
pnpm dev

# Start web only
pnpm dev:web

# Start mobile (requires Tauri CLI)
pnpm android  # or pnpm ios

# Run backend
cd backend && cargo run
```

### Building

```bash
# Build all packages
pnpm build

# Build mobile APK
pnpm --filter @bolh/mobile tauri android build

# Build iOS
pnpm --filter @bolh/mobile tauri ios build

# Build backend (release)
cd backend && cargo build --release
```

## Core Modules

### Rust Core (`packages/core`)

- **crypto** - AES-256-GCM, ChaCha20, Argon2id, Ed25519, X25519
- **geo** - Haversine distance, geofencing, guard ranking
- **validation** - Phone (KZ), email, IIN, credit card (Luhn)
- **auth** - JWT claims, sessions, role-based access
- **orders** - Order state machine, pricing
- **guards** - Guard discovery, ranking algorithm
- **payments** - Payment processing, subscriptions
- **storage** - Encrypted key-value storage

### UI Components (`packages/ui`)

Atomic design structure:
- **Atoms**: Button, Input, Badge, Avatar, Icon, Spinner
- **Molecules**: Card, ListItem, SearchBar, Rating
- **Organisms**: GuardCard, OrderCard, Header, BottomNav

### Backend API (`backend`)

REST endpoints:
- `/api/v1/auth/*` - Authentication
- `/api/v1/users/*` - User management
- `/api/v1/guards/*` - Guard discovery
- `/api/v1/orders/*` - Order management
- `/api/v1/payments/*` - Payments
- `/api/v1/chat/*` - Messaging

WebSocket events:
- `guard:location` - Guard location updates
- `order:status` - Order status changes
- `chat:message` - New messages
- `sos:alert` - Emergency alerts

## Features

### For Clients
- Find nearby guards in real-time
- Book bodyguards, patrol, event security
- Track guard location live
- In-app chat with guards
- Multiple payment methods
- Order history & receipts

### For Guards
- Receive order notifications
- Accept/decline orders
- Live navigation to client
- Earnings dashboard
- Availability scheduling
- Performance analytics

### Security
- End-to-end encryption
- Biometric authentication
- Secure credential storage
- Audit logging
- Rate limiting

## Deployment

### Backend (Docker)

```bash
cd backend
docker build -t guardio-backend .
docker run -p 8080:8080 --env-file .env guardio-backend
```

### Mobile (App Store / Play Store)

1. Update version in `apps/mobile/src-tauri/tauri.conf.json`
2. Build release: `pnpm --filter @bolh/mobile tauri android build --release`
3. Sign APK and upload to Play Console

## License

MIT License - BOLH Team 2026
