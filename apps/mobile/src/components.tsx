// ═══════════════════════════════════════════════════════════
// Placeholder / stub components — TO BE IMPLEMENTED
// ═══════════════════════════════════════════════════════════

/** Blockchain wallet screen — placeholder */
export function BlockchainScreen(props: { onBack: () => void }) {
  return (
    <div class="flex flex-col items-center justify-center h-full gap-4 text-white/60 p-8">
      <span class="text-4xl">⛓️</span>
      <span class="text-lg font-semibold">Blockchain</span>
      <span class="text-sm text-center">Coming soon — blockchain wallet integration</span>
      <button
        class="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm"
        onClick={() => props.onBack()}
      >
        ← Back
      </button>
    </div>
  );
}
