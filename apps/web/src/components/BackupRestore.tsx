/**
 * Wallet Backup & Restore Modal
 * For managing BIP39 seed phrases
 */

import { createSignal, Show, For } from "solid-js";
import { copyToClipboard } from "../utils/clipboard";
import { showToast } from "./Toast";
import {
  createWalletBackup,
  restoreWalletFromSeedPhrase,
  formatSeedPhrase,
  getSeedPhraseStrength,
} from "../utils/seedphrase";
import "./BackupRestore.css";

export interface BackupRestoreProps {
  isOpen: boolean;
  walletName?: string;
  walletAddress?: string;
  publicKey?: string;
  privateKey?: string;
  onBackupComplete?: (seedPhrase: string) => void;
  onRestoreComplete?: (data: {
    name: string;
    pubkey: string;
    seckey: string;
  }) => void;
  onClose: () => void;
}

type Tab = "backup" | "restore";

export function BackupRestore(props: BackupRestoreProps) {
  const [activeTab, setActiveTab] = createSignal<Tab>("backup");
  const [seedPhrase, setSeedPhrase] = createSignal("");
  const [showSeedPhrase, setShowSeedPhrase] = createSignal(false);
  const [restoreName, setRestoreName] = createSignal("");
  const [restoreInput, setRestoreInput] = createSignal("");
  const [restored, setRestored] = createSignal(false);

  const handleGenerateBackup = () => {
    if (!props.walletName || !props.privateKey || !props.walletAddress || !props.publicKey) {
      showToast("Wallet information not available", "error");
      return;
    }

    try {
      const backup = createWalletBackup(
        props.walletName,
        props.publicKey,
        props.privateKey,
        props.walletAddress
      );

      setSeedPhrase(backup.mnemonic);
      setShowSeedPhrase(true);
      showToast("Seed phrase generated successfully", "success");

      if (props.onBackupComplete) {
        props.onBackupComplete(backup.mnemonic);
      }
    } catch (err) {
      showToast(`Failed to generate backup: ${err}`, "error");
    }
  };

  const handleCopySeedPhrase = () => {
    copyToClipboard(seedPhrase(), "Seed phrase copied to clipboard");
  };

  const handleRestoreWallet = () => {
    const input = restoreInput().trim();
    const name = restoreName().trim();

    if (!name) {
      showToast("Please enter a wallet name", "error");
      return;
    }

    if (!input) {
      showToast("Please enter a seed phrase", "error");
      return;
    }

    try {
      const result = restoreWalletFromSeedPhrase(input);
      setRestored(true);
      showToast("Wallet restored successfully!", "success");

      if (props.onRestoreComplete) {
        props.onRestoreComplete({
          name: name,
          pubkey: result.pubkey,
          seckey: result.seckey,
        });
      }
    } catch (err) {
      showToast(
        `Restore failed: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
      setRestored(false);
    }
  };

  const handlePasteSeedPhrase = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRestoreInput(text);
    } catch (err) {
      showToast("Failed to read clipboard", "error");
    }
  };

  const strength = () => {
    const input = restoreInput().trim();
    if (!input) return null;
    return getSeedPhraseStrength(input);
  };

  const seedWords = () => formatSeedPhrase(seedPhrase());
  const restoreWords = () => formatSeedPhrase(restoreInput());

  return (
    <Show when={props.isOpen}>
      <div class="backup-restore-overlay">
        <div class="backup-restore-modal">
          <div class="backup-header">
            <h2>Wallet Backup & Restore</h2>
            <button
              class="close-btn"
              onClick={props.onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Tab Navigation */}
          <div class="backup-tabs">
            <button
              class={`tab-btn ${activeTab() === "backup" ? "active" : ""}`}
              onClick={() => setActiveTab("backup")}
            >
              Backup
            </button>
            <button
              class={`tab-btn ${activeTab() === "restore" ? "active" : ""}`}
              onClick={() => setActiveTab("restore")}
            >
              Restore
            </button>
          </div>

          {/* Backup Tab */}
          <Show when={activeTab() === "backup"}>
            <div class="backup-content">
              <Show when={!seedPhrase()}>
                <div class="backup-info">
                  <p>
                    Back up your wallet by generating a seed phrase. Keep this phrase
                    safe and never share it with anyone.
                  </p>
                  <button class="btn-primary" onClick={handleGenerateBackup}>
                    Generate Seed Phrase
                  </button>
                </div>
              </Show>

              <Show when={seedPhrase()}>
                <div class="seed-display">
                  <div class="seed-warning">
                    <strong>Important:</strong> Keep your seed phrase safe. Never share
                    it with anyone. Anyone with this phrase can access your wallet.
                  </div>

                  <div
                    class={`seed-phrase-box ${showSeedPhrase() ? "revealed" : "hidden"}`}
                  >
                    {showSeedPhrase() ? (
                      <div class="seed-words">
                        <For each={seedWords()}>
                          {(word, index) => (
                            <div class="seed-word">
                              <span class="word-index">{index() + 1}</span>
                              <span class="word-text">{word}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    ) : (
                      <div class="seed-hidden">
                        <p>Click to reveal seed phrase</p>
                      </div>
                    )}
                  </div>

                  <button
                    class="toggle-seed-btn"
                    onClick={() => setShowSeedPhrase(!showSeedPhrase())}
                  >
                    {showSeedPhrase() ? "Hide Phrase" : "Show Phrase"}
                  </button>

                  <button
                    class="copy-seed-btn"
                    onClick={handleCopySeedPhrase}
                    disabled={!showSeedPhrase()}
                  >
                    Copy Phrase
                  </button>

                  <div class="backup-actions">
                    <button class="btn-secondary" onClick={props.onClose}>
                      Done
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* Restore Tab */}
          <Show when={activeTab() === "restore"}>
            <div class="restore-content">
              <div class="restore-info">
                <p>Enter your seed phrase to restore your wallet</p>
              </div>

              <Show when={!restored()}>
                <input
                  class="restore-name"
                  type="text"
                  placeholder="Wallet name"
                  value={restoreName()}
                  onInput={(e) => setRestoreName(e.currentTarget.value)}
                  maxLength={32}
                />

                <textarea
                  class="restore-input"
                  placeholder="Enter your 12 or 24-word seed phrase here (words separated by spaces)..."
                  value={restoreInput()}
                  onInput={(e) => setRestoreInput(e.currentTarget.value)}
                  rows={4}
                />

                <Show when={restoreWords().length > 0 && strength()}>
                  <div class="strength-indicator">
                    <span class={`strength-badge ${strength()?.strength}`}>
                      {strength()?.strength === "weak" && "Invalid"}
                      {strength()?.strength === "good" && "Valid (12 words)"}
                      {strength()?.strength === "strong" && "Valid (24 words)"}
                    </span>
                    <span class="strength-details">{strength()?.details}</span>
                  </div>
                </Show>

                <div class="restore-buttons">
                  <button class="btn-secondary" onClick={handlePasteSeedPhrase}>
                    Paste from Clipboard
                  </button>
                  <button
                    class="btn-primary"
                    onClick={handleRestoreWallet}
                    disabled={restoreWords().length < 12 || !restoreName().trim()}
                  >
                    Restore Wallet
                  </button>
                </div>
              </Show>

              <Show when={restored()}>
                <div class="restore-success">
                  <div class="success-icon"></div>
                  <h3>Wallet Restored!</h3>
                  <p>Your wallet has been successfully restored from the seed phrase.</p>
                  <button class="btn-primary" onClick={props.onClose}>
                    Close
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
