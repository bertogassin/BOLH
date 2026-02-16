# BOLH Development Guide

## Quick Start

### Starting All Servers

To start the complete development environment with one command:

```bash
pnpm run dev:all
```

This will launch:
- **Mobile App**: http://localhost:3000
- **Web App**: http://localhost:3001
- **Mock API**: http://localhost:8080

### Starting Individual Servers

```bash
# Mobile app only
pnpm run dev:mobile

# Web app only
pnpm run dev:web

# Mock API only
pnpm run api:mock
```

## Architecture

### Frontend Applications

#### Mobile App (Port 3000)
- Built with Solid.js + Tauri
- Location: `apps/mobile/`
- Features:
  - Wallet management with BIP39 seed phrases
  - Real-time blockchain updates via WebSocket
  - Push notifications system
  - AES-256 encrypted backup/restore

#### Web App (Port 3001)
- Built with Solid.js + Vite
- Location: `apps/web/`
- Same features as mobile with web-optimized UI

### Backend

#### Mock API (Port 8080)
- JSON Server providing REST API
- Database: `mock-api/db.json`
- Available endpoints:
  - `GET /wallets` - Wallet list
  - `GET /transactions` - Transaction history
  - `GET /notifications` - User notifications
  - `GET /consensus` - Blockchain consensus state
  - `GET /balance` - Account balance
  - `GET /notification_settings` - Notification preferences

## Recent Features (Tasks 11-13)

### Task 11: Wallet Backup & Restore
- **Location**: `apps/{mobile,web}/src/hooks/useWalletBackup.ts`
- **Features**:
  - BIP39 mnemonic generation (12/24 words)
  - AES-256 encryption for seed phrases
  - Secure backup export
  - Wallet restoration from seed
- **Components**:
  - `pages/BackupRestore.tsx` - Main UI
  - `hooks/useWalletBackup.ts` - Business logic

### Task 12: WebSocket Real-time Updates
- **Location**: `apps/{mobile,web}/src/hooks/useBlockchainWs.ts`
- **Features**:
  - Real-time blockchain state updates
  - Automatic reconnection
  - Event-driven notifications
- **Backend**: `backend/src/ws/blockchain.rs`
- **Message Types**:
  - `NewBlock` - New block mined
  - `NewTransaction` - Transaction broadcast
  - `ConsensusUpdate` - Validator changes
  - `StateChange` - Network state updates

### Task 13: Push Notifications System
- **Location**: `apps/{mobile,web}/src/hooks/useNotifications.ts`
- **Features**:
  - User notification management
  - Mark as read/unread
  - Notification settings
  - Real-time delivery via WebSocket
- **Backend**:
  - `backend/src/api/handlers/notifications.rs`
  - `backend/src/ws/notifications.rs`
  - `backend/migrations/005_notification_settings.sql`
- **Notification Types**:
  - `transaction` - Payment/transfer alerts
  - `security` - Security warnings
  - `system` - System announcements
  - `wallet` - Wallet events

## Environment Variables

### Frontend (.env.local)

**Mobile App** (`apps/mobile/.env.local`):
```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

**Web App** (`apps/web/.env.local`):
```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_PORT=3001
```

### Backend (.env)

**Note**: Real backend currently not running due to database setup. Using mock API instead.

```env
DATABASE_URL=postgresql://postgres:guardio_secret@localhost:5432/guardio
JWT_SECRET=your-secret-key
RUST_LOG=debug
```

## Development Workflow

### 1. Clean Start

Stop all running servers and clean ports:

```powershell
# Stop all Node.js processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start fresh
pnpm run dev:all
```

### 2. Testing API Endpoints

```powershell
# Test wallets endpoint
Invoke-RestMethod -Uri http://localhost:8080/wallets

# Test notifications
Invoke-RestMethod -Uri http://localhost:8080/notifications

# Test consensus
Invoke-RestMethod -Uri http://localhost:8080/consensus
```

### 3. Frontend Development

Both apps have hot-reload enabled. Changes in:
- `apps/mobile/src/` → Auto-reload on localhost:3000
- `apps/web/src/` → Auto-reload on localhost:3001

### 4. Shared Code

Shared packages are automatically linked via pnpm workspace:
- `packages/ui/` - UI components
- `packages/api-client/` - API client (TypeScript)
- `shared/types/` - Shared TypeScript types

## Known Issues & Solutions

### Port Already in Use

If you see "Port XXXX is already in use":

```powershell
# Kill all Node processes
Get-Process node | Stop-Process -Force

# Or kill specific port
$proc = Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id $proc -Force
```

### Mock API Not Responding

1. Check if json-server is running:
   ```powershell
   netstat -ano | Select-String ":8080"
   ```

2. Restart mock API:
   ```bash
   pnpm run api:mock
   ```

### Frontend Can't Connect to API

1. Verify proxy configuration in `vite.config.ts`
2. Check `.env.local` has correct `VITE_API_URL`
3. Ensure mock API is running on port 8080

## Database Setup (Future)

Currently using mock API. For production deployment:

### PostgreSQL Setup

1. Install PostgreSQL 16
2. Create database:
   ```sql
   CREATE DATABASE guardio;
   CREATE USER guardio WITH PASSWORD 'guardio_secret';
   GRANT ALL PRIVILEGES ON DATABASE guardio TO guardio;
   ```

3. Run migrations:
   ```bash
   cd backend
   cargo sqlx migrate run
   ```

4. Start backend:
   ```bash
   cargo run --release
   ```

### Docker Setup (Alternative)

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Run migrations
cd backend && cargo sqlx migrate run

# Start backend
cargo run
```

## Troubleshooting

### Compilation Errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### WebSocket Connection Failed

Mock API doesn't support WebSocket. For WebSocket features:
1. Set up real backend (Rust/Axum)
2. Use PostgreSQL database
3. Start backend with `cargo run`

### Type Errors

```bash
# Rebuild TypeScript types
pnpm -r build
```

## Project Structure

```
guardio-v2/
├── apps/
│   ├── mobile/          # Tauri mobile app
│   │   └── src/
│   │       ├── hooks/   # React hooks (wallet, notifications, etc.)
│   │       └── pages/   # UI pages
│   └── web/             # Web app
│       └── src/
│           ├── hooks/
│           └── pages/
├── backend/             # Rust/Axum API server
│   ├── src/
│   │   ├── api/         # HTTP handlers
│   │   ├── ws/          # WebSocket managers
│   │   └── services/    # Business logic
│   └── migrations/      # Database migrations
├── packages/
│   ├── ui/              # Shared UI components
│   └── api-client/      # TypeScript API client
├── mock-api/
│   └── db.json          # Mock database
└── blockchain/          # Blockchain core
    ├── consensus/
    ├── core/
    └── contracts/
```

## Next Steps

1. ✅ Mock API running (current state)
2. ⏳ Set up PostgreSQL for production
3. ⏳ Enable real-time WebSocket features
4. ⏳ Deploy to production environment
5. ⏳ Mobile app builds (Android/iOS)

## Useful Commands

```bash
# Install dependencies
pnpm install

# Development (all servers)
pnpm run dev:all

# Build for production
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Build Android app
pnpm run android

# Build iOS app (macOS only)
pnpm run ios
```

## Resources

- **Solid.js**: https://www.solidjs.com/
- **Tauri**: https://tauri.app/
- **Vite**: https://vitejs.dev/
- **JSON Server**: https://github.com/typicode/json-server
- **Axum**: https://docs.rs/axum/
- **SQLx**: https://docs.rs/sqlx/

---

**Last Updated**: 2024-02-08  
**Status**: ✅ Development environment fully operational
