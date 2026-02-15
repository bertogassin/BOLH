//! BOLH Smart Contract Engine
//!
//! Simple rule-based contracts for the BOLH platform:
//! - Escrow: lock payment until service is confirmed
//! - Subscription: recurring payments with auto-renewal
//! - Bounty: reward for completing a task
//! - Insurance: automatic payout on verified incident
//!
//! Contracts are stored on-chain and executed automatically.

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use crate::types::Address;

/// Unique contract ID
pub type ContractId = String;

/// Contract type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum ContractType {
    /// Escrow: funds locked until both parties confirm
    Escrow,
    /// Subscription: periodic payment from client to provider
    Subscription,
    /// Bounty: reward for task completion
    Bounty,
    /// Insurance: payout on verified claim
    Insurance,
}

/// Contract state
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum ContractState {
    /// Created, waiting for funding
    Pending,
    /// Funded and active
    Active,
    /// Service completed, awaiting confirmation
    AwaitingConfirmation,
    /// Dispute raised
    Disputed,
    /// Completed and paid out
    Completed,
    /// Cancelled and refunded
    Cancelled,
    /// Expired (timed out)
    Expired,
}

/// A smart contract
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Contract {
    /// Unique ID
    pub id: ContractId,
    /// Contract type
    pub contract_type: ContractType,
    /// Current state
    pub state: ContractState,
    /// Client (payer)
    pub client: String,
    /// Provider (payee)
    pub provider: String,
    /// Amount locked
    pub amount: u64,
    /// Platform fee (basis points, e.g., 500 = 5%)
    pub platform_fee_bps: u64,
    /// Creation timestamp
    pub created_at: u64,
    /// Deadline timestamp (0 = no deadline)
    pub deadline: u64,
    /// Description
    pub description: String,
    /// Conditions as key-value pairs
    pub conditions: HashMap<String, String>,
    /// Approval from client
    pub client_approved: bool,
    /// Approval from provider
    pub provider_approved: bool,
    /// Dispute reason (if any)
    pub dispute_reason: Option<String>,
    /// Resolution (if disputed)
    pub resolution: Option<String>,
    /// Transaction IDs associated with this contract
    pub tx_ids: Vec<String>,
}

/// Contract engine
pub struct ContractEngine {
    contracts: RwLock<HashMap<ContractId, Contract>>,
    /// Contracts by participant address
    participant_index: RwLock<HashMap<String, Vec<ContractId>>>,
    /// Total value locked
    total_locked: RwLock<u64>,
    /// Total contracts created
    total_created: RwLock<u64>,
    /// Total value settled
    total_settled: RwLock<u64>,
}

/// Contract creation result
#[derive(Debug, Serialize)]
pub struct ContractResult {
    pub success: bool,
    pub contract_id: String,
    pub message: String,
}

/// Contract engine statistics
#[derive(Debug, Serialize)]
pub struct ContractStats {
    pub total_created: u64,
    pub active_count: usize,
    pub total_locked: u64,
    pub total_settled: u64,
    pub by_type: HashMap<String, u64>,
}

impl ContractEngine {
    pub fn new() -> Self {
        ContractEngine {
            contracts: RwLock::new(HashMap::new()),
            participant_index: RwLock::new(HashMap::new()),
            total_locked: RwLock::new(0),
            total_created: RwLock::new(0),
            total_settled: RwLock::new(0),
        }
    }

    /// Create an escrow contract
    pub fn create_escrow(
        &self,
        client: &Address,
        provider: &Address,
        amount: u64,
        description: &str,
        deadline: u64,
    ) -> ContractResult {
        self.create_contract(
            ContractType::Escrow,
            client,
            provider,
            amount,
            description,
            deadline,
            500, // 5% platform fee
            HashMap::new(),
        )
    }

    /// Create a subscription contract
    pub fn create_subscription(
        &self,
        client: &Address,
        provider: &Address,
        monthly_amount: u64,
        description: &str,
    ) -> ContractResult {
        let mut conditions = HashMap::new();
        conditions.insert("period".into(), "monthly".into());
        conditions.insert("auto_renew".into(), "true".into());

        self.create_contract(
            ContractType::Subscription,
            client,
            provider,
            monthly_amount,
            description,
            0, // No deadline
            300, // 3% platform fee
            conditions,
        )
    }

    /// Create a bounty contract
    pub fn create_bounty(
        &self,
        creator: &Address,
        amount: u64,
        description: &str,
        deadline: u64,
    ) -> ContractResult {
        self.create_contract(
            ContractType::Bounty,
            creator,
            &Address::zero(), // Provider TBD
            amount,
            description,
            deadline,
            500,
            HashMap::new(),
        )
    }

    /// Internal: create contract
    fn create_contract(
        &self,
        contract_type: ContractType,
        client: &Address,
        provider: &Address,
        amount: u64,
        description: &str,
        deadline: u64,
        platform_fee_bps: u64,
        conditions: HashMap<String, String>,
    ) -> ContractResult {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let count = {
            let mut c = self.total_created.write();
            *c += 1;
            *c
        };

        let id = format!("SC-{:06}", count);

        let contract = Contract {
            id: id.clone(),
            contract_type,
            state: ContractState::Pending,
            client: client.to_bech32(),
            provider: provider.to_bech32(),
            amount,
            platform_fee_bps,
            created_at: now,
            deadline,
            description: description.to_string(),
            conditions,
            client_approved: false,
            provider_approved: false,
            dispute_reason: None,
            resolution: None,
            tx_ids: Vec::new(),
        };

        let mut contracts = self.contracts.write();
        contracts.insert(id.clone(), contract);

        // Index by participant
        let mut index = self.participant_index.write();
        index.entry(client.to_bech32()).or_default().push(id.clone());
        if !provider.is_zero() {
            index.entry(provider.to_bech32()).or_default().push(id.clone());
        }

        ContractResult {
            success: true,
            contract_id: id,
            message: "Contract created".into(),
        }
    }

    /// Fund a contract (move to Active state)
    pub fn fund(&self, contract_id: &str) -> ContractResult {
        let mut contracts = self.contracts.write();
        let Some(contract) = contracts.get_mut(contract_id) else {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not found".into() };
        };

        if contract.state != ContractState::Pending {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not in pending state".into() };
        }

        contract.state = ContractState::Active;
        *self.total_locked.write() += contract.amount;

        ContractResult {
            success: true,
            contract_id: contract_id.into(),
            message: format!("Funded {} BOLH", contract.amount / 100_000_000),
        }
    }

    /// Mark service as completed (provider signals)
    pub fn complete_service(&self, contract_id: &str, provider: &Address) -> ContractResult {
        let mut contracts = self.contracts.write();
        let Some(contract) = contracts.get_mut(contract_id) else {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not found".into() };
        };

        if contract.provider != provider.to_bech32() {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not the provider".into() };
        }

        contract.state = ContractState::AwaitingConfirmation;
        contract.provider_approved = true;

        ContractResult {
            success: true,
            contract_id: contract_id.into(),
            message: "Awaiting client confirmation".into(),
        }
    }

    /// Client confirms completion — triggers payout
    pub fn confirm_completion(&self, contract_id: &str, client: &Address) -> ContractResult {
        let mut contracts = self.contracts.write();
        let Some(contract) = contracts.get_mut(contract_id) else {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not found".into() };
        };

        if contract.client != client.to_bech32() {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not the client".into() };
        }

        contract.client_approved = true;
        contract.state = ContractState::Completed;

        let payout = contract.amount;
        let fee = payout * contract.platform_fee_bps / 10_000;
        let provider_receives = payout - fee;

        *self.total_locked.write() -= contract.amount;
        *self.total_settled.write() += contract.amount;

        ContractResult {
            success: true,
            contract_id: contract_id.into(),
            message: format!(
                "Completed! Provider receives {} BOLH (fee: {} BOLH)",
                provider_receives / 100_000_000,
                fee / 100_000_000
            ),
        }
    }

    /// Raise a dispute
    pub fn dispute(&self, contract_id: &str, reason: &str) -> ContractResult {
        let mut contracts = self.contracts.write();
        let Some(contract) = contracts.get_mut(contract_id) else {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not found".into() };
        };

        contract.state = ContractState::Disputed;
        contract.dispute_reason = Some(reason.to_string());

        ContractResult {
            success: true,
            contract_id: contract_id.into(),
            message: "Dispute raised".into(),
        }
    }

    /// Cancel a contract (refund client)
    pub fn cancel(&self, contract_id: &str) -> ContractResult {
        let mut contracts = self.contracts.write();
        let Some(contract) = contracts.get_mut(contract_id) else {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Not found".into() };
        };

        if contract.state == ContractState::Completed {
            return ContractResult { success: false, contract_id: contract_id.into(), message: "Already completed".into() };
        }

        let was_funded = contract.state == ContractState::Active
            || contract.state == ContractState::AwaitingConfirmation
            || contract.state == ContractState::Disputed;

        contract.state = ContractState::Cancelled;

        if was_funded {
            *self.total_locked.write() -= contract.amount;
        }

        ContractResult {
            success: true,
            contract_id: contract_id.into(),
            message: format!("Cancelled. {} BOLH refunded", if was_funded { contract.amount / 100_000_000 } else { 0 }),
        }
    }

    /// Get contract by ID
    pub fn get_contract(&self, id: &str) -> Option<Contract> {
        self.contracts.read().get(id).cloned()
    }

    /// Get all contracts for an address
    pub fn get_contracts_for(&self, address: &Address) -> Vec<Contract> {
        let index = self.participant_index.read();
        let contracts = self.contracts.read();

        index.get(&address.to_bech32())
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| contracts.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get statistics
    pub fn stats(&self) -> ContractStats {
        let contracts = self.contracts.read();
        let active = contracts.values().filter(|c| c.state == ContractState::Active).count();

        let mut by_type: HashMap<String, u64> = HashMap::new();
        for c in contracts.values() {
            *by_type.entry(format!("{:?}", c.contract_type)).or_default() += 1;
        }

        ContractStats {
            total_created: *self.total_created.read(),
            active_count: active,
            total_locked: *self.total_locked.read(),
            total_settled: *self.total_settled.read(),
            by_type,
        }
    }
}

impl Default for ContractEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn addr(id: u8) -> Address {
        Address::from_public_key(&[id; 32])
    }

    #[test]
    fn test_escrow_flow() {
        let engine = ContractEngine::new();
        let client = addr(1);
        let guard = addr(2);

        // Create
        let result = engine.create_escrow(&client, &guard, 50_000_00_000_000, "Security service", 0);
        assert!(result.success);

        // Fund
        engine.fund(&result.contract_id);
        let c = engine.get_contract(&result.contract_id).unwrap();
        assert_eq!(c.state, ContractState::Active);

        // Provider completes
        engine.complete_service(&result.contract_id, &guard);
        let c = engine.get_contract(&result.contract_id).unwrap();
        assert_eq!(c.state, ContractState::AwaitingConfirmation);

        // Client confirms
        let final_result = engine.confirm_completion(&result.contract_id, &client);
        assert!(final_result.success);
        let c = engine.get_contract(&result.contract_id).unwrap();
        assert_eq!(c.state, ContractState::Completed);
    }

    #[test]
    fn test_dispute() {
        let engine = ContractEngine::new();
        let client = addr(1);
        let guard = addr(2);

        let result = engine.create_escrow(&client, &guard, 10_000_00_000_000, "Test", 0);
        engine.fund(&result.contract_id);

        let dispute = engine.dispute(&result.contract_id, "Service not provided");
        assert!(dispute.success);

        let c = engine.get_contract(&result.contract_id).unwrap();
        assert_eq!(c.state, ContractState::Disputed);
    }

    #[test]
    fn test_cancel_refund() {
        let engine = ContractEngine::new();
        let client = addr(1);
        let guard = addr(2);

        let result = engine.create_escrow(&client, &guard, 10_000_00_000_000, "Test", 0);
        engine.fund(&result.contract_id);

        assert_eq!(*engine.total_locked.read(), 10_000_00_000_000);

        engine.cancel(&result.contract_id);
        assert_eq!(*engine.total_locked.read(), 0); // Refunded
    }
}
