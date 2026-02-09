/**
 * Blockchain Screen - Main Container
 * Integrates all blockchain components
 */

import { Show, For, createSignal } from "solid-js";
import { useBlockchain } from "../hooks/useBlockchain";
import type { SmokeTestResult } from "../api/blockchain";
import { runBlockchainSmokeTest } from "../api/blockchain";
import { WalletManager } from "./WalletManager";
import { BalanceDisplay } from "./BalanceDisplay";
import { TransactionForm } from "./TransactionForm";
import { ConsensusMonitor } from "./ConsensusMonitor";
import { TransactionHistory } from "./TransactionHistory";
import { Statistics } from "./Statistics";
import { BlockchainExplorer } from "./BlockchainExplorer";
import { ToastContainer } from "./Toast";
import "./BlockchainScreen.css";

interface BlockchainScreenProps {
  onBack?: () => void;
}

export function BlockchainScreen(props: BlockchainScreenProps) {
  const blockchain = useBlockchain();
  const [smokeRunning, setSmokeRunning] = createSignal(false);
  const [smokeResult, setSmokeResult] = createSignal<SmokeTestResult | null>(
    null
  );

  const runSmokeTest = async () => {
    setSmokeRunning(true);
    setSmokeResult(null);
    try {
      const result = await runBlockchainSmokeTest();
      setSmokeResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSmokeResult({
        ok: false,
        steps: [{ name: "smoke_test", ok: false, message: msg }],
      });
    } finally {
      setSmokeRunning(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <div class="blockchain-screen">
      <div class="header">
        <Show when={props.onBack}>
          <button class="back-button" onClick={props.onBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </Show>
        <h1>BOLH Blockchain</h1>
        <div class="status-indicator">
          {blockchain.initialized() ? (
            <>
              <span class="dot online" />
              <span class="status-text">Connected</span>
            </>
          ) : (
            <>
              <span class="dot loading" />
              <span class="status-text">Initializing...</span>
            </>
          )}
        </div>
      </div>

      <Show when={blockchain.initError()}>
        <div class="init-error">
          <strong>Blockchain Error:</strong>
          <p>{blockchain.initError()}</p>
        </div>
      </Show>

      <div class="smoke-test">
        <div class="smoke-header">
          <h2>FFI Smoke Test</h2>
          <button
            class="smoke-button"
            type="button"
            onClick={runSmokeTest}
            disabled={smokeRunning()}
          >
            {smokeRunning() ? "Running..." : "Run"}
          </button>
        </div>

        <Show when={smokeResult()}>
          <div class={`smoke-status ${smokeResult()!.ok ? "ok" : "fail"}`}>
            {smokeResult()!.ok ? "OK" : "FAILED"}
          </div>
          <ul class="smoke-steps">
            <For each={smokeResult()!.steps}>
              {(step) => (
                <li class={`smoke-step ${step.ok ? "ok" : "fail"}`}>
                  <span class="step-name">{step.name}</span>
                  <span class="step-state">{step.ok ? "OK" : "FAIL"}</span>
                  <Show when={step.message}>
                    <span class="step-msg">{step.message}</span>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class="content">
        <BalanceDisplay blockchain={blockchain} />
        <WalletManager blockchain={blockchain} />
        <TransactionForm blockchain={blockchain} />
        <ConsensusMonitor blockchain={blockchain} />
        <Statistics blockchain={blockchain} />
        <BlockchainExplorer blockchain={blockchain} />
        <TransactionHistory blockchain={blockchain} />
      </div>

      <div class="footer">
        <div class="footer-info">
          <span class="stat">
            <strong>Wallets:</strong> {blockchain.allWallets.length}
          </span>
          <span class="stat">
            <strong>Height:</strong> {blockchain.consensusState()?.height ?? 0}
          </span>
          <span class="stat">
            <strong>Validators:</strong> {blockchain.consensusState()?.validators.length ?? 0}
          </span>
        </div>
      </div>
    </div>
    </>
  );
}
