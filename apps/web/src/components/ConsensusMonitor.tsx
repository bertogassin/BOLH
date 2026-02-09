/**
 * Consensus Monitor Component
 * Displays blockchain consensus state and validator info
 */

import { createSignal, For, Show } from "solid-js";
import type { BlockchainStore } from "../hooks/useBlockchain";
import "./ConsensusMonitor.css";

interface ConsensusMonitorProps {
  blockchain: BlockchainStore;
}

export function ConsensusMonitor(props: ConsensusMonitorProps) {
  const [showValidators, setShowValidators] = createSignal(false);

  const state = () => props.blockchain.consensusState();

  const totalVotingPower = () => {
    const s = state();
    if (!s) return 0;
    return s.validators.reduce((sum: number, v: any) => sum + v.voting_power, 0);
  };

  const majorityThreshold = () => {
    const total = totalVotingPower();
    return Math.floor((total * 2) / 3) + 1;
  };

  return (
    <div class="consensus-monitor">
      <h3>Blockchain Consensus</h3>

      <Show when={props.blockchain.consensusError()}>
        <div class="error-box">{props.blockchain.consensusError()}</div>
      </Show>

      <Show
        when={state()}
        fallback={<p class="loading-state">Loading consensus state...</p>}
      >
        {(s) => (
          <>
            <div class="status-cards">
              <div class="status-card">
                <div class="card-label">Block Height</div>
                <div class="card-value">{s().height}</div>
              </div>

              <div class="status-card">
                <div class="card-label">Round</div>
                <div class="card-value">{s().round}</div>
              </div>

              <div class="status-card">
                <div class="card-label">Validators</div>
                <div class="card-value">{s().validators.length}</div>
              </div>

              <div class="status-card">
                <div class="card-label">Majority</div>
                <div class="card-value">{majorityThreshold()}</div>
              </div>
            </div>

            <div class="proposer-info">
              <span class="label">Current Proposer:</span>
              <span class="proposer">
                {(s()?.current_proposer || 'Unknown')
                  .slice(0, 12)
                  .toUpperCase()}
                ...
              </span>
            </div>

            <div class="validators-section">
              <button
                class="expand-btn"
                onClick={() => setShowValidators(!showValidators())}
              >
                <span class="arrow">{showValidators() ? "▼" : "▶"}</span>
                Validators ({s().validators.length})
              </button>

              <Show when={showValidators()}>
                <div class="validators-list">
                  <For each={s().validators}>
                    {(validator) => (
                      <div class="validator-card">
                        <div class="validator-header">
                          <span class="address">
                            {(validator.address || 'Unknown').slice(0, 12)}...
                          </span>
                          <span class="power">
                            {validator.voting_power ?? 0} power
                          </span>
                        </div>
                        <div class="power-bar">
                          <div
                            class="power-fill"
                            style={{
                              width: `${
                                (((validator.voting_power ?? 0) / totalVotingPower()) *
                                100)}
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </For>

                  <div class="voting-info">
                    <div class="info-row">
                      <span>Total Voting Power:</span>
                      <span>{totalVotingPower()}</span>
                    </div>
                    <div class="info-row">
                      <span>Supermajority ({'>'}2/3):</span>
                      <span>{majorityThreshold()}</span>
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <div class="consensus-rules">
              <strong>Consensus Rules:</strong>
              <ul>
                <li>Block requires {'>'}  2/3 of voting power to finalize</li>
                <li>One validator per round cannot finalize alone</li>
                <li>Byzantine tolerate up to ⌊(n-1)/3⌋ faulty validators</li>
              </ul>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
