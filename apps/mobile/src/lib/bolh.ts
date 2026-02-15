// Simple TypeScript shim for BOLH SDK used by the mobile app demo.
// In production this should load native bindings (Tauri/Rust cdylib or platform-specific bridge).

type EventHandler = (payload: any) => void;

const listeners: Record<string, EventHandler[]> = {};

const bolh = {
  async init(_config: { network?: string } = {}) {
    // Try to detect native binding (example: window.__bolh_native)
    // For PoC we return ok.
    return 'ok';
  },

  wallet: {
    async createKey() {
      return { pubkey: 'BOLH_DEMO_PUBKEY_abc123' };
    },
    async sign(tx: string) {
      // Fake signature for demo
      return `signed(${btoa(tx)})`;
    },
    async exportViewKey(_address: string) {
      return 'DEMO_VIEW_KEY';
    }
  },

  chain: {
    async getBalance(_address: string) {
      return 1000; // demo balance
    },
    async submitTx(_signed: string) {
      return { txid: 'demo-txid-123' };
    },
    async getTxs(_address: string, _opts?: any) {
      return [];
    }
  },

  privacy: {
    async createPrivateTx(_params: any) {
      return 'demo-private-payload';
    },
    async reveal(_txId: string, _viewKey: string) {
      return { revealed: true };
    }
  },

  events: {
    on(event: string, handler: EventHandler) {
      listeners[event] ||= [];
      listeners[event].push(handler);
    },
    emit(event: string, payload: any) {
      (listeners[event] || []).forEach(h => h(payload));
    }
  }
};

// Expose to window for demo pages
declare global { interface Window { bolh?: typeof bolh } }
window.bolh = window.bolh || bolh;

export default bolh;
