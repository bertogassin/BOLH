# Mobile Blockchain Integration Guide

## Overview

The BOLH blockchain core is now fully integrated with the Tauri mobile application via dynamic FFI (Foreign Function Interface). This document explains how to use the blockchain functions in the mobile frontend.

## Architecture

```
Frontend (Solid.js/TypeScript) 
  ↓ (Tauri Commands)
bolh_bridge.rs (FFI wrapper)
  ↓ (Dynamic symbol loading via libloading)
bolh_core.dll/libbolh_core.so (C ABI exports)
  ↓
Blockchain Core (Rust)
  - Wallet management
  - UTXO tracking
  - BFT Consensus
  - Transaction signing
  - Persistent storage (sled)
```

## Quick Start

### 1. Initialize blockchain

```typescript
import { createBlockchainApi } from "./api/blockchain";

const blockchain = createBlockchainApi();

// Initialize the blockchain engine
await blockchain.init();
```

### 2. Create and manage wallets

```typescript
// Create a new wallet
const wallet = await blockchain.wallet.create("my-wallet");
console.log(wallet.address); // Get the wallet address

// List all wallets
const allWallets = await blockchain.wallet.list();

// Get wallet info
const info = await blockchain.wallet.getInfo("my-wallet");
console.log(info.balance); // Current balance

// Check UTXO balance
const utxoBalance = await blockchain.utxo.getBalance(wallet.address);
```

### 3. Create and send transactions

```typescript
// Get UTXO list for the wallet
const utxos = await blockchain.utxo.getAll(wallet.address);

// Create a transaction manually (you'd use a helper library in production)
const transaction = {
  txid: generateHash(),
  inputs: [
    {
      prev_txid: utxos[0].txid,
      output_index: 0,
      signature: "", // Will be filled by signing
    },
  ],
  outputs: [
    {
      address: "recipient_address",
      amount: 100,
    },
    {
      address: wallet.address,
      amount: utxos[0].amount - 100 - fees, // Change output
    },
  ],
  timestamp: Date.now(),
  metadata: {},
};

// Sign the transaction
const signedTx = await blockchain.signTransaction(JSON.stringify(transaction));

// Submit to mempool
const result = await blockchain.submitTransaction(signedTx);
```

### 4. Track consensus state

```typescript
// Get current consensus state
const state = await blockchain.consensus.getState();
console.log(state.height); // Current block height
console.log(state.validators); // List of validators

// Propose a new block (if you're a validator)
const block = await blockchain.consensus.proposeBlock(validatorAddress, transactions);

// Vote on a block
await blockchain.consensus.voteOnBlock(voterAddress, blockId, true);

// Check if block can be finalized (>2/3 voting power)
const canFinalize = await blockchain.consensus.canFinalize(blockId);

// Finalize the block once supermajority reached
if (canFinalize) {
  const finalizedBlock = await blockchain.consensus.finalizeBlock(blockId);
}
```

## API Reference

### Core Functions

- `blockchainInit()` → `Promise<string>`  
  Initialize the blockchain engine. Returns initialization status.

- `createKey()` → `Promise<string>`  
  Generate a new post-quantum keypair.

- `signTransaction(tx: string)` → `Promise<string>`  
  Sign a transaction JSON string. Returns signed transaction.

- `submitTransaction(signed: string)` → `Promise<string>`  
  Submit a signed transaction to the mempool.

- `getBalance(addr: string)` → `Promise<number>`  
  Get the current balance for an address.

### Wallet API

All wallet functions are under `blockchain.wallet.*`:

- `create(name: string)` → `Promise<WalletInfo>`
- `getInfo(name: string)` → `Promise<WalletInfo>`
- `getBalance(name: string)` → `Promise<number>`
- `list()` → `Promise<WalletInfo[]>`
- `delete(name: string)` → `Promise<void>`
- `import(name: string, pubkey: string, seckey: string)` → `Promise<WalletInfo>`

### UTXO API

Under `blockchain.utxo.*`:

- `initGenesis(accounts: string[])` → `Promise<void>`  
  Initialize genesis block with seed accounts.

- `getBalance(addr: string)` → `Promise<number>`  
  Get UTXO balance for an address.

- `getAll(addr: string)` → `Promise<UTXO[]>`  
  List all unspent transaction outputs for an address.

- `validateAndProcess(tx: Transaction)` → `Promise<void>`  
  Validate and process a transaction (for testing).

- `persist()` → `Promise<void>`  
  Persist UTXO set to sled database.

### Consensus API

Under `blockchain.consensus.*`:

- `proposeBlock(proposer: string, txs: Transaction[])` → `Promise<BlockProposal>`  
  Propose a new block (proposer must be a validator).

- `voteOnBlock(voter: string, blockId: string, approved: boolean)` → `Promise<VoteResult>`  
  Cast a vote on a block.

- `canFinalize(blockId: string)` → `Promise<boolean>`  
  Check if block has >2/3 voting power to finalize.

- `finalizeBlock(blockId: string)` → `Promise<FinalizedBlock>`  
  Finalize a block (updates state height).

- `getState()` → `Promise<ConsensusState>`  
  Get current consensus state (height, round, validators).

- `getVotingStatus(blockId: string)` → `Promise<VotingStatus>`  
  Get voting status for a block.

## Data Types

### WalletInfo
```typescript
interface WalletInfo {
  name: string;
  address: string;
  balance: number;
}
```

### UTXO
```typescript
interface UTXO {
  txid: string;
  output_index: number;
  address: string;
  amount: number;
  block_height: number;
  spent: boolean;
}
```

### Transaction
```typescript
interface Transaction {
  txid: string;
  inputs: Array<{
    prev_txid: string;
    output_index: number;
    signature: string;
  }>;
  outputs: Array<{
    address: string;
    amount: number;
  }>;
  timestamp: number;
  metadata: Record<string, unknown>;
}
```

### ConsensusState
```typescript
interface ConsensusState {
  height: number;
  round: number;
  validators: Array<{
    address: string;
    voting_power: number;
  }>;
  current_proposer: string;
}
```

## Error Handling

All async functions can throw errors. Example:

```typescript
try {
  const wallet = await blockchain.wallet.create("my-wallet");
} catch (error) {
  console.error("Failed to create wallet:", error);
  // Handle error - could be FFI loading failure or business logic error
}
```

Common errors:
- FFI library not found: `bolh_core library not found`
- Invalid wallet name: Wallet already exists
- Insufficient funds: UTXO balance insufficient for transaction
- Byzantine validator: Invalid vote from non-committee member

## Testing

Test the blockchain integration with a simple flow:

```typescript
async function testBlockchain() {
  const api = createBlockchainApi();
  
  // Initialize
  console.log("Initializing...");
  await api.init();
  
  // Create wallet
  console.log("Creating wallet...");
  const wallet = await api.wallet.create("test-wallet");
  console.log(`Wallet address: ${wallet.address}`);
  
  // Initialize genesis with test account
  console.log("Initializing genesis...");
  await api.utxo.initGenesis([wallet.address]);
  
  // Check balance
  console.log("Checking balance...");
  const balance = await api.utxo.getBalance(wallet.address);
  console.log(`UTXO Balance: ${balance}`);
  
  // Get consensus state
  console.log("Checking consensus...");
  const state = await api.consensus.getState();
  console.log(`Block height: ${state.height}`);
  
  console.log("All tests passed! ✓");
}
```

## Platform-specific Notes

### Windows
- Library: `bolh_core.dll`
- Path: Searches `target/release/bolh_core.dll`

### Linux
- Library: `libbolh_core.so`
- Path: Searches `target/release/libbolh_core.so`

### iOS/macOS
- Library: `libbolh_core.dylib`
- Path: Searches `target/release/libbolh_core.dylib`
- Note: Requires iOS cross-compilation setup

### Android
- Library: `libbolh_core.so`
- Built for: `aarch64-linux-android`, `armv7-linux-androideabi`
- Requires: Rust Android targets installed

## Next Steps

1. **UI Components**: Build wallet UI in Solid.js using blockchain API
2. **Fee Estimation**: Add UI helpers to estimate transaction fees
3. **Balance Updates**: Stream balance and transaction updates via Tauri events
4. **Security**: Add biometric auth for wallet operations
5. **Persistence**: Tie blockchain persistence to app lifecycle
6. **Multi-wallet**: Extend UI to manage multiple wallets
7. **Transaction History**: Build transaction explorer UI
8. **Validator Setup**: Add UI for validators to participate in consensus

## Building for Mobile

### Build for Android
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi
cargo build --release --target aarch64-linux-android
```

### Build for iOS
```bash
rustup target add aarch64-apple-ios
cargo build --release --target aarch64-apple-ios
```

### Build Tauri Mobile Release
```bash
cd apps/mobile
cargo tauri build --target android  # or ios
```

## Performance Considerations

- **Wallet Creation**: O(1), creates in-memory entry
- **Transaction Signing**: O(1), uses PQC Dilithium2 (fast)
- **UTXO Lookup**: O(n) where n = UTXOs for address
- **Consensus Voting**: O(m) where m = number of validators (typically 3-21)
- **Block Finalization**: O(n) where n = transactions in block

All operations are non-blocking on the main thread (use `await` properly).

## Troubleshooting

### "bolh_core library not found"
- Ensure `cargo build --release` was run in blockchain directory
- Check that `target/release/` contains `bolh_core.dll` (Windows) or `.so`/`.dylib`
- For mobile, verify the library was built for the correct target

### "Symbol not found: bolh_init"
- Check that all blockchain functions are exported with `#[no_mangle]`
- Ensure _**bolh_bridge.rs**_ has been updated with the function signature

### Transaction validation fails
- Verify UTXOs exist for the specified address
- Ensure inputs reference existing transaction outputs
- Check that input amounts >= output amounts + fees
- Validate transaction signatures before submission

### Consensus voting fails
- Ensure voter address is in the validator committee
- Check block hasn't already been voted on by this validator
- Verify block ID is correct and proposed block exists

For more details, see the blockchain core [README.md](../../blockchain/core/README.md).
