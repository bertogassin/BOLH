import { createSignal, onMount } from 'solid-js';
import bolh from '../lib/bolh_bridge';

export default function BolchIntegrationDemo() {
  const [balance, setBalance] = createSignal<number | null>(null);
  const [status, setStatus] = createSignal('idle');

  onMount(() => {
    let mounted = true;
    async function init() {
      setStatus('initializing');
      try {
        await bolh.init({ network: 'testnet' });
        const b = await bolh.chain.getBalance('my-address');
        if (mounted) setBalance(b as number);
        bolh.events.on('txConfirmed', (p: any) => {
          console.log('txConfirmed', p);
        });
        setStatus('ready');
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    }
    init();
    return () => { mounted = false; };
  });

  const sendExample = async () => {
    setStatus('signing');
    const tx = { to: 'addr2', amount: 1 };
    const signed = await bolh.wallet.sign(JSON.stringify(tx));
    setStatus('submitting');
    const res = await bolh.chain.submitTx(signed);
    console.log('submitted', res);
    setStatus('submitted');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>BOLH Integration Demo</h2>
      <p>Status: {status()}</p>
      <p>Balance: {balance() !== null ? balance() : '—'}</p>
      <button onClick={sendExample} disabled={status() !== 'ready'}>
        Send 1 BOLH (demo)
      </button>
      <div style={{ 'margin-top': '20px' }}>
        <strong>Integration notes:</strong>
        <ul>
          <li>SDK exposed as `window.bolh` or via Tauri bridge. In production use native bindings.</li>
          <li>Key operations: `wallet.createKey`, `wallet.sign`.</li>
          <li>Chain ops: `chain.getBalance`, `chain.submitTx`, `events.on`.</li>
        </ul>
      </div>
    </div>
  );
}
