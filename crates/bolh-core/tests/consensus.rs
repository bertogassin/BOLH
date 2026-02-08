use bolh_core::{consensus, transaction};

#[test]
fn block_id_changes_with_txs() {
    let tx1 = transaction::create_transfer("alice", "bob", 100, "prev_1", 0);
    let tx2 = transaction::create_transfer("bob", "charlie", 200, "prev_2", 0);
    
    let id1 = consensus::create_block_id(&vec![]);
    let id2 = consensus::create_block_id(&vec![tx1.clone()]);
    assert_ne!(id1, id2);
    
    let id3 = consensus::create_block_id(&vec![tx1.clone(), tx2.clone()]);
    assert_ne!(id2, id3);
}

#[test]
fn test_bft_voting() {
    consensus::reset_state();
    
    // Create a block proposal
    let tx = transaction::create_transfer("alice", "bob", 100, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // Validators vote
    let vote1 = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    assert!(vote1.is_ok());
    
    let vote2 = consensus::vote_on_block(&proposal.block_id, "validator_2", true);
    assert!(vote2.is_ok());
    
    // Should not have supermajority yet (2/3 validators)
    assert!(!consensus::can_finalize(&proposal.block_id));
    
    // Third validator votes
    let vote3 = consensus::vote_on_block(&proposal.block_id, "validator_3", true);
    assert!(vote3.is_ok());
    
    // Now should have supermajority (3/3 = 100% > 66.6%)
    assert!(consensus::can_finalize(&proposal.block_id));
}

#[test]
fn test_bft_supermajority() {
    consensus::reset_state();
    
    let tx = transaction::create_transfer("alice", "bob", 50, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // Only 2 out of 3 validators approve
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_2", true);
    
    // 2/3 voting power = 66.6%, which is NOT > 66.6% (needs strictly greater)
    // Actually with equal voting power (100 each), 200/300 = 66.6%
    // For BFT we need > 2/3, so 200*3 = 600, 300*2 = 600, 600 > 600 is false
    assert!(!consensus::can_finalize(&proposal.block_id));
    
    // Third validator votes to achieve supermajority
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_3", true);
    assert!(consensus::can_finalize(&proposal.block_id));
}

#[test]
fn test_block_finalization() {
    consensus::reset_state();
    
    let tx = transaction::create_transfer("alice", "bob", 200, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // All validators vote
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_2", true);
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_3", true);
    
    // Finalize block
    let result = consensus::finalize_block(&proposal.block_id);
    assert!(result.is_ok());
    
    // State should advance
    let state = consensus::get_state_info();
    assert_eq!(state["height"], 1);
    assert_eq!(state["round"], 1);
    assert_eq!(state["finalized_blocks"], 1);
}

#[test]
fn test_double_voting_prevention() {
    consensus::reset_state();
    
    let tx = transaction::create_transfer("alice", "bob", 300, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // First vote succeeds
    let vote1 = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    assert!(vote1.is_ok());
    
    // Second vote from same validator should fail
    let vote2 = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    assert!(vote2.is_err());
    assert!(vote2.unwrap_err().contains("already voted"));
}

#[test]
fn test_invalid_validator() {
    consensus::reset_state();
    
    let tx = transaction::create_transfer("alice", "bob", 150, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // Vote from non-existent validator should fail
    let vote = consensus::vote_on_block(&proposal.block_id, "fake_validator", true);
    assert!(vote.is_err());
    assert!(vote.unwrap_err().contains("not in committee"));
}

#[test]
fn test_voting_status() {
    consensus::reset_state();
    
    let tx = transaction::create_transfer("alice", "bob", 99, "prev", 0);
    let proposal = consensus::propose_block(vec![tx], "validator_1", "genesis");
    
    // Cast some votes
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_1", true);
    let _ = consensus::vote_on_block(&proposal.block_id, "validator_2", true);
    
    // Check voting status
    let status = consensus::get_voting_status(&proposal.block_id);
    assert_eq!(status["votes"], 2);
    assert_eq!(status["voting_power"], 200);
    assert_eq!(status["total_power"], 300);
}
