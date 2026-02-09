/**
 * Wallet Manager Component
 * Displays list of wallets, create/delete functionality
 */

import { createSignal, For, Show } from "solid-js";
import type { BlockchainStore } from "../hooks/useBlockchain";
import { copyToClipboard } from "../utils/clipboard";
import { encryptPrivateKey, decryptPrivateKey, isEncrypted } from "../utils/keyEncryption";
import { showToast } from "./Toast";
import { Spinner } from "./Spinner";
import { QRButton } from "./QRModal";
import { PasswordPrompt } from "./PasswordPrompt";
import { BackupRestore } from "./BackupRestore";
import "./WalletManager.css";

interface WalletManagerProps {
  blockchain: BlockchainStore;
}

export function WalletManager(props: WalletManagerProps) {
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [newWalletName, setNewWalletName] = createSignal("");
  const [creatingWallet, setCreatingWallet] = createSignal(false);
  const [deletingWallet, setDeletingWallet] = createSignal<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = createSignal(false);
  const [passwordAction, setPasswordAction] = createSignal<"export" | "import">("export");
  const [exportingWallet, setExportingWallet] = createSignal<string | null>(null);
  const [importFileInput, setImportFileInput] = createSignal<HTMLInputElement | undefined>();
  const [showBackupRestore, setShowBackupRestore] = createSignal(false);
  const [backupWallet, setBackupWallet] = createSignal<string | null>(null);

  const handleCreate = async () => {
    const name = newWalletName().trim();
    if (!name) return;

    setCreatingWallet(true);
    try {
      await props.blockchain.createWallet(name);
      setNewWalletName("");
      setShowCreateForm(false);
      showToast(`Wallet "${name}" created successfully!`, "success");
    } catch (err) {
      showToast(`Failed to create wallet: ${err}`, "error");
    } finally {
      setCreatingWallet(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete wallet "${name}"?`)) return;
    setDeletingWallet(name);
    try {
      await props.blockchain.deleteWallet(name);
      showToast(`Wallet "${name}" deleted`, "info");
    } catch (err) {
      showToast(`Failed to delete wallet: ${err}`, "error");
    } finally {
      setDeletingWallet(null);
    }
  };

  const handleExportWallet = async (walletName: string, password: string) => {
    try {
      setExportingWallet(walletName);
      const wallet = props.blockchain.allWallets().find(w => w.name === walletName);
      if (!wallet) throw new Error("Wallet not found");
      if (!wallet.seckey || !wallet.pubkey) {
        throw new Error("Wallet keys are not available for export");
      }

      // Encrypt the private key
      const encryptedData = encryptPrivateKey(wallet.seckey, password);

      // Create export data
      const exportData = {
        version: 1,
        name: wallet.name,
        address: wallet.address,
        pubkey: wallet.pubkey,
        encrypted: true,
        encryptedKey: encryptedData,
        exportedAt: new Date().toISOString(),
      };

      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${walletName}_encrypted.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("Wallet exported successfully!", "success");
      setShowPasswordPrompt(false);
    } catch (err) {
      showToast(`Export failed: ${err}`, "error");
    } finally {
      setExportingWallet(null);
    }
  };

  const handleImportWallet = async (password: string) => {
    try {
      const fileInput = importFileInput();
      if (!fileInput?.files?.length) {
        throw new Error("No file selected");
      }

      const file = fileInput.files[0];
      const content = await file.text();
      const importData = JSON.parse(content);

      // Validate import data format
      if (!importData.encryptedKey || !isEncrypted(importData.encryptedKey)) {
        throw new Error("Invalid wallet file format");
      }
      if (!importData.pubkey) {
        throw new Error("Missing public key in wallet file");
      }

      // Decrypt the private key
      const seckey = decryptPrivateKey(importData.encryptedKey, password);

      // Import the wallet
      await props.blockchain.importWallet(importData.name, importData.pubkey, seckey);

      showToast(`Wallet "${importData.name}" imported successfully!`, "success");
      setShowPasswordPrompt(false);
      if (fileInput) fileInput.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Import failed: ${msg}`, "error");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <div class="wallet-manager">
      <h2>Wallets</h2>

      <Show
        when={props.blockchain.walletError()}
        fallback={null}
      >
        <div class="error-box">
          {props.blockchain.walletError()}
        </div>
      </Show>

      <div class="wallets-list">
        <For
          each={props.blockchain.allWallets()}
          fallback={<p class="empty-state">No wallets yet</p>}
        >
          {(wallet) => (
            <div
              class={`wallet-item ${
                props.blockchain.currentWallet()?.name === wallet.name
                  ? "active"
                  : ""
              }`}
              onClick={() => props.blockchain.selectWallet(wallet.name)}
            >
              <div class="wallet-info">
                <div class="wallet-name">{wallet.name}</div>
                <div class="wallet-address" title={wallet.address}>
                  {formatAddress(wallet.address)}
                  <button
                    class="copy-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(wallet.address, "Address copied!");
                    }}
                    title="Copy address"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M8 4V16C8 16.5304 8.21071 17.0391 8.58579 17.4142C8.96086 17.7893 9.46957 18 10 18H18C18.5304 18 19.0391 17.7893 19.4142 17.4142C19.7893 17.0391 20 16.5304 20 16V7.242C20 6.97556 19.9467 6.71181 19.8433 6.46624C19.7399 6.22068 19.5885 5.99824 19.398 5.812L16.083 2.57C15.7094 2.20466 15.2076 2.00007 14.685 2H10C9.46957 2 8.96086 2.21071 8.58579 2.58579C8.21071 2.96086 8 3.46957 8 4V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M16 18V20C16 20.5304 15.7893 21.0391 15.4142 21.4142C15.0391 21.7893 14.5304 22 14 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V9C4 8.46957 4.21071 7.96086 4.58579 7.58579C4.96086 7.21071 5.46957 7 6 7H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <QRButton value={wallet.address} />
                  <button
                    class="export-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExportingWallet(wallet.name);
                      setPasswordAction("export");
                      setShowPasswordPrompt(true);
                    }}
                    title="Export encrypted wallet"
                  >
                    Export
                  </button>
                  <button
                    class="backup-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBackupWallet(wallet.name);
                      setShowBackupRestore(true);
                    }}
                    title="Backup wallet with seed phrase"
                  >
                    Backup
                  </button>
                </div>
              </div>
              <div class="wallet-balance">
                {wallet.balance.toLocaleString()} coins
              </div>
              <button
                class="delete-btn"
                disabled={deletingWallet() !== null}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(wallet.name);
                }}
              >
                {deletingWallet() === wallet.name ? (
                  <Spinner size="small" color="error" />
                ) : (
                  "✕"
                )}
              </button>
            </div>
          )}
        </For>
      </div>

      <Show when={!showCreateForm()}>
        <button
          class="btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + Create Wallet
        </button>
        <button
          class="btn-secondary"
          onClick={() => {
            setPasswordAction("import");
            setShowPasswordPrompt(true);
          }}
        >
          📂 Import Wallet
        </button>
        <input
          ref={setImportFileInput}
          type="file"
          accept=".json"
          style="display: none;"
          onChange={(e) => {
            if (e.currentTarget.files?.length) {
              setPasswordAction("import");
              setShowPasswordPrompt(true);
            }
          }}
        />
      </Show>

      <Show when={showCreateForm()}>
        <div class="create-form">
          <input
            type="text"
            placeholder="Wallet name"
            value={newWalletName()}
            onInput={(e) => setNewWalletName(e.currentTarget.value)}
            disabled={creatingWallet()}
            maxLength={32}
          />
          <div class="form-actions">
            <button
              class="btn-secondary"
              onClick={() => setShowCreateForm(false)}
              disabled={creatingWallet()}
            >
              Cancel
            </button>
            <button
              class="btn-primary"
              onClick={handleCreate}
              disabled={creatingWallet() || !newWalletName().trim()}
            >
              {creatingWallet() ? (
                <>
                  <Spinner size="small" />
                  <span style="margin-left: 0.5rem;">Creating...</span>
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </div>
      </Show>
      <BackupRestore
        isOpen={showBackupRestore()}
        walletName={backupWallet() ?? undefined}
        walletAddress={props.blockchain.allWallets().find(w => w.name === backupWallet())?.address}
        publicKey={props.blockchain.allWallets().find(w => w.name === backupWallet())?.pubkey}
        privateKey={props.blockchain.allWallets().find(w => w.name === backupWallet())?.seckey}
        onBackupComplete={(seedPhrase) => {
          showToast("Wallet backup created successfully!", "success");
        }}
        onRestoreComplete={async (data) => {
          await props.blockchain.importWallet(data.name, data.pubkey, data.seckey);
          showToast("Wallet restored successfully!", "success");
          setShowBackupRestore(false);
          setBackupWallet(null);
        }}
        onClose={() => {
          setShowBackupRestore(false);
          setBackupWallet(null);
        }}
      />
      <PasswordPrompt
        isOpen={showPasswordPrompt()}
        title={passwordAction() === "export" ? "Export Wallet" : "Import Wallet"}
        subtitle={
          passwordAction() === "export"
            ? `Enter password to encrypt and export "${exportingWallet()}"`
            : "Enter password to decrypt and import wallet"
        }
        isConfirm={passwordAction() === "export"}
        onConfirm={async (password) => {
          if (passwordAction() === "export") {
            await handleExportWallet(exportingWallet() || "", password);
          } else {
            await handleImportWallet(password);
          }
        }}
        onCancel={() => {
          setShowPasswordPrompt(false);
          setExportingWallet(null);
        }}
      />
    </div>
  );
}



