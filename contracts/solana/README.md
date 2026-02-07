# BOLH Token — Solana SPL

## Quick Start

### 1. Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

### 2. Create Wallet
```bash
solana-keygen new -o ~/bolh-deployer.json
solana config set --keypair ~/bolh-deployer.json
```

### 3. Test on Devnet (free)
```bash
solana config set --url devnet
solana airdrop 1
./create-bolh-token.sh devnet
```

### 4. Deploy to Mainnet
```bash
# Fund wallet with ~0.05 SOL first
./create-bolh-token.sh mainnet-beta
```

## Token Details
- **Name:** BOLH
- **Symbol:** BOLH
- **Supply:** 21,000,000 (fixed)
- **Decimals:** 9
- **Standard:** SPL Token

## After Deployment
- Token will be visible on [Solana Explorer](https://explorer.solana.com)
- Add to [Raydium](https://raydium.io) for DEX trading
- Add metadata with Metaboss for name/logo display in wallets
