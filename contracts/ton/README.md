# BOLH Jetton — TON Blockchain

## Overview

BOLH Jetton is a TEP-74 standard token on the TON blockchain.

- **Name:** BOLH
- **Symbol:** BOLH
- **Supply:** 21,000,000 (fixed after mint authority revoke)
- **Decimals:** 9
- **Standard:** TEP-74 (Jetton)

## Files

- `jetton-minter.fc` — Master contract (controls supply, minting, metadata)
- `jetton-wallet.fc` — Wallet contract (individual user balances, transfers, burns)
- `metadata.json` — Token metadata (name, symbol, description, image)

## Deployment Options

### Option 1: TON Minter (Easiest — no code needed)

1. Go to [https://minter.ton.org](https://minter.ton.org)
2. Connect your TON wallet (Tonkeeper, TON Space, etc.)
3. Fill in:
   - Name: `BOLH`
   - Symbol: `BOLH`
   - Decimals: `9`
   - Supply: `21000000`
   - Description: from metadata.json
4. Deploy (costs ~0.5 TON)
5. After minting, revoke admin to lock supply

### Option 2: Blueprint (For developers)

```bash
# Install Blueprint
npm create ton@latest bolh-jetton

# Copy .fc files into contracts/
# Configure and deploy
npx blueprint build
npx blueprint run
```

### Option 3: toncli

```bash
# Install toncli
pip install toncli

# Create project
toncli start jetton

# Replace contract files with our .fc files
# Deploy
toncli deploy
```

## After Deployment

1. **Revoke admin** — Send op=3 with zero address to lock supply forever
2. **Add to STON.fi** — Create liquidity pool for BOLH/TON trading
3. **Register on Tonviewer** — Submit token info for explorer display
4. **Add logo** — Upload to metadata.json image field and update on-chain

## Important

- After revoking admin, NO ONE can mint new tokens
- Supply will be exactly 21,000,000 BOLH forever
- Users can burn tokens (reducing supply)
- Compatible with all TON wallets: Tonkeeper, TON Space, MyTonWallet
