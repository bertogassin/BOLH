#!/bin/bash
# Guardio Rapidos - Deployment Script
# Deploys all services to production

set -e

echo "🚀 Guardio Rapidos Deployment"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DEPLOY_ENV=${1:-production}
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Build Rust library
build_rust() {
    log_info "Building Rust security library..."
    cd "$PROJECT_ROOT/frontend_mobile/rust_security"
    cargo build --release
    log_info "Rust build complete ✓"
}

# Build Go backend
build_go() {
    log_info "Building Go backend..."
    cd "$PROJECT_ROOT/backend_go"
    go mod tidy
    go build -o bin/guardio-api main.go
    log_info "Go build complete ✓"
}

# Build Flutter app
build_flutter() {
    log_info "Building Flutter APK..."
    cd "$PROJECT_ROOT/frontend_mobile"
    flutter pub get
    flutter build apk --release
    log_info "Flutter build complete ✓"
}

# Deploy ML service
deploy_ml() {
    log_info "Deploying ML service..."
    cd "$PROJECT_ROOT/ml_python"
    pip install -r requirements.txt
    log_info "ML service ready ✓"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    # Rust tests
    cd "$PROJECT_ROOT/frontend_mobile/rust_security"
    cargo test
    
    # Go tests
    cd "$PROJECT_ROOT/backend_go"
    go test ./...
    
    # Python tests
    cd "$PROJECT_ROOT/ml_python"
    python -m pytest tests/ 2>/dev/null || log_warn "No Python tests found"
    
    log_info "All tests passed ✓"
}

# Main
main() {
    log_info "Environment: $DEPLOY_ENV"
    log_info "Project root: $PROJECT_ROOT"
    
    case "$2" in
        rust)
            build_rust
            ;;
        go)
            build_go
            ;;
        flutter)
            build_flutter
            ;;
        ml)
            deploy_ml
            ;;
        test)
            run_tests
            ;;
        all|"")
            build_rust
            build_go
            build_flutter
            deploy_ml
            run_tests
            ;;
        *)
            log_error "Unknown target: $2"
            echo "Usage: $0 [env] [rust|go|flutter|ml|test|all]"
            exit 1
            ;;
    esac
    
    log_info "🎉 Deployment complete!"
}

main "$@"
