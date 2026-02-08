# bolh-core (PoC)

This crate is a minimal PoC skeleton for the BOLH core. It builds a `cdylib` exposing a small C ABI that can be used by the mobile app or other consumers.

Exports (PoC):
- `bolh_init() -> *const c_char` — returns "ok" string.
- `bolh_create_key() -> *const c_char` — returns JSON with `pubkey` and `seckey`.
- `bolh_sign_tx(tx: *const c_char) -> *const c_char` — returns JSON with `signed_tx`.
- `bolh_submit_tx(signed_tx: *const c_char) -> *const c_char` — returns JSON with `txid`.
- `bolh_get_balance(addr: *const c_char) -> c_ulong` — returns balance from persistent storage.
- `bolh_mempool_size() -> c_ulong` — returns current mempool size.
- `bolh_submit_tx_to_mempool(tx: *const c_char) -> *const c_char` — adds tx to mempool (JSON format).
- `bolh_create_block_from_mempool() -> *const c_char` — creates block, saves to storage.
- `bolh_network_start(port: u16) -> *const c_char` — starts network listener.
- `bolh_network_stop() -> *const c_char` — stops network.
- `bolh_network_peers() -> *const c_char` — returns peer list.
- `bolh_propose_block(proposer: *const c_char, prev_block: *const c_char) -> *const c_char` — proposes new block (BFT).
- `bolh_vote_on_block(block_id: *const c_char, validator: *const c_char, approve: bool) -> *const c_char` — cast vote.
- `bolh_can_finalize(block_id: *const c_char) -> bool` — check if block has 2/3+ majority.
- `bolh_finalize_block(block_id: *const c_char) -> *const c_char` — finalize block with supermajority.
- `bolh_consensus_state() -> *const c_char` — get consensus state (round, height, validators).
- `bolh_voting_status(block_id: *const c_char) -> *const c_char` — get voting status for block.
- `bolh_init_genesis(accounts_json: *const c_char) -> *const c_char` — initialize genesis with accounts.
- `bolh_get_utxo_balance(addr: *const c_char) -> c_ulong` — get address balance from UTXO set.
- `bolh_get_utxos(addr: *const c_char) -> *const c_char` — get all UTXOs for address (JSON).
- `bolh_validate_and_process_tx(tx_json: *const c_char) -> *const c_char` — validate and process transaction.
- `bolh_utxo_persist() -> *const c_char` — persist UTXO state to storage.
- `bolh_create_wallet(name: *const c_char) -> *const c_char` — create new wallet (returns address).
- `bolh_get_wallet_info(name: *const c_char) -> *const c_char` — get wallet info (name, address, balance, created_at).
- `bolh_get_wallet_balance(name: *const c_char) -> c_ulong` — get wallet balance.
- `bolh_list_wallets() -> *const c_char` — list all wallet names (JSON array).
- `bolh_delete_wallet(name: *const c_char) -> *const c_char` — delete wallet.
- `bolh_import_wallet(name: *const c_char, pubkey: *const c_char, seckey: *const c_char) -> *const c_char` — import wallet from keys.
- `bolh_free(ptr: *mut c_char)` — free strings returned to C.

Build (native):

```bash
cd crates/bolh-core
cargo build --release
```

The shared library will be in `target/release/` (e.g. `libbolh_core.so` on Linux, `bolh_core.dll` on Windows, `libbolh_core.dylib` on macOS).

For mobile (Android/iOS) cross-compile, set appropriate Rust targets and use `cargo build --release --target <target>`.

PQC feature
-----------

This crate supports an optional `pqc` Cargo feature to enable real post-quantum
algorithms (Dilithium for signatures, Kyber for KEM) via the `pqcrypto-*`
crates. The feature is disabled by default to avoid requiring native toolchains
or large dependencies in CI.

Enable locally with:

```sh
cd crates/bolh-core
cargo test --features pqc
```

Example usage (when `pqc` feature is enabled):

```rust
use pqcrypto_dilithium::dilithium2::*;
let (pk, sk) = keypair();
let sig = detached_sign(b"message", &sk);
assert!(verify_detached_signature(&sig, b"message", &pk).is_ok());

use pqcrypto_kyber::kyber512::*;
let (pk, sk) = keypair();
let (ss1, ct) = encapsulate(&pk);
let ss2 = decapsulate(&ct, &sk);
assert!(ss1 == ss2);
```

BFT Consensus
-------------

The blockchain uses Byzantine Fault Tolerant (BFT) consensus with the following features:

- **Validator Committee**: Each validator has voting power (stake-based)
- **Block Proposals**: Validators propose blocks with transactions from mempool
- **Voting Mechanism**: Validators vote to approve/reject block proposals
- **Supermajority**: Blocks require >2/3 of total voting power to finalize
- **Round-based**: Consensus advances in rounds with height tracking
- **Persistence**: Finalized blocks are stored in sled database

Consensus Flow:
1. Propose block: `bolh_propose_block()` drains mempool and creates proposal
2. Validators vote: `bolh_vote_on_block()` with approve/reject
3. Check threshold: `bolh_can_finalize()` returns true when >2/3 voting power achieved
4. Finalize: `bolh_finalize_block()` commits block and advances state

Current implementation uses 3 demo validators with equal voting power (100 each).
Byzantine tolerance: can tolerate up to 1 faulty validator (f=1, n=3f+1).

Storage Layer
-------------

Persistent storage is implemented using sled embedded database:

- **Blocks**: Saved with `block:` prefix, contains transactions as JSON
- **Transactions**: Saved with `tx:` prefix, full transaction data
- **Balances**: Saved with `balance:` prefix, u64 values
- **Database Location**: `bolh_data/` directory in working directory

All finalized blocks and account states survive process restarts.

UTXO Model
----------

The blockchain implements a UTXO (Unspent Transaction Output) model for transaction validation:

- **Genesis Initialization**: Create initial UTXOs via `bolh_init_genesis()`
- **UTXO Validation**: Each transaction validates:
  - All inputs exist and are unspent
  - Total input amount >= total output amount
  - No double-spending (prevents reusing outputs)
- **Balance Tracking**: Balances computed from unspent outputs
- **Multiple Inputs/Outputs**: Transactions can consolidate or distribute funds
- **Persistence**: UTXO set persists across restarts

Transaction Processing:
1. Validate inputs exist and are unspent
2. Check sufficient balance (total inputs >= total outputs)
3. Mark consumed inputs as spent
4. Create new outputs
5. Update UTXO set

Example: Alice has 1000 BOLH → sends 300 to Bob → change 700 back to Alice
- Input: genesis output (1000)
- Outputs: Bob (300) + Alice (700)
- Result: Bob has 300 unspent, Alice has 700 unspent

Testing: 10 comprehensive UTXO tests validate genesis, transfers, double-spend prevention, insufficient funds, and multi-input/output transactions.

Wallet Management
-----------------

The wallet module provides high-level key management and transaction creation:

- **Key Generation**: Create wallets with unique keypairs (Dilithium2 for signatures)
- **Multi-wallet Support**: Create and manage multiple wallets in same process
- **UTXO Selection**: Automatic greedy selection of UTXOs to spend
- **Fee Estimation**: Calculate transaction fees based on input/output count
- **Transaction Creation**: Build transactions with proper inputs/outputs/change
- **Signing**: Sign transactions with wallet's private key
- **Storage**: In-memory wallet registry (can be persisted)

Wallet Workflow:
1. Create wallet: `bolh_create_wallet("alice")`
2. Get balance: `bolh_get_wallet_balance("alice")`
3. Create tx: Select UTXOs and create transaction with change
4. Sign tx: `wallet.sign_transaction(tx.txid)`
5. Submit: Add signed transaction to mempool via FFI

Features:
- Greedy UTXO selection algorithm (picks largest UTXOs first)
- Automatic change calculation (input - output - fee)
- Fee estimation: 150 bytes/input + 34 bytes/output + 10 bytes overhead
- Default fee: 1000 satoshis
- Wallet export (public info only, no secret keys)
- Import wallets from existing key pairs

Testing: 21 unit tests + 7 integration tests for wallet creation, signing, UTXO selection, fee estimation, and lifecycle management.

Test Coverage Summary
--------------------

Total: **65 tests** across all modules

- **Consensus** (7 tests): BFT voting, supermajority, finalization, double-vote prevention
- **Cryptography** (1 test): Key generation and signing (demo mode)
- **Mempool** (2 tests): Transaction submission and JSON parsing
- **Network** (1 test): TCP listener start/stop
- **Storage** (3 tests): Block and transaction persistence
- **Transactions** (5 tests): Serialization, hashing, signing, multi-output
- **UTXO** (10 tests): Genesis, transfers, double-spend prevention, multi-input/output
- **Wallet** (7 tests): Creation, signing, balance queries, UTXO selection
- **Unit tests in lib.rs** (21 tests): Combined module tests

All tests pass with `cargo test -- --test-threads=1` (serial execution prevents wallet state pollution).

Note: enabling `pqc` may pull in crates that require native toolchains. If you
see build errors about missing system tools (e.g. `protoc`), install the
appropriate tools or run without the `pqc` feature.

