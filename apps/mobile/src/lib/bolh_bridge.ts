import shim from './bolh';

const hasTauri = typeof (window as any).__TAURI__ !== 'undefined' && typeof (window as any).__TAURI__.invoke === 'function';

async function invokeOrThrow(cmd: string, args?: any) {
  if (!hasTauri) throw new Error('tauri-invoke-not-available');
  // use window.__TAURI__.invoke to avoid bundling @tauri-apps/api here
  return (window as any).__TAURI__.invoke(cmd, args || {});
}

const bolh = {
  async init(cfg?: any) {
    if (hasTauri) return invokeOrThrow('bolh_init');
    return shim.init(cfg);
  },
  wallet: {
    async createKey() {
      if (hasTauri) return invokeOrThrow('bolh_create_key');
      return shim.wallet.createKey();
    },
    async sign(tx: string) {
      if (hasTauri) return invokeOrThrow('bolh_sign_tx', { tx });
      return shim.wallet.sign(tx);
    },
    async exportViewKey(address: string) {
      if (hasTauri) return invokeOrThrow('bolh_export_view_key', { address });
      return shim.wallet.exportViewKey(address);
    }
  },
  chain: {
    async getBalance(address: string) {
      if (hasTauri) return invokeOrThrow('bolh_get_balance', { address });
      return shim.chain.getBalance(address);
    },
    async submitTx(signed: string) {
      if (hasTauri) return invokeOrThrow('bolh_submit_tx', { signed });
      return shim.chain.submitTx(signed);
    },
    async getTxs(address: string, opts?: any) {
      if (hasTauri) return invokeOrThrow('bolh_get_txs', { address, opts });
      return shim.chain.getTxs(address, opts);
    }
  },
  privacy: {
    async createPrivateTx(p: any) {
      if (hasTauri) return invokeOrThrow('bolh_create_private_tx', { p });
      return shim.privacy.createPrivateTx(p);
    },
    async reveal(txId: string, viewKey: string) {
      if (hasTauri) return invokeOrThrow('bolh_reveal', { txId, viewKey });
      return shim.privacy.reveal(txId, viewKey);
    }
  },
  events: {
    on(event: string, handler: (p: any) => void) {
      // Tauri event system more complex; for PoC just use shim listeners
      shim.events.on(event, handler);
    }
  }
};

export default bolh;
