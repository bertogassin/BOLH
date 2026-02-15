/**
 * Transaction Form Component
 * Create and send blockchain transactions
 */

import { createSignal, Show, createEffect } from "solid-js";
import type { BlockchainStore } from "../hooks/useBlockchain";
import type { Transaction } from "../api/blockchain";
import { estimateFees, formatFee, getFeeDescription } from "../api/fees";
import type { FeeEstimate } from "../api/fees";
import { showToast } from "./Toast";
import { Spinner } from "./Spinner";
import "./TransactionForm.css";

interface TransactionFormProps {
  blockchain: BlockchainStore;
}

// Simple hash generator for demo
function generateSimpleHash(): string {
  return "0x" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function TransactionForm(props: TransactionFormProps) {
  const [recipientAddr, setRecipientAddr] = createSignal("");
  const [amount, setAmount] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [submitSuccess, setSubmitSuccess] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [feeEstimate, setFeeEstimate] = createSignal<FeeEstimate | null>(null);
  const [estimatingFee, setEstimatingFee] = createSignal(false);

  const wallet = () => props.blockchain.currentWallet();
  const availableBalance = () => props.blockchain.balance();
  const estimatedFee = () => feeEstimate()?.total_fee ?? 0;
  const totalCost = () => (parseFloat(amount() || "0") || 0) + estimatedFee();
  const canSubmit = () => {
    const amt = parseFloat(amount() || "0");
    return (
      !submitting() &&
      wallet() &&
      recipientAddr().length > 0 &&
      amt > 0 &&
      totalCost() <= availableBalance()
    );
  };

  // Debounced fee estimation
  let estimateTimeout: any;
  createEffect(async () => {
    const amt = parseFloat(amount() || "0");
    
    // Clear previous timeout
    if (estimateTimeout) clearTimeout(estimateTimeout);

    if (amt <= 0) {
      setFeeEstimate(null);
      return;
    }

    // Debounce fee estimation (500ms delay)
    setEstimatingFee(true);
    estimateTimeout = setTimeout(async () => {
      try {
        const utxoCount = props.blockchain.utxos().length || 1;
        const estimate = await estimateFees(Math.round(amt * 100_000_000), utxoCount);
        setFeeEstimate(estimate);
      } catch (err) {
        console.error("Failed to estimate fees:", err);
        // Fallback to simple estimation
        const fallbackFee = Math.max(10, Math.ceil(amt * 0.01));
        setFeeEstimate({
          base_fee: 1000,
          amount_fee: Math.round(amt * 100_000_000 * 0.001),
          priority_fee: 1000,
          total_fee: fallbackFee * 100_000_000,
          network_congestion: 0.3,
          estimated_block_time: 15,
        });
      } finally {
        setEstimatingFee(false);
      }
    }, 500);
  });

  const handleSubmit = async () => {
    try {
      setSubmitError(null);
      setSubmitting(true);
      showToast("Submitting transaction...", "info");

      const amt = parseFloat(amount());
      const senderWallet = wallet();

      if (!senderWallet) {
        showToast("No wallet selected", "error");
        setSubmitError("No wallet selected");
        return;
      }

      // Select UTXOs to spend (simple first-fit)
      const needed = totalCost();
      let collected = 0;
      const inputs: Transaction["inputs"] = [];

      for (const utxo of props.blockchain.utxos()) {
        if (utxo.spent || collected >= needed) break;
        inputs.push({
          txid: utxo.txid,
          output_index: utxo.output_index,
        });
        collected += utxo.amount;
      }

      if (inputs.length === 0) {
        setSubmitError("No unspent outputs available");
        return;
      }

      // Create transaction
      const changeAmount = collected - totalCost();
      const outputs: Transaction["outputs"] = [
        { address: recipientAddr(), amount: amt },
      ];

      if (changeAmount > 0) {
        outputs.push({ address: senderWallet.address, amount: changeAmount });
      }

      const tx: Transaction = {
        txid: generateSimpleHash(),
        inputs,
        outputs,
        timestamp: new Date().toISOString(),
        from: senderWallet.address,
        to: recipientAddr(),
        amount: parseFloat(amount() || "0") || 0,
        fee: estimatedFee(),
        status: 'pending',
      };

      // Submit transaction
      const result = await props.blockchain.submitTransaction(tx);

      setSubmitSuccess(true);
      setRecipientAddr("");
      setAmount("");
      showToast("Transaction submitted successfully!", "success");

      // Clear success message after 3s
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`Failed to submit transaction: ${msg}`);
      showToast(`Failed to submit: ${msg}`, "error");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="transaction-form">
      <h3>Send Transaction</h3>

      <Show when={!wallet()}>
        <div class="warning-box">
          Please create or select a wallet first
        </div>
      </Show>

      <Show when={submitSuccess()}>
        <div class="success-box">
          ✓ Transaction submitted successfully!
        </div>
      </Show>

      <Show when={submitError()}>
        <div class="error-box">{submitError()}</div>
      </Show>

      <div class="form-group">
        <label>Recipient Address</label>
        <input
          type="text"
          placeholder="0x... or wallet address"
          value={recipientAddr()}
          onInput={(e) => setRecipientAddr(e.currentTarget.value)}
          disabled={submitting() || !wallet()}
        />
      </div>

      <div class="form-group">
        <label>Amount (coins)</label>
        <input
          type="number"
          placeholder="0"
          min="0"
          value={amount()}
          onInput={(e) => setAmount(e.currentTarget.value)}
          disabled={submitting() || !wallet()}
        />
      </div>

      <div class="fee-breakdown">
        <div class="fee-row">
          <span>Amount:</span>
          <span>{parseFloat(amount() || "0").toLocaleString()} coins</span>
        </div>

        <Show when={estimatingFee()}>
          <div class="fee-row loading">
            <span>Calculating fees...</span>
            <Spinner size="small" />
          </div>
        </Show>

        <Show when={!estimatingFee() && feeEstimate()}>
          {(fee) => (
            <>
              <div class="fee-breakdown-detail">
                <div class="fee-item">
                  <span class="fee-label">Base Fee:</span>
                  <span class="fee-value">{formatFee(fee().base_fee)} ㄀</span>
                </div>
                <div class="fee-item">
                  <span class="fee-label">Amount Fee (0.1%):</span>
                  <span class="fee-value">{formatFee(fee().amount_fee)} ㄀</span>
                </div>
                <div class="fee-item">
                  <span class="fee-label">Priority Fee:</span>
                  <span class="fee-value">{formatFee(fee().priority_fee)} ㄀</span>
                </div>
                <div class="fee-divider"></div>
              </div>
              <div class="fee-row total">
                <span>Estimated Fee:</span>
                <span>{formatFee(fee().total_fee)} ㄀</span>
              </div>
              <div class="fee-info-text">
                {getFeeDescription(fee().network_congestion)} • ~{fee().estimated_block_time}s
              </div>
            </>
          )}
        </Show>

        <div class="fee-row total">
          <span>Total:</span>
          <span>{totalCost().toLocaleString()} coins</span>
        </div>
        <div class="fee-row available">
          <span>Available:</span>
          <span>{availableBalance().toLocaleString()} coins</span>
        </div>
      </div>

      <Show when={totalCost() > availableBalance()}>
        <div class="warning-box">
          Insufficient balance. Need {((totalCost() - availableBalance()) as number).toLocaleString()} more coins.
        </div>
      </Show>

      <button
        class="btn-submit"
        onClick={handleSubmit}
        disabled={!canSubmit()}
      >
        {submitting() ? (
          <>
            <Spinner size="small" />
            <span style="margin-left: 0.5rem;">Submitting...</span>
          </>
        ) : (
          "Send Transaction"
        )}
      </button>

      <div class="form-info">
        <strong>Dynamic Fee Calculation:</strong> Base (1000) + Amount (0.1%) + Priority + Input Complexity
      </div>
    </div>
  );
}
