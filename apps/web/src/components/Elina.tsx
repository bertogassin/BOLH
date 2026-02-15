import { createSignal, onMount, onCleanup, Show } from 'solid-js';

// ============ Elina State Machine (mirrors Rust core) ============

type ElinaState = 'idle' | 'listening' | 'guiding' | 'happy' | 'alert' | 'secret';

interface ElinaReaction {
  state: ElinaState;
  animation: string;
  scale: number;
  glow: number;
  rotation: number;
  particles: boolean;
  message?: string;
}

// Secret emotion detector
const SECRET_TAP_COUNT = 16;
const MAX_TAP_INTERVAL_MS = 500;

// Color profiles
const COLOR_PROFILES: Record<string, { primary: string; secondary: string; glow: string; name: string }> = {
  pomegranate: { primary: '#C0392B', secondary: '#E74C3C', glow: 'rgba(192, 57, 43, 0.4)', name: 'Гранат' },
  ocean:      { primary: '#2980B9', secondary: '#3498DB', glow: 'rgba(41, 128, 185, 0.4)', name: 'Океан' },
  forest:     { primary: '#27AE60', secondary: '#2ECC71', glow: 'rgba(39, 174, 96, 0.4)', name: 'Лес' },
  sunset:     { primary: '#F39C12', secondary: '#F1C40F', glow: 'rgba(243, 156, 18, 0.4)', name: 'Закат' },
  midnight:   { primary: '#8E44AD', secondary: '#9B59B6', glow: 'rgba(142, 68, 173, 0.4)', name: 'Полночь' },
  snow:       { primary: '#BDC3C7', secondary: '#ECF0F1', glow: 'rgba(236, 240, 241, 0.4)', name: 'Снег' },
};

interface ElinaProps {
  /** Size of Elina in pixels */
  size?: number;
  /** Initial color profile */
  colorProfile?: string;
  /** Show color picker */
  showCustomizer?: boolean;
  /** Callback when Elina reacts */
  onReaction?: (reaction: ElinaReaction) => void;
}

export default function Elina(props: ElinaProps) {
  const size = () => props.size || 80;
  const [state, setState] = createSignal<ElinaState>('idle');
  const [profile, setProfile] = createSignal(props.colorProfile || 'pomegranate');
  const [showPicker, setShowPicker] = createSignal(false);
  const [particles, setParticles] = createSignal<{ id: number; x: number; y: number; color: string }[]>([]);
  const [tapCount, setTapCount] = createSignal(0);
  const [lastTap, setLastTap] = createSignal(0);
  const [secretCount, setSecretCount] = createSignal(0);
  const [message, setMessage] = createSignal<string | null>(null);

  let autoReturnTimer: any = null;
  let particleId = 0;

  const colors = () => COLOR_PROFILES[profile()] || COLOR_PROFILES.pomegranate;

  // Auto-return to idle after animations
  const scheduleReturn = (delay: number) => {
    if (autoReturnTimer) clearTimeout(autoReturnTimer);
    autoReturnTimer = setTimeout(() => {
      setState('idle');
      setMessage(null);
    }, delay);
  };

  // Spawn particles
  const spawnParticles = (count: number) => {
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: ++particleId,
        x: (Math.random() - 0.5) * size() * 1.5,
        y: (Math.random() - 0.5) * size() * 1.5,
        color: Math.random() > 0.5 ? colors().primary : colors().secondary,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  };

  // TAP handler
  const handleTap = () => {
    const now = Date.now();

    // Secret detection
    if (now - lastTap() <= MAX_TAP_INTERVAL_MS) {
      setTapCount(c => c + 1);
    } else {
      setTapCount(1);
    }
    setLastTap(now);

    if (tapCount() >= SECRET_TAP_COUNT - 1) {
      // SECRET EMOTION!
      setState('secret');
      setTapCount(0);
      setSecretCount(c => c + 1);
      setMessage('🔥');
      spawnParticles(20);
      scheduleReturn(4000);
      props.onReaction?.({
        state: 'secret',
        animation: 'secret_flash',
        scale: 1.3,
        glow: 1.0,
        rotation: 360,
        particles: true,
        message: '🔥 Secret emotion unlocked!',
      });
      return;
    }

    // Normal tap — happy
    setState('happy');
    spawnParticles(5);
    scheduleReturn(1200);
    props.onReaction?.({
      state: 'happy',
      animation: 'bounce',
      scale: 1.15,
      glow: 0.5,
      rotation: 0,
      particles: true,
    });
  };

  // Long press handler
  let pressTimer: any = null;
  const handlePressStart = () => {
    pressTimer = setTimeout(() => {
      setState('listening');
      props.onReaction?.({
        state: 'listening',
        animation: 'pulse_glow',
        scale: 1.05,
        glow: 0.6,
        rotation: 0,
        particles: false,
      });
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
    if (state() === 'listening') {
      setState('idle');
    }
  };

  onCleanup(() => {
    if (autoReturnTimer) clearTimeout(autoReturnTimer);
    if (pressTimer) clearTimeout(pressTimer);
  });

  // CSS for the pomegranate octagon shape
  const shapeStyle = () => {
    const s = size();
    const c = colors();
    const currentState = state();

    const scaleMap: Record<ElinaState, number> = {
      idle: 1.0,
      listening: 1.05,
      guiding: 1.0,
      happy: 1.15,
      alert: 1.1,
      secret: 1.3,
    };

    const glowMap: Record<ElinaState, string> = {
      idle: `0 0 ${s * 0.15}px ${c.glow}`,
      listening: `0 0 ${s * 0.4}px ${c.glow}, 0 0 ${s * 0.8}px ${c.glow}`,
      guiding: `0 0 ${s * 0.2}px ${c.glow}`,
      happy: `0 0 ${s * 0.3}px ${c.glow}, 0 0 ${s * 0.5}px ${c.glow}`,
      alert: `0 0 ${s * 0.5}px rgba(231, 76, 60, 0.5)`,
      secret: `0 0 ${s * 0.6}px ${c.glow}, 0 0 ${s}px ${c.glow}, 0 0 ${s * 1.5}px ${c.glow}`,
    };

    return {
      width: `${s}px`,
      height: `${s}px`,
      background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
      'clip-path': 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
      'border-radius': `${s * 0.2}px`,
      'box-shadow': glowMap[currentState],
      transform: `scale(${scaleMap[currentState]})`,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.5s ease',
    };
  };

  // Animation class based on state
  const animClass = () => {
    switch (state()) {
      case 'idle': return 'elina-breathe';
      case 'listening': return 'elina-pulse';
      case 'happy': return 'elina-bounce';
      case 'alert': return 'elina-shake';
      case 'secret': return 'elina-secret';
      case 'guiding': return 'elina-lean';
      default: return 'elina-breathe';
    }
  };

  return (
    <div class="relative inline-flex flex-col items-center select-none" style={{ 'touch-action': 'manipulation' }}>
      {/* Particles */}
      {particles().map(p => (
        <div
          class="absolute rounded-full pointer-events-none elina-particle"
          style={{
            width: '6px',
            height: '6px',
            background: p.color,
            left: `calc(50% + ${p.x}px)`,
            top: `calc(50% + ${p.y}px)`,
          }}
        />
      ))}

      {/* Main shape */}
      <div
        class={`cursor-pointer relative ${animClass()}`}
        style={shapeStyle()}
        onClick={handleTap}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {/* Inner highlight — gives 3D pomegranate feel */}
        <div
          class="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, transparent 60%)',
            'clip-path': 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
          }}
        />
        {/* Face / eyes — subtle, minimalist */}
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ 'padding-top': '2px' }}>
          <Show when={state() === 'secret'}>
            <span class="text-white" style={{ 'font-size': `${size() * 0.35}px` }}>🔥</span>
          </Show>
          <Show when={state() !== 'secret'}>
            <div class="flex items-center gap-1" style={{ 'margin-top': `-${size() * 0.05}px` }}>
              {/* Left eye */}
              <div
                class="rounded-full bg-white"
                style={{
                  width: `${size() * 0.11}px`,
                  height: state() === 'happy' ? `${size() * 0.07}px` : `${size() * 0.11}px`,
                  transition: 'height 0.2s ease',
                  'border-radius': state() === 'happy' ? `${size() * 0.11}px ${size() * 0.11}px 0 0` : '50%',
                }}
              />
              {/* Right eye */}
              <div
                class="rounded-full bg-white"
                style={{
                  width: `${size() * 0.11}px`,
                  height: state() === 'happy' ? `${size() * 0.07}px` : `${size() * 0.11}px`,
                  transition: 'height 0.2s ease',
                  'border-radius': state() === 'happy' ? `${size() * 0.11}px ${size() * 0.11}px 0 0` : '50%',
                  'margin-left': `${size() * 0.08}px`,
                }}
              />
            </div>
          </Show>
        </div>
      </div>

      {/* Message bubble */}
      <Show when={message()}>
        <div
          class="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap elina-fade-in"
          style={{ background: colors().primary }}
        >
          {message()}
        </div>
      </Show>

      {/* Color picker toggle */}
      <Show when={props.showCustomizer}>
        <button
          class="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowPicker(p => !p); }}
        >
          {colors().name}
        </button>

        <Show when={showPicker()}>
          <div class="absolute -bottom-14 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-2xl bg-white shadow-xl border border-gray-100 elina-fade-in z-50">
            {Object.entries(COLOR_PROFILES).map(([key, val]) => (
              <button
                class={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${profile() === key ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
                style={{ background: `linear-gradient(135deg, ${val.primary}, ${val.secondary})` }}
                onClick={(e) => { e.stopPropagation(); setProfile(key); }}
                title={val.name}
              />
            ))}
          </div>
        </Show>
      </Show>

      {/* CSS Animations */}
      <style>{`
        @keyframes elina-breathe-kf {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes elina-bounce-kf {
          0% { transform: scale(1); }
          30% { transform: scale(1.2); }
          50% { transform: scale(0.95); }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes elina-shake-kf {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-3px); }
          30%, 70% { transform: translateX(3px); }
        }
        @keyframes elina-pulse-kf {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes elina-secret-kf {
          0% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.4) rotate(90deg); }
          50% { transform: scale(1.1) rotate(180deg); }
          75% { transform: scale(1.35) rotate(270deg); }
          100% { transform: scale(1) rotate(360deg); }
        }
        @keyframes elina-lean-kf {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes elina-particle-kf {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0) translateY(-20px); opacity: 0; }
        }
        @keyframes elina-fade-in-kf {
          from { opacity: 0; transform: translateX(-50%) translateY(5px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .elina-breathe { animation: elina-breathe-kf 3s ease-in-out infinite; }
        .elina-bounce { animation: elina-bounce-kf 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .elina-shake { animation: elina-shake-kf 0.4s ease-in-out; }
        .elina-pulse { animation: elina-pulse-kf 1.5s ease-in-out infinite; }
        .elina-secret { animation: elina-secret-kf 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .elina-lean { animation: elina-lean-kf 1s ease-in-out infinite; }
        .elina-particle { animation: elina-particle-kf 0.8s ease-out forwards; }
        .elina-fade-in { animation: elina-fade-in-kf 0.3s ease-out; }
      `}</style>
    </div>
  );
}
