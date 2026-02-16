// ═══════════════════════════════════════════════════════════
// BOLH Elina UI — Visual components for the AI assistant
// ═══════════════════════════════════════════════════════════
import { createSignal, Show, For, onMount, onCleanup, createEffect } from 'solid-js';
import { t, currentLang } from './i18n';
import { isDark } from './theme';
import { askElina, addPersonality, createElinaContext, updateContext, type ElinaMessage, type ElinaContext, type ElinaAction } from './elina';
import { playGlobalSound, haptic } from './ui';

// ============== Elina v3 Component (Mobile) ==============
// Two twisted octagons = 16 points, looks like a circle but organic
// Real fire, gas ignition sound, deep pomegranate colors

const ELINA_COLORS: Record<string, { base: string; mid: string; light: string; deep: string; glow: string }> = {
  pomegranate: { base: '#6B1520', mid: '#9B1B30', light: '#D4374B', deep: '#3D0A12', glow: 'rgba(155,27,48,0.5)' },
  ocean:      { base: '#0C3547', mid: '#1A6B8A', light: '#2FA4D4', deep: '#061E2B', glow: 'rgba(26,107,138,0.5)' },
  forest:     { base: '#0B3D1F', mid: '#1B7A3E', light: '#2EC465', deep: '#062210', glow: 'rgba(27,122,62,0.5)' },
  sunset:     { base: '#7A3D08', mid: '#C4620D', light: '#F0A030', deep: '#4A2504', glow: 'rgba(196,98,13,0.5)' },
  midnight:   { base: '#2D1248', mid: '#5B2496', light: '#8B4CD0', deep: '#1A0A2B', glow: 'rgba(91,36,150,0.5)' },
};

// Clean graphic octagon — 8-sided, bold, vector-art look
const OCTAGON_SHAPE = 'polygon(29.3% 0%, 70.7% 0%, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0% 70.7%, 0% 29.3%)';

// WebAudio: gas hiss → ignition → fire roar
function elinaSound(type: 'tap' | 'secret' | 'drag' | 'return') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (type === 'tap') {
      // Soft organic pop
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.06);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }

    if (type === 'secret') {
      // Layer 1: Gas hiss (white noise)
      const bufLen = ctx.sampleRate * 0.4;
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 3000;
      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.15);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      noiseSrc.start(ctx.currentTime);
      noiseSrc.stop(ctx.currentTime + 0.4);

      // Layer 2: Ignition thump (low)
      const thump = ctx.createOscillator();
      const tg = ctx.createGain();
      thump.connect(tg); tg.connect(ctx.destination);
      thump.type = 'sine';
      thump.frequency.setValueAtTime(80, ctx.currentTime + 0.15);
      thump.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
      tg.gain.setValueAtTime(0, ctx.currentTime);
      tg.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.18);
      tg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      thump.start(ctx.currentTime + 0.15);
      thump.stop(ctx.currentTime + 0.6);

      // Layer 3: Fire whoosh (rising filtered noise)
      const fireBuf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
      const fData = fireBuf.getChannelData(0);
      for (let i = 0; i < fData.length; i++) fData[i] = (Math.random() * 2 - 1);
      const fireSrc = ctx.createBufferSource();
      fireSrc.buffer = fireBuf;
      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'bandpass';
      fireFilter.frequency.setValueAtTime(400, ctx.currentTime + 0.2);
      fireFilter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.5);
      fireFilter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.0);
      fireFilter.Q.value = 2;
      const fireGain = ctx.createGain();
      fireSrc.connect(fireFilter);
      fireFilter.connect(fireGain);
      fireGain.connect(ctx.destination);
      fireGain.gain.setValueAtTime(0, ctx.currentTime);
      fireGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.25);
      fireGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.5);
      fireGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      fireSrc.start(ctx.currentTime + 0.2);
      fireSrc.stop(ctx.currentTime + 1.0);

      // Layer 4: Sparkle overtone
      const spark = ctx.createOscillator();
      const sg = ctx.createGain();
      spark.connect(sg); sg.connect(ctx.destination);
      spark.type = 'sine';
      spark.frequency.setValueAtTime(2200, ctx.currentTime + 0.2);
      spark.frequency.exponentialRampToValueAtTime(4400, ctx.currentTime + 0.6);
      sg.gain.setValueAtTime(0.04, ctx.currentTime + 0.2);
      sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      spark.start(ctx.currentTime + 0.2);
      spark.stop(ctx.currentTime + 0.7);
    }

    if (type === 'drag') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 500;
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
    }

    if (type === 'return') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(1000, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.35);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.4);
    }
  } catch (_) { /* AudioContext not available */ }
}

function MobileElina(props: { size?: number }) {
  const sz = () => props.size || 48;
  const [eState, setEState] = createSignal<string>('idle');
  const [tapCnt, setTapCnt] = createSignal(0);
  const [lastTapMs, setLastTapMs] = createSignal(0);
  const [colorKey, setColorKey] = createSignal('pomegranate');
  const [showColors, setShowColors] = createSignal(false);
  const [particles, setParticles] = createSignal<{ id: number; x: number; y: number; size: number; color: string; type: string; delay: number }[]>([]);
  const [screenFlash, setScreenFlash] = createSignal(false);
  const [flames, setFlames] = createSignal(false);

  // Drag state
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragPos, setDragPos] = createSignal<{ x: number; y: number } | null>(null);
  const [isReturning, setIsReturning] = createSignal(false);
  let dragStartX = 0, dragStartY = 0, dragOffsetX = 0, dragOffsetY = 0;
  let returnTimer: any = null;
  let longPressTimer: any = null;
  let pid = 0;

  const c = () => ELINA_COLORS[colorKey()] || ELINA_COLORS.pomegranate;

  // Fire particles — realistic upward movement
  const spawnFire = (n: number) => {
    const fireColors = ['#FF0800', '#FF2400', '#FF4500', '#FF6600', '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#FFF8DC'];
    const np = Array.from({ length: n }, () => {
      const angle = (Math.random() - 0.5) * 1.2; // Mostly upward
      const dist = Math.random() * sz() * 1.5;
      const delay = Math.random() * 300;
      return {
        id: ++pid,
        x: Math.sin(angle) * dist * 0.6,
        y: -Math.abs(Math.cos(angle) * dist) - sz() * 0.3,
        size: 3 + Math.random() * 8,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        type: 'fire',
        delay,
      };
    });
    setParticles(p => [...p, ...np]);
    setTimeout(() => setParticles(p => p.filter(pp => !np.find(x => x.id === pp.id))), 1800);
  };

  const spawnSparks = (n: number) => {
    const np = Array.from({ length: n }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = (Math.random() * 0.5 + 0.5) * sz();
      return {
        id: ++pid,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 2 + Math.random() * 3,
        color: c().light,
        type: 'spark',
        delay: 0,
      };
    });
    setParticles(p => [...p, ...np]);
    setTimeout(() => setParticles(p => p.filter(pp => !np.find(x => x.id === pp.id))), 800);
  };

  const onTap = (e: MouseEvent | TouchEvent) => {
    if (isDragging()) return;

    const now = Date.now();
    if (now - lastTapMs() <= 500) { setTapCnt(x => x + 1); } else { setTapCnt(1); }
    setLastTapMs(now);

    if (tapCnt() >= 15) {
      // === SECRET: GAS IGNITION ===
      setEState('secret');
      setTapCnt(0);
      elinaSound('secret');
      haptic('heavy');
      // Multiple fire waves
      setFlames(true);
      spawnFire(30);
      setTimeout(() => spawnFire(20), 150);
      setTimeout(() => spawnFire(15), 300);
      setTimeout(() => spawnFire(10), 500);
      // Screen flash
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 800);
      setTimeout(() => { setFlames(false); setEState('idle'); }, 4500);
      return;
    }

    // Normal tap
    setEState('happy');
    elinaSound('tap');
    spawnSparks(6);
    haptic('light');
    setTimeout(() => setEState('idle'), 1000);
  };

  // === DRAG & DROP ===
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    longPressTimer = setTimeout(() => {
      setIsDragging(true);
      elinaSound('drag');
      haptic('medium');
      dragOffsetX = 0; dragOffsetY = 0;
    }, 300);
  };

  const onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX;
    const dy = touch.clientY - dragStartY;
    if (!isDragging() && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (longPressTimer) clearTimeout(longPressTimer);
    }
    if (isDragging()) {
      e.preventDefault();
      dragOffsetX = dx; dragOffsetY = dy;
      setDragPos({ x: dx, y: dy });
      if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }
    }
  };

  const onTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    if (isDragging()) {
      setIsDragging(false);
      if (Math.abs(dragOffsetX) > 10 || Math.abs(dragOffsetY) > 10) {
        returnTimer = setTimeout(() => {
          setIsReturning(true);
          elinaSound('return');
          haptic('light');
          setTimeout(() => { setDragPos(null); setIsReturning(false); }, 50);
        }, 30000);
      } else { setDragPos(null); }
    }
  };

  const onShapeLongPress = () => { setShowColors(s => !s); haptic('light'); };

  const animCls = () => {
    if (isReturning()) return '';
    switch (eState()) {
      case 'happy': return 'el3-bounce';
      case 'secret': return 'el3-secret';
      default: return 'el3-breathe';
    }
  };

  const glowShadow = () => {
    const g = c().glow;
    if (eState() === 'secret') return `0 0 ${sz()}px ${g}, 0 0 ${sz() * 2}px rgba(255,69,0,0.4), 0 0 ${sz() * 3}px rgba(255,140,0,0.2)`;
    if (eState() === 'happy') return `0 0 ${sz() * 0.4}px ${g}`;
    if (isDragging()) return `0 0 ${sz() * 0.5}px ${g}, 0 4px 15px rgba(0,0,0,0.25)`;
    return `0 0 ${sz() * 0.15}px ${g}`;
  };

  const scaleVal = () => {
    if (isDragging()) return 1.2;
    if (eState() === 'secret') return 1.35;
    if (eState() === 'happy') return 1.12;
    return 1;
  };

  const posStyle = () => {
    const dp = dragPos();
    if (!dp) return {};
    return {
      transform: `translate(${dp.x}px, ${dp.y}px)`,
      transition: isReturning() ? 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
      'z-index': '999',
    };
  };

  onCleanup(() => {
    if (returnTimer) clearTimeout(returnTimer);
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  return (
    <div
      class="relative inline-flex items-center justify-center"
      style={{ width: `${sz() * 1.2}px`, height: `${sz() * 1.2}px`, 'touch-action': isDragging() ? 'none' : 'auto', ...posStyle() }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Screen flash — fire glow */}
      <Show when={screenFlash()}>
        <div class="fixed inset-0 pointer-events-none z-[9999] el3-flash" style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(255,100,0,0.5) 0%, rgba(255,50,0,0.2) 40%, transparent 70%)',
        }} />
      </Show>

      {/* CSS Flame effect on secret */}
      <Show when={flames()}>
        <div class="absolute pointer-events-none el3-flame-container" style={{
          width: `${sz() * 1.2}px`, height: `${sz() * 2}px`,
          bottom: `${sz() * 0.3}px`, left: '50%', transform: 'translateX(-50%)',
        }}>
          <div class="el3-flame el3-flame-1" style={{ background: 'linear-gradient(to top, #FF4500, #FF8C00, #FFD700, transparent)', width: `${sz() * 0.5}px`, height: `${sz() * 1.5}px` }} />
          <div class="el3-flame el3-flame-2" style={{ background: 'linear-gradient(to top, #FF0000, #FF4500, #FFA500, transparent)', width: `${sz() * 0.35}px`, height: `${sz() * 1.2}px` }} />
          <div class="el3-flame el3-flame-3" style={{ background: 'linear-gradient(to top, #FF6600, #FFD700, #FFFF00, transparent)', width: `${sz() * 0.25}px`, height: `${sz() * 1.0}px` }} />
        </div>
      </Show>

      {/* Particles */}
      {particles().map(p => (
        <div
          class={`absolute pointer-events-none ${p.type === 'fire' ? 'el3-fire-p' : 'el3-spark-p'}`}
          style={{
            width: `${p.size}px`, height: `${p.size}px`,
            background: p.color,
            left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)`,
            'border-radius': p.type === 'fire' ? '50% 50% 50% 20%' : '50%',
            filter: p.type === 'fire' ? `blur(${p.size * 0.3}px)` : 'none',
            'animation-delay': `${p.delay}ms`,
          }}
        />
      ))}

      {/* === 2D ILLUSTRATED OCTAGON — cartoon/vector-art style === */}
      <div class={`cursor-pointer relative ${animCls()}`} style={{
        width: `${sz()}px`, height: `${sz()}px`,
        transform: `scale(${scaleVal()})`,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        filter: `drop-shadow(${glowShadow()})`,
      }} onClick={onTap} onDblClick={onShapeLongPress}>

        {/* Thick cartoon outline */}
        <div class="absolute" style={{
          inset: `-${Math.max(sz() * 0.04, 2)}px`,
          'clip-path': OCTAGON_SHAPE,
          background: c().deep,
        }} />

        {/* Main body — flat 2D fill with subtle gradient */}
        <div class="absolute inset-0" style={{
          'clip-path': OCTAGON_SHAPE,
          background: `linear-gradient(160deg, ${c().light} 0%, ${c().mid} 45%, ${c().base} 100%)`,
        }}>
          {/* 2D cell-shading — hard light/shadow split */}
          <div class="absolute inset-0" style={{
            background: `linear-gradient(145deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 50%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.3) 100%)`,
            'clip-path': OCTAGON_SHAPE,
          }} />

          {/* Specular highlight — cartoon shine spot */}
          <div class="absolute" style={{
            top: `${sz() * 0.12}px`, left: `${sz() * 0.15}px`,
            width: `${sz() * 0.25}px`, height: `${sz() * 0.18}px`,
            background: 'rgba(255,255,255,0.45)',
            'border-radius': '50%',
            transform: 'rotate(-25deg)',
            filter: `blur(${sz() * 0.02}px)`,
          }} />

          {/* Small secondary shine */}
          <div class="absolute" style={{
            top: `${sz() * 0.22}px`, left: `${sz() * 0.55}px`,
            width: `${sz() * 0.08}px`, height: `${sz() * 0.06}px`,
            background: 'rgba(255,255,255,0.3)',
            'border-radius': '50%',
          }} />
        </div>

        {/* Face — 2D illustrated style */}
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ 'z-index': '5' }}>
          {eState() === 'secret'
            ? <span style={{ 'font-size': `${sz() * 0.4}px`, filter: 'drop-shadow(0 0 8px rgba(255,80,0,0.9)) drop-shadow(0 0 16px rgba(255,140,0,0.5))' }}>{'\u{1F525}'}</span>
            : <>
              {/* Eyes */}
              <div class="flex items-center" style={{ gap: `${sz() * 0.14}px`, 'margin-top': `-${sz() * 0.04}px` }}>
                {/* Left eye */}
                <div style={{
                  width: `${sz() * 0.15}px`,
                  height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.15}px`,
                  background: eState() === 'happy' ? 'transparent' : 'white',
                  'border-radius': eState() === 'happy' ? '0' : '50%',
                  'border-bottom': eState() === 'happy' ? `${Math.max(sz() * 0.03, 1.5)}px solid ${c().deep}` : 'none',
                  border: eState() === 'happy' ? 'none' : `${Math.max(sz() * 0.02, 1)}px solid ${c().deep}`,
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  <Show when={eState() !== 'happy'}>
                    {/* Pupil */}
                    <div style={{
                      width: `${sz() * 0.07}px`, height: `${sz() * 0.07}px`,
                      background: c().deep,
                      'border-radius': '50%',
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      {/* Pupil highlight */}
                      <div style={{
                        width: `${sz() * 0.025}px`, height: `${sz() * 0.025}px`,
                        background: 'white',
                        'border-radius': '50%',
                        position: 'absolute',
                        top: `${sz() * 0.01}px`, right: `${sz() * 0.01}px`,
                      }} />
                    </div>
                  </Show>
                </div>
                {/* Right eye */}
                <div style={{
                  width: `${sz() * 0.15}px`,
                  height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.15}px`,
                  background: eState() === 'happy' ? 'transparent' : 'white',
                  'border-radius': eState() === 'happy' ? '0' : '50%',
                  'border-bottom': eState() === 'happy' ? `${Math.max(sz() * 0.03, 1.5)}px solid ${c().deep}` : 'none',
                  border: eState() === 'happy' ? 'none' : `${Math.max(sz() * 0.02, 1)}px solid ${c().deep}`,
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  <Show when={eState() !== 'happy'}>
                    <div style={{
                      width: `${sz() * 0.07}px`, height: `${sz() * 0.07}px`,
                      background: c().deep,
                      'border-radius': '50%',
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      <div style={{
                        width: `${sz() * 0.025}px`, height: `${sz() * 0.025}px`,
                        background: 'white',
                        'border-radius': '50%',
                        position: 'absolute',
                        top: `${sz() * 0.01}px`, right: `${sz() * 0.01}px`,
                      }} />
                    </div>
                  </Show>
                </div>
              </div>

              {/* Blush spots */}
              <div class="absolute flex" style={{
                gap: `${sz() * 0.32}px`,
                top: `${sz() * 0.52}px`,
              }}>
                <div style={{
                  width: `${sz() * 0.09}px`, height: `${sz() * 0.05}px`,
                  background: `${c().light}55`,
                  'border-radius': '50%',
                }} />
                <div style={{
                  width: `${sz() * 0.09}px`, height: `${sz() * 0.05}px`,
                  background: `${c().light}55`,
                  'border-radius': '50%',
                }} />
              </div>

              {/* Mouth */}
              <div style={{
                'margin-top': `${sz() * 0.03}px`,
                width: eState() === 'happy' ? `${sz() * 0.12}px` : `${sz() * 0.06}px`,
                height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.03}px`,
                background: 'transparent',
                'border-bottom': `${Math.max(sz() * 0.025, 1.5)}px solid ${c().deep}`,
                'border-radius': eState() === 'happy' ? '0 0 50% 50%' : '0 0 50% 50%',
                transition: 'all 0.2s ease',
              }} />

              {/* BOLH brand text */}
              <span style={{
                'margin-top': `${sz() * 0.02}px`,
                'font-size': `${Math.max(sz() * 0.1, 5)}px`,
                'font-weight': '900',
                'letter-spacing': `${sz() * 0.02}px`,
                color: 'rgba(255,255,255,0.85)',
                'text-shadow': `0 0 ${sz() * 0.06}px ${c().glow}, 0 ${sz() * 0.01}px ${sz() * 0.02}px rgba(0,0,0,0.5)`,
                'font-family': "'SF Pro Display', 'Inter', system-ui, sans-serif",
                'line-height': '1',
              }}>BOLH</span>
            </>
          }
        </div>
      </div>

      {/* Color picker */}
      <Show when={showColors()}>
        <div class="absolute flex gap-1.5 p-2 rounded-2xl bg-black/70 shadow-xl el3-fade z-50"
          style={{ bottom: `-${sz() * 0.55}px`, left: '50%', transform: 'translateX(-50%)' }}>
          {Object.entries(ELINA_COLORS).map(([key, val]) => (
            <button
              class={`rounded-full transition-all active:scale-90 ${colorKey() === key ? 'ring-2 ring-white scale-110' : ''}`}
              style={{
                width: `${Math.max(sz() * 0.38, 22)}px`, height: `${Math.max(sz() * 0.38, 22)}px`,
                background: `linear-gradient(135deg, ${val.base}, ${val.light})`,
              }}
              onClick={(e) => { e.stopPropagation(); setColorKey(key); haptic('light'); }}
            />
          ))}
        </div>
      </Show>

      <Show when={isDragging()}>
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-white/90 whitespace-nowrap">drag me</div>
      </Show>

      <style>{`
        @keyframes el3-breathe-kf { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes el3-bounce-kf { 0%{transform:scale(1)} 25%{transform:scale(1.18)} 50%{transform:scale(0.96)} 75%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes el3-secret-kf { 0%{transform:scale(1) rotate(0)} 15%{transform:scale(1.5) rotate(60deg)} 30%{transform:scale(1.1) rotate(120deg)} 45%{transform:scale(1.45) rotate(180deg)} 60%{transform:scale(1.05) rotate(240deg)} 75%{transform:scale(1.4) rotate(300deg)} 100%{transform:scale(1) rotate(360deg)} }
        @keyframes el3-fire-kf { 0%{opacity:1;transform:scale(1) translateY(0)} 40%{opacity:0.9} 100%{opacity:0;transform:scale(0.2) translateY(-40px)} }
        @keyframes el3-spark-kf { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0) translateY(-15px)} }
        @keyframes el3-flash-kf { 0%{opacity:0.7} 100%{opacity:0} }
        @keyframes el3-fade-kf { from{opacity:0;transform:translateX(-50%) scale(0.9)} to{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes el3-flame-kf {
          0%{transform:translateX(-50%) scaleY(0.3) scaleX(1);opacity:0}
          15%{transform:translateX(-50%) scaleY(1.1) scaleX(0.9);opacity:1}
          30%{transform:translateX(-48%) scaleY(0.95) scaleX(1.1);opacity:0.9}
          50%{transform:translateX(-52%) scaleY(1.05) scaleX(0.85);opacity:0.85}
          70%{transform:translateX(-50%) scaleY(0.9) scaleX(1.05);opacity:0.7}
          100%{transform:translateX(-50%) scaleY(0.3) scaleX(0.5);opacity:0}
        }
        .el3-breathe{animation:el3-breathe-kf 3s ease-in-out infinite}
        .el3-bounce{animation:el3-bounce-kf 0.45s cubic-bezier(0.34,1.56,0.64,1)}
        .el3-secret{animation:el3-secret-kf 1s cubic-bezier(0.22,1,0.36,1)}
        .el3-fire-p{animation:el3-fire-kf 1.2s ease-out forwards}
        .el3-spark-p{animation:el3-spark-kf 0.6s ease-out forwards}
        .el3-flash{animation:el3-flash-kf 0.8s ease-out forwards}
        .el3-fade{animation:el3-fade-kf 0.2s ease-out}
        .el3-flame-container{position:relative;pointer-events:none}
        .el3-flame{position:absolute;bottom:0;left:50%;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;
          animation:el3-flame-kf 1.5s ease-in-out forwards;transform-origin:bottom center;filter:blur(2px)}
        .el3-flame-1{animation-delay:0.05s}
        .el3-flame-2{animation-delay:0.15s}
        .el3-flame-3{animation-delay:0.25s}
      `}</style>
    </div>
  );
}

// ============== Elina Chat (powered by engine) ==============

import { getElinaEngine } from './elina/engine';

interface ChatMessage {
  id: number;
  from: 'user' | 'elina';
  text: string;
  time: string;
}

const elinaEngine = getElinaEngine();

function ElinaChatPanel(props: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputVal, setInputVal] = createSignal('');
  const [typing, setTyping] = createSignal(false);
  let chatEndRef: HTMLDivElement | undefined;
  let msgId = 0;

  const now = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Send greeting when chat first opens
  createEffect(() => {
    if (props.open && messages().length === 0) {
      elinaEngine.updateContext({ language: getCurrentLanguage().code as 'ru' | 'en' });
      setTimeout(() => {
        setMessages([{
          id: ++msgId,
          from: 'elina',
          text: elinaEngine.getGreeting(),
          time: now(),
        }]);
      }, 400);
    }
  });

  // Auto scroll
  createEffect(() => {
    if (messages().length > 0 && chatEndRef) {
      setTimeout(() => chatEndRef?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  });

  const sendMessage = () => {
    const text = inputVal().trim();
    if (!text) return;
    setInputVal('');

    // Add user message
    setMessages(prev => [...prev, { id: ++msgId, from: 'user', text, time: now() }]);

    // Elina "typing" then responds via engine
    setTyping(true);
    elinaEngine.updateContext({ language: getCurrentLanguage().code as 'ru' | 'en' });
    const delay = 500 + Math.random() * 800;
    setTimeout(async () => {
      const response = await elinaEngine.processMessage(text);
      setTyping(false);
      setMessages(prev => [...prev, { id: ++msgId, from: 'elina', text: response.text, time: now() }]);
      haptic('light');
    }, delay);
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[9998] flex flex-col" style="background: rgba(0,0,0,0.95);">
        {/* Header */}
        <div class="flex items-center gap-3 p-4 border-b border-white/10">
          <MobileElina size={36} />
          <div class="flex-1">
            <p class="text-white font-bold text-lg">Elina</p>
            <p class="text-white/90 text-xs">{typing() ? (getCurrentLanguage().code === 'en' ? 'typing...' : 'печатает...') : 'BOLH Assistant'}</p>
          </div>
          <button
            class="w-9 h-9 rounded-full glass flex items-center justify-center text-white/85 touch-scale"
            onClick={props.onClose}
          >
            <Icon name="x" class="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <For each={messages()}>
            {(msg) => (
              <div class={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div class={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.from === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-md'
                    : 'bg-white/10 text-white/90 rounded-bl-md'
                }`}>
                  <p class="text-sm whitespace-pre-line">{msg.text}</p>
                  <p class={`text-[10px] mt-1 ${msg.from === 'user' ? 'text-white/90 text-right' : 'text-white/85'}`}>{msg.time}</p>
                </div>
              </div>
            )}
          </For>

          {/* Typing indicator */}
          <Show when={typing()}>
            <div class="flex justify-start">
              <div class="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                <div class="w-2 h-2 bg-white/40 rounded-full animate-bounce" style="animation-delay: 0ms" />
                <div class="w-2 h-2 bg-white/40 rounded-full animate-bounce" style="animation-delay: 150ms" />
                <div class="w-2 h-2 bg-white/40 rounded-full animate-bounce" style="animation-delay: 300ms" />
              </div>
            </div>
          </Show>

          <div ref={chatEndRef} />
        </div>

        {/* Quick suggestions */}
        <Show when={messages().length <= 2}>
          <div class="px-4 pb-2 flex flex-wrap gap-2">
            {[
              getCurrentLanguage().code === 'en' ? 'How to earn?' : 'Как заработать?',
              getCurrentLanguage().code === 'en' ? 'What is blockchain?' : 'Что такое блокчейн?',
              getCurrentLanguage().code === 'en' ? 'How to invite friends?' : 'Как пригласить друзей?',
              getCurrentLanguage().code === 'en' ? 'Help' : 'Помощь',
            ].map(q => (
              <button
                class="px-3 py-1.5 rounded-full bg-white/10 text-white/85 text-xs touch-scale hover:bg-white/20 transition-colors"
                onClick={() => { setInputVal(q); sendMessage(); }}
              >
                {q}
              </button>
            ))}
          </div>
        </Show>

        {/* Input */}
        <div class="p-4 border-t border-white/10">
          <div class="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2">
            <input
              type="text"
              class="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
              placeholder={getCurrentLanguage().code === 'en' ? 'Ask Elina...' : 'Спроси Элину...'}
              value={inputVal()}
              onInput={(e) => setInputVal(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            />
            <button
              class={`w-8 h-8 rounded-full flex items-center justify-center touch-scale transition-colors ${inputVal().trim() ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/85'}`}
              onClick={sendMessage}
              disabled={!inputVal().trim()}
            >
              <Icon name="send" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============== Pages ==============

export { MobileElina, ElinaChatPanel };
