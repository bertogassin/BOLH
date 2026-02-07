#!/bin/bash
# ============================================================
# BOLH Token — Solana SPL Token Creation Script
# ============================================================
#
# Prerequisites:
#   1. Install Solana CLI: https://docs.solanalabs.com/cli/install
#      sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
#
#   2. Install SPL Token CLI:
#      cargo install spl-token-cli
#
#   3. Create/import a wallet:
#      solana-keygen new -o ~/bolh-deployer.json
#      solana config set --keypair ~/bolh-deployer.json
#
#   4. Fund the wallet with ~0.05 SOL:
#      - For devnet (free): solana airdrop 1 --url devnet
#      - For mainnet: send SOL from exchange
#
# Usage:
#   For devnet (testing):  ./create-bolh-token.sh devnet
#   For mainnet (real):    ./create-bolh-token.sh mainnet-beta
#
# ============================================================

set -e

NETWORK="${1:-devnet}"
SUPPLY=21000000
DECIMALS=9
TOKEN_NAME="BOLH"
TOKEN_SYMBOL="BOLH"

echo "============================================================"
echo "  BOLH SPL Token Creator"
echo "============================================================"
echo "  Network:  $NETWORK"
echo "  Supply:   $SUPPLY"
echo "  Decimals: $DECIMALS"
echo "============================================================"

# Set network
solana config set --url "$NETWORK"
echo ""
echo "Wallet: $(solana address)"
echo "Balance: $(solana balance)"
echo ""

# Step 1: Create the token mint
echo "[1/5] Creating token mint..."
TOKEN_MINT=$(spl-token create-token --decimals $DECIMALS 2>&1 | grep "Creating token" | awk '{print $3}')
echo "  Token Mint: $TOKEN_MINT"

# Step 2: Create a token account for the deployer
echo "[2/5] Creating token account..."
TOKEN_ACCOUNT=$(spl-token create-account "$TOKEN_MINT" 2>&1 | grep "Creating account" | awk '{print $3}')
echo "  Token Account: $TOKEN_ACCOUNT"

# Step 3: Mint the total supply
echo "[3/5] Minting $SUPPLY tokens..."
spl-token mint "$TOKEN_MINT" $SUPPLY
echo "  Minted $SUPPLY BOLH"

# Step 4: Disable minting (makes supply fixed forever)
echo "[4/5] Disabling mint authority (fixing supply at $SUPPLY)..."
spl-token authorize "$TOKEN_MINT" mint --disable
echo "  Mint authority disabled. No more tokens can ever be created."

# Step 5: Save deployment info
echo "[5/5] Saving deployment info..."
DEPLOY_FILE="deployment-solana-${NETWORK}.json"
cat > "$DEPLOY_FILE" << EOF
{
  "network": "$NETWORK",
  "tokenMint": "$TOKEN_MINT",
  "tokenAccount": "$TOKEN_ACCOUNT",
  "deployer": "$(solana address)",
  "supply": $SUPPLY,
  "decimals": $DECIMALS,
  "name": "$TOKEN_NAME",
  "symbol": "$TOKEN_SYMBOL",
  "mintAuthorityDisabled": true,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "============================================================"
echo "  DEPLOYMENT SUCCESSFUL"
echo "============================================================"
echo "  Token Mint:    $TOKEN_MINT"
echo "  Token Account: $TOKEN_ACCOUNT"
echo "  Supply:        $SUPPLY BOLH"
echo "  Decimals:      $DECIMALS"
echo "  Mint locked:   YES (no new tokens possible)"
echo ""
echo "  View on explorer:"
echo "  https://explorer.solana.com/address/${TOKEN_MINT}?cluster=${NETWORK}"
echo ""
echo "  Saved to: $DEPLOY_FILE"
echo "============================================================"

# ============================================================
# AFTER DEPLOYMENT — Add Metadata (optional but recommended)
# ============================================================
# To add name/symbol/image to your token on Solana:
#
# 1. Install Metaboss:
#    cargo install metaboss
#
# 2. Create metadata JSON and upload to IPFS/Arweave:
#    {
#      "name": "BOLH",
#      "symbol": "BOLH",
#      "description": "BOLH — utility token for the BOLH security platform",
#      "image": "https://your-url/bolh-logo.png"
#    }
#
# 3. Create on-chain metadata:
#    metaboss create metadata \
#      --account <TOKEN_MINT> \
#      --name "BOLH" \
#      --symbol "BOLH" \
#      --uri "https://your-url/metadata.json"
# ============================================================
