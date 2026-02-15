import { createSignal, For, Show, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import { t, setLanguage, getLanguages, getCurrentLanguage, isRTL, currentLang } from '../i18n';
import { theme, setTheme, isDark, activeTheme } from '../theme';
import { departments, getDepartment, getDepartmentSkills, getSkillGroups, type Department, type SkillGroup } from '../departments';
import { getDailyLesson, lessonTypeLabel, levelLabel } from '../english_learn';
import { BlockchainScreen } from '../components';
import { askElina, addPersonality, createElinaContext, updateContext, type ElinaMessage, type ElinaContext, type ElinaAction } from '../elina';
import { toasts, dismissToast, showToast, notify, requestNotificationPermission, startDemoNotifications, unreadCount, type AppNotification } from '../notifications';
import { balance, frozenBalance, cards, transactions, escrows, deposit, withdraw, payForOrder, releaseEscrow, refundEscrow, addCard, removeCard, setDefaultCard, getStats, type PaymentCard, type Transaction } from '../payments';
import {
  tauriCoreInvoke,
  activeDepartment, setActiveDepartment,
  workerSkills, setWorkerSkills,
  verifiedDiplomas, setVerifiedDiplomas,
  workerStatus, setWorkerStatus,
  busyUntil, setBusyUntil,
  autoOnlineTime, setAutoOnlineTime,
  profileMode, setProfileMode,
  clientNeeds, setClientNeeds,
  homeMode, setHomeMode,
  homeExpandedDept, setHomeExpandedDept,
  homeExpandedGroup, setHomeExpandedGroup,
  homeExpandedSkill, setHomeExpandedSkill,
  getActiveDept,
  pinnedDepts, setPinnedDepts, togglePin,
  initLikes, getLikeCount, hasLiked, likeOnce,
  authUser, setAuthUser, saveAuth, clearAuth, loadAuth, isAuthenticated,
  registerUser,
  type AuthUser,
} from '../store';
import { Icon, SkillIcon, Icons, EMOJI_TO_ICON, type NotifType } from '../ui';
import { LikeBadge, SwipeLayer, SwipeBack, playGlobalSound, haptic, hapticOrder, globalSoundEnabled, setGlobalSoundEnabled, globalHapticEnabled, setGlobalHapticEnabled, globalNotifSound, setGlobalNotifSound, globalVolume, setGlobalVolume, vibrationIntensity, setVibrationIntensity, rareEscalationEnabled, setRareEscalationEnabled } from '../ui';
import { MobileElina, ElinaChatPanel } from '../elina-ui';

const countryCodes = [
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+7', flag: '🇰🇿', name: 'Kazakhstan' },
  { code: '+998', flag: '🇺🇿', name: 'Uzbekistan' },
  { code: '+996', flag: '🇰🇬', name: 'Kyrgyzstan' },
  { code: '+992', flag: '🇹🇯', name: 'Tajikistan' },
  { code: '+993', flag: '🇹🇲', name: 'Turkmenistan' },
  { code: '+994', flag: '🇦🇿', name: 'Azerbaijan' },
  { code: '+995', flag: '🇬🇪', name: 'Georgia' },
  { code: '+374', flag: '🇦🇲', name: 'Armenia' },
  { code: '+380', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+375', flag: '🇧🇾', name: 'Belarus' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
];

export default function AuthPage(props: { onComplete: () => void }) {
  const [step, setStep] = createSignal(1); // 1=welcome, 2=phone, 3=sms, 4=profile, 5=done
  const [countryIdx, setCountryIdx] = createSignal(0);
  const [phone, setPhone] = createSignal('');
  const [showCountries, setShowCountries] = createSignal(false);
  const [code, setCode] = createSignal(['', '', '', '']);
  const [codeError, setCodeError] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [resendTimer, setResendTimer] = createSignal(0);
  const [userName, setUserName] = createSignal('');
  const [userRole, setUserRole] = createSignal<'client' | 'worker'>('client');
  const [doneAnim, setDoneAnim] = createSignal(false);

  // Auto-generated "verification code" for demo
  const [generatedCode] = createSignal(String(Math.floor(1000 + Math.random() * 9000)));

  // Resend timer countdown
  let timerRef: any;
  const startResendTimer = () => {
    setResendTimer(30);
    timerRef = setInterval(() => {
      setResendTimer(v => {
        if (v <= 1) { clearInterval(timerRef); return 0; }
        return v - 1;
      });
    }, 1000);
  };
  onCleanup(() => clearInterval(timerRef));

  // Format phone for display
  const fullPhone = () => countryCodes[countryIdx()].code + ' ' + phone();

  // Handle SMS code input
  const handleCodeInput = (idx: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    if (!/^\d*$/.test(val)) return;
    const newCode = [...code()];
    newCode[idx] = val;
    setCode(newCode);
    setCodeError(false);
    // Auto-focus next input
    if (val && idx < 3) {
      const next = document.getElementById(`sms-${idx + 1}`);
      if (next) (next as HTMLInputElement).focus();
    }
    // Auto-verify when all 4 digits entered
    if (newCode.every(d => d !== '')) {
      const entered = newCode.join('');
      // Accept any 4-digit code for demo, or check generated code
      setTimeout(() => {
        if (entered.length === 4) {
          setStep(4);
        }
      }, 500);
    }
  };

  // Handle code backspace
  const handleCodeKeyDown = (idx: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !code()[idx] && idx > 0) {
      const prev = document.getElementById(`sms-${idx - 1}`);
      if (prev) (prev as HTMLInputElement).focus();
    }
  };

  // Send SMS (mock)
  const handleSendSMS = () => {
    if (phone().length < 5) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setStep(3);
      startResendTimer();
      // Focus first code input
      setTimeout(() => {
        const first = document.getElementById('sms-0');
        if (first) (first as HTMLInputElement).focus();
      }, 300);
    }, 1200);
  };

  // Complete profile — registers via API with localStorage fallback
  const handleComplete = async () => {
    if (!userName().trim()) return;
    setProfileMode(userRole());
    setStep(5);
    setDoneAnim(true);

    try {
      // Try to register via real backend API
      await registerUser({
        phone: countryCodes[countryIdx()].code + phone(),
        password: phone(), // Use phone as default password for now (will be replaced with real password field)
        name: userName().trim(),
        role: userRole(),
      });
    } catch (e) {
      // Fallback: save locally if backend is unavailable
      console.warn('API registration failed, saving locally:', e);
      const user: AuthUser = {
        phone: countryCodes[countryIdx()].code + phone(),
        name: userName().trim(),
        role: userRole(),
        createdAt: new Date().toISOString(),
      };
      saveAuth(user);
      setAuthUser(user);
    }

    setTimeout(() => props.onComplete(), 2000);
  };

  // Welcome screen localized texts
  const [showLangPicker, setShowLangPicker] = createSignal(false);
  const welcomeTexts: Record<string, { subtitle: string; feat1: string; feat1sub: string; feat2: string; feat2sub: string; feat3: string; feat3sub: string; getStarted: string; signIn: string; already: string; terms: string }> = {
    en: { subtitle: 'Professional Services Platform', feat1: 'Find Professionals', feat1sub: 'Thousands of verified experts nearby', feat2: 'Offer Your Skills', feat2sub: 'Become a pro, earn on your terms', feat3: 'Safe & Secure', feat3sub: 'Verified profiles, secure payments', getStarted: 'Get Started', signIn: 'Sign in', already: 'Already have an account?', terms: 'By continuing, you agree to our Terms of Service and Privacy Policy' },
    ru: { subtitle: 'Платформа профессиональных услуг', feat1: 'Найти специалиста', feat1sub: 'Тысячи проверенных экспертов рядом', feat2: 'Предложить свои навыки', feat2sub: 'Стань профессионалом, зарабатывай', feat3: 'Безопасность', feat3sub: 'Проверенные профили, безопасные платежи', getStarted: 'Начать', signIn: 'Войти', already: 'Уже есть аккаунт?', terms: 'Продолжая, вы соглашаетесь с Условиями и Политикой конфиденциальности' },
    fr: { subtitle: 'Plateforme de services professionnels', feat1: 'Trouver des pros', feat1sub: 'Des milliers d\'experts vérifiés à proximité', feat2: 'Offrir vos compétences', feat2sub: 'Devenez pro, gagnez à vos conditions', feat3: 'Sûr et sécurisé', feat3sub: 'Profils vérifiés, paiements sécurisés', getStarted: 'Commencer', signIn: 'Se connecter', already: 'Vous avez déjà un compte?', terms: 'En continuant, vous acceptez nos Conditions et Politique de confidentialité' },
    es: { subtitle: 'Plataforma de servicios profesionales', feat1: 'Encontrar profesionales', feat1sub: 'Miles de expertos verificados cerca', feat2: 'Ofrecer tus habilidades', feat2sub: 'Sé profesional, gana a tu manera', feat3: 'Seguro y protegido', feat3sub: 'Perfiles verificados, pagos seguros', getStarted: 'Comenzar', signIn: 'Iniciar sesión', already: '¿Ya tienes una cuenta?', terms: 'Al continuar, aceptas nuestros Términos y Política de privacidad' },
    de: { subtitle: 'Plattform für professionelle Dienstleistungen', feat1: 'Profis finden', feat1sub: 'Tausende verifizierte Experten in der Nähe', feat2: 'Fähigkeiten anbieten', feat2sub: 'Werde Profi, verdiene nach deinen Regeln', feat3: 'Sicher & geschützt', feat3sub: 'Verifizierte Profile, sichere Zahlungen', getStarted: 'Loslegen', signIn: 'Anmelden', already: 'Bereits ein Konto?', terms: 'Durch Fortfahren stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu' },
    ar: { subtitle: 'منصة الخدمات المهنية', feat1: 'ابحث عن محترفين', feat1sub: 'آلاف الخبراء الموثوقين بالقرب منك', feat2: 'اعرض مهاراتك', feat2sub: 'كن محترفاً واكسب بشروطك', feat3: 'آمن ومحمي', feat3sub: 'ملفات موثقة، مدفوعات آمنة', getStarted: 'ابدأ الآن', signIn: 'تسجيل الدخول', already: 'لديك حساب بالفعل؟', terms: 'بالمتابعة، أنت توافق على شروط الخدمة وسياسة الخصوصية' },
    zh: { subtitle: '专业服务平台', feat1: '寻找专业人士', feat1sub: '数千名经过验证的专家在你附近', feat2: '展示你的技能', feat2sub: '成为专业人士，按你的方式赚钱', feat3: '安全可靠', feat3sub: '经过验证的资料，安全的支付', getStarted: '开始使用', signIn: '登录', already: '已有账号？', terms: '继续即表示您同意我们的服务条款和隐私政策' },
    tr: { subtitle: 'Profesyonel Hizmetler Platformu', feat1: 'Profesyonel Bul', feat1sub: 'Yakınındaki binlerce doğrulanmış uzman', feat2: 'Yeteneklerini Sun', feat2sub: 'Profesyonel ol, kendi şartlarınla kazan', feat3: 'Güvenli & Korumalı', feat3sub: 'Doğrulanmış profiller, güvenli ödemeler', getStarted: 'Başla', signIn: 'Giriş yap', already: 'Zaten hesabın var mı?', terms: 'Devam ederek Hizmet Şartları ve Gizlilik Politikamızı kabul etmiş olursunuz' },
    ko: { subtitle: '전문 서비스 플랫폼', feat1: '전문가 찾기', feat1sub: '수천 명의 인증된 전문가', feat2: '기술 제공', feat2sub: '프로가 되어 자유롭게 수익 창출', feat3: '안전하고 보안', feat3sub: '인증된 프로필, 안전한 결제', getStarted: '시작하기', signIn: '로그인', already: '이미 계정이 있나요?', terms: '계속하면 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다' },
    ja: { subtitle: 'プロフェッショナルサービスプラットフォーム', feat1: 'プロを見つける', feat1sub: '近くの認証済み専門家が数千人', feat2: 'スキルを提供', feat2sub: 'プロになって自分のペースで稼ぐ', feat3: '安全・安心', feat3sub: '認証済みプロフィール、安全な決済', getStarted: '始める', signIn: 'ログイン', already: 'すでにアカウントをお持ちですか？', terms: '続行することで、利用規約とプライバシーポリシーに同意したことになります' },
  };
  const wt = () => welcomeTexts[currentLang()] || welcomeTexts['en'];
  const allLangs = getLanguages();

  // ── STEP 1: Welcome ──
  const renderWelcome = () => (
    <div style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; background: linear-gradient(160deg, #0a0618 0%, #1a1040 40%, #0f0a2e 70%, #0a0618 100%); padding: 0; overflow: auto;">
      {/* Background decorations */}
      <div style="position: absolute; top: -100px; right: -100px; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%); pointer-events: none;" />
      <div style="position: absolute; bottom: -80px; left: -80px; width: 250px; height: 250px; border-radius: 50%; background: radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%); pointer-events: none;" />

      {/* Language selector at top */}
      <div style="width: 100%; padding: 16px 20px 0 20px; z-index: 10; box-sizing: border-box;">
        <button
          onClick={() => setShowLangPicker(!showLangPicker())}
          style="display: flex; align-items: center; gap: 8px; margin-left: auto; padding: 8px 14px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; transition: all 0.2s;"
        >
          <span style="font-size: 18px;">{getCurrentLanguage().flag}</span>
          <span style="color: #fff; font-size: 13px; font-weight: 600;">{getCurrentLanguage().name}</span>
          <span style="color: rgba(255,255,255,0.3); font-size: 10px;">{showLangPicker() ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Language picker dropdown */}
      <Show when={showLangPicker()}>
        <div style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);" onClick={() => setShowLangPicker(false)}>
          <div style="width: 90%; max-width: 340px; max-height: 70vh; background: linear-gradient(160deg, #1a1040, #0f0a2e); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.5);" onClick={(e) => e.stopPropagation()}>
            <div style="padding: 18px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">🌍 Choose Language</p>
            </div>
            <div style="overflow-y: auto; max-height: 55vh; padding: 8px;">
              <For each={allLangs}>
                {(lang) => (
                  <button
                    onClick={() => { setLanguage(lang.code as any); setShowLangPicker(false); }}
                    style={`width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: none; border-radius: 12px; cursor: pointer; text-align: left; margin-bottom: 2px; transition: all 0.2s; ${currentLang() === lang.code ? 'background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3);' : 'background: transparent;'}`}
                  >
                    <span style="font-size: 24px;">{lang.flag}</span>
                    <span style={`flex: 1; font-size: 14px; font-weight: ${currentLang() === lang.code ? '700' : '500'}; color: ${currentLang() === lang.code ? '#a78bfa' : 'rgba(255,255,255,0.7)'};`}>{lang.name}</span>
                    <Show when={currentLang() === lang.code}>
                      <span style="color: #6366f1; font-size: 16px;">✓</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Main content */}
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 32px 32px; width: 100%; box-sizing: border-box;">
        {/* Logo */}
        <div style="width: 110px; height: 110px; border-radius: 34px; background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa); display: flex; align-items: center; justify-content: center; box-shadow: 0 25px 80px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1); animation: breathe 3s ease-in-out infinite; margin-bottom: 24px;">
          <span style="font-size: 52px; font-weight: 900; color: #fff; font-family: system-ui; letter-spacing: -3px;">B</span>
        </div>

        <h1 style="color: #fff; font-size: 34px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: 3px;">BOLH</h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0 0 8px 0; text-align: center;">{wt().subtitle}</p>

        {/* Feature highlights */}
        <div style="display: flex; flex-direction: column; gap: 12px; margin: 28px 0 36px 0; width: 100%; max-width: 300px;">
          <div style="display: flex; align-items: center; gap: 14px; padding: 13px 16px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 26px;">🔍</span>
            <div>
              <p style="color: #fff; font-size: 13px; font-weight: 700; margin: 0;">{wt().feat1}</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 2px 0 0 0;">{wt().feat1sub}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px; padding: 13px 16px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 26px;">💼</span>
            <div>
              <p style="color: #fff; font-size: 13px; font-weight: 700; margin: 0;">{wt().feat2}</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 2px 0 0 0;">{wt().feat2sub}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px; padding: 13px 16px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 26px;">🛡️</span>
            <div>
              <p style="color: #fff; font-size: 13px; font-weight: 700; margin: 0;">{wt().feat3}</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 2px 0 0 0;">{wt().feat3sub}</p>
            </div>
          </div>
        </div>

        {/* Get Started button */}
        <button
          onClick={() => setStep(2)}
          style="width: 100%; max-width: 300px; padding: 18px; border: none; border-radius: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 30px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1); letter-spacing: 0.5px; transition: transform 0.2s, box-shadow 0.2s;"
        >
          {wt().getStarted}
        </button>

        {/* Already have account */}
        <button
          onClick={() => setStep(2)}
          style="margin-top: 14px; background: none; border: none; color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer; padding: 8px 16px;"
        >
          {wt().already} <span style="color: #a78bfa; font-weight: 600;">{wt().signIn}</span>
        </button>
      </div>

      {/* Terms */}
      <p style="padding: 0 24px 20px; color: rgba(255,255,255,0.15); font-size: 10px; text-align: center; line-height: 1.5; margin: 0;">
        {wt().terms}
      </p>
    </div>
  );

  // ── STEP 2: Phone Number ──
  const renderPhone = () => (
    <div style="position: fixed; inset: 0; display: flex; flex-direction: column; background: linear-gradient(160deg, #0a0618, #1a1040, #0a0618); padding: 0; overflow: auto;">
      {/* Header */}
      <div style="padding: 20px 20px 0 20px; display: flex; align-items: center; gap: 12px;">
        <button onClick={() => setStep(1)} style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ←
        </button>
        <div style="flex: 1;" />
        <span style="color: rgba(255,255,255,0.3); font-size: 13px;">Step 1 of 3</span>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; padding: 32px 24px;">
        <div style="font-size: 40px; margin-bottom: 16px;">📱</div>
        <h2 style="color: #fff; font-size: 26px; font-weight: 800; margin: 0 0 8px 0;">Enter your number</h2>
        <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 0 0 32px 0; line-height: 1.5;">We'll send you a verification code via SMS</p>

        {/* Country selector */}
        <div style="position: relative; margin-bottom: 16px;">
          <button
            onClick={() => setShowCountries(!showCountries())}
            style="width: 100%; padding: 16px 18px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 12px; text-align: left;"
          >
            <span style="font-size: 24px;">{countryCodes[countryIdx()].flag}</span>
            <span style="font-weight: 600;">{countryCodes[countryIdx()].name}</span>
            <span style="color: rgba(255,255,255,0.4); margin-left: auto;">{countryCodes[countryIdx()].code}</span>
            <span style="color: rgba(255,255,255,0.3); font-size: 12px;">{showCountries() ? '▲' : '▼'}</span>
          </button>

          {/* Country dropdown */}
          <Show when={showCountries()}>
            <div style="position: absolute; top: 100%; left: 0; right: 0; z-index: 50; margin-top: 4px; background: #1a1040; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; max-height: 250px; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
              <For each={countryCodes}>
                {(country, idx) => (
                  <button
                    onClick={() => { setCountryIdx(idx()); setShowCountries(false); }}
                    style={`width: 100%; padding: 12px 18px; background: ${idx() === countryIdx() ? 'rgba(99,102,241,0.15)' : 'transparent'}; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); color: #fff; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; text-align: left;`}
                  >
                    <span style="font-size: 20px;">{country.flag}</span>
                    <span style="flex: 1; font-weight: 500;">{country.name}</span>
                    <span style="color: rgba(255,255,255,0.4); font-size: 13px;">{country.code}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Phone input */}
        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 18px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); margin-bottom: 24px;">
          <span style="color: rgba(255,255,255,0.5); font-size: 15px; font-weight: 600; white-space: nowrap;">{countryCodes[countryIdx()].code}</span>
          <input
            type="tel"
            placeholder="Phone number"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value.replace(/[^\d]/g, ''))}
            style="flex: 1; background: none; border: none; outline: none; color: #fff; font-size: 18px; font-weight: 600; padding: 14px 8px; letter-spacing: 1px;"
            maxlength="15"
            autofocus
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSendSMS}
          disabled={phone().length < 5 || sending()}
          style={`width: 100%; padding: 18px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s; ${phone().length >= 5 && !sending() ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 8px 30px rgba(99,102,241,0.3);' : 'background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed;'}`}
        >
          {sending() ? '⏳ Sending...' : 'Send Code →'}
        </button>

        <p style="color: rgba(255,255,255,0.2); font-size: 11px; margin-top: 16px; text-align: center; line-height: 1.6;">
          A 4-digit verification code will be sent to your phone
        </p>
      </div>
    </div>
  );

  // ── STEP 3: SMS Verification ──
  const renderSMS = () => (
    <div style="position: fixed; inset: 0; display: flex; flex-direction: column; background: linear-gradient(160deg, #0a0618, #1a1040, #0a0618); padding: 0; overflow: auto;">
      {/* Header */}
      <div style="padding: 20px 20px 0 20px; display: flex; align-items: center; gap: 12px;">
        <button onClick={() => { setStep(2); setCode(['', '', '', '']); clearInterval(timerRef); }} style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ←
        </button>
        <div style="flex: 1;" />
        <span style="color: rgba(255,255,255,0.3); font-size: 13px;">Step 2 of 3</span>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; padding: 40px 24px;">
        <div style="font-size: 48px; margin-bottom: 20px;">✉️</div>
        <h2 style="color: #fff; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; text-align: center;">Verification Code</h2>
        <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 0 0 8px 0; text-align: center;">Code sent to</p>
        <p style="color: #a78bfa; font-size: 16px; font-weight: 700; margin: 0 0 36px 0;">{fullPhone()}</p>

        {/* Demo hint */}
        <div style="padding: 10px 16px; border-radius: 10px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); margin-bottom: 28px;">
          <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0; text-align: center;">
            🧪 Demo mode — enter any 4 digits
          </p>
        </div>

        {/* Code inputs */}
        <div style="display: flex; gap: 14px; margin-bottom: 32px;">
          {[0, 1, 2, 3].map(idx => (
            <input
              id={`sms-${idx}`}
              type="tel"
              maxlength="1"
              value={code()[idx]}
              onInput={(e) => handleCodeInput(idx, e.currentTarget.value)}
              onKeyDown={(e) => handleCodeKeyDown(idx, e)}
              style={`width: 64px; height: 72px; text-align: center; font-size: 28px; font-weight: 800; border-radius: 16px; border: 2px solid ${code()[idx] ? '#6366f1' : codeError() ? '#ef4444' : 'rgba(255,255,255,0.12)'}; background: ${code()[idx] ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)'}; color: #fff; outline: none; caret-color: #6366f1; transition: all 0.2s;`}
            />
          ))}
        </div>

        <Show when={codeError()}>
          <p style="color: #ef4444; font-size: 13px; font-weight: 600; margin: 0 0 16px 0;">Wrong code, try again</p>
        </Show>

        {/* Resend */}
        <Show when={resendTimer() > 0}>
          <p style="color: rgba(255,255,255,0.3); font-size: 13px; margin: 0;">
            Resend in <span style="color: #a78bfa; font-weight: 700;">{resendTimer()}s</span>
          </p>
        </Show>
        <Show when={resendTimer() === 0}>
          <button
            onClick={() => { setCode(['', '', '', '']); startResendTimer(); }}
            style="background: none; border: none; color: #a78bfa; font-size: 14px; font-weight: 600; cursor: pointer; padding: 8px 16px;"
          >
            Resend Code
          </button>
        </Show>
      </div>
    </div>
  );

  // ── STEP 4: Profile Setup ──
  const renderProfile = () => (
    <div style="position: fixed; inset: 0; display: flex; flex-direction: column; background: linear-gradient(160deg, #0a0618, #1a1040, #0a0618); padding: 0; overflow: auto;">
      {/* Header */}
      <div style="padding: 20px 20px 0 20px; display: flex; align-items: center; gap: 12px;">
        <button onClick={() => setStep(3)} style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ←
        </button>
        <div style="flex: 1;" />
        <span style="color: rgba(255,255,255,0.3); font-size: 13px;">Step 3 of 3</span>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; padding: 32px 24px;">
        <div style="font-size: 40px; margin-bottom: 16px;">👤</div>
        <h2 style="color: #fff; font-size: 26px; font-weight: 800; margin: 0 0 8px 0;">Create your profile</h2>
        <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 0 0 32px 0;">Tell us about yourself</p>

        {/* Avatar upload */}
        {(() => {
          const [regAvatar, setRegAvatar] = createSignal<string | null>(null);
          return (
            <div style="display: flex; justify-content: center; margin-bottom: 28px;">
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setRegAvatar(reader.result as string);
                      try { localStorage.setItem('bolh_avatar_v1', reader.result as string); } catch {}
                    };
                    reader.readAsDataURL(f);
                  };
                  input.click();
                }}
                style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; cursor: pointer; position: relative; border: 3px dashed rgba(255,255,255,0.15); box-shadow: 0 8px 25px rgba(99,102,241,0.2);"
              >
                <Show when={regAvatar()} fallback={
                  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2)); display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">📷</span>
                  </div>
                }>
                  <img src={regAvatar()!} style="width: 100%; height: 100%; object-fit: cover;" />
                </Show>
                <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(99,102,241,0.5);">
                  <span style="color: #fff; font-size: 14px; font-weight: 800;">+</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Name input */}
        <label style="color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Your name</label>
        <input
          type="text"
          placeholder="Enter your name"
          value={userName()}
          onInput={(e) => setUserName(e.currentTarget.value)}
          style="width: 100%; padding: 16px 18px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 17px; font-weight: 600; outline: none; margin-bottom: 28px; box-sizing: border-box;"
          autofocus
        />

        {/* Role selection */}
        <label style="color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">I want to</label>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
          <button
            onClick={() => setUserRole('client')}
            style={`display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 16px; border: 2px solid ${userRole() === 'client' ? '#6366f1' : 'rgba(255,255,255,0.08)'}; background: ${userRole() === 'client' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)'}; cursor: pointer; transition: all 0.3s; text-align: left;`}
          >
            <div style={`width: 50px; height: 50px; border-radius: 14px; background: ${userRole() === 'client' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)'}; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: all 0.3s;`}>
              🔍
            </div>
            <div style="flex: 1;">
              <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">Find a Professional</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 3px 0 0 0;">I need help with tasks & services</p>
            </div>
            <div style={`width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${userRole() === 'client' ? '#6366f1' : 'rgba(255,255,255,0.2)'}; display: flex; align-items: center; justify-content: center; transition: all 0.3s;`}>
              <Show when={userRole() === 'client'}>
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #6366f1;" />
              </Show>
            </div>
          </button>

          <button
            onClick={() => setUserRole('worker')}
            style={`display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 16px; border: 2px solid ${userRole() === 'worker' ? '#10b981' : 'rgba(255,255,255,0.08)'}; background: ${userRole() === 'worker' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'}; cursor: pointer; transition: all 0.3s; text-align: left;`}
          >
            <div style={`width: 50px; height: 50px; border-radius: 14px; background: ${userRole() === 'worker' ? 'linear-gradient(135deg, #10b981, #34d399)' : 'rgba(255,255,255,0.06)'}; display: flex; align-items: center; justify-content: center; font-size: 24px; transition: all 0.3s;`}>
              💼
            </div>
            <div style="flex: 1;">
              <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">Offer My Skills</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 3px 0 0 0;">I'm a professional, I want to earn</p>
            </div>
            <div style={`width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${userRole() === 'worker' ? '#10b981' : 'rgba(255,255,255,0.2)'}; display: flex; align-items: center; justify-content: center; transition: all 0.3s;`}>
              <Show when={userRole() === 'worker'}>
                <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981;" />
              </Show>
            </div>
          </button>
        </div>

        {/* Continue button */}
        <button
          onClick={handleComplete}
          disabled={!userName().trim()}
          style={`width: 100%; padding: 18px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s; ${userName().trim() ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 8px 30px rgba(99,102,241,0.3);' : 'background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.25); cursor: not-allowed;'}`}
        >
          Complete Setup →
        </button>
      </div>
    </div>
  );

  // ── STEP 5: Success ──
  const renderDone = () => (
    <div style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(160deg, #0a0618, #1a1040, #0a0618);">
      <div style={`transform: ${doneAnim() ? 'scale(1)' : 'scale(0.5)'}; opacity: ${doneAnim() ? '1' : '0'}; transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);`}>
        <div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #34d399); display: flex; align-items: center; justify-content: center; box-shadow: 0 25px 80px rgba(16,185,129,0.35); margin: 0 auto 24px auto;">
          <span style="font-size: 56px;">✓</span>
        </div>
      </div>
      <h2 style={`color: #fff; font-size: 28px; font-weight: 800; margin: 0 0 8px 0; opacity: ${doneAnim() ? '1' : '0'}; transition: opacity 0.6s 0.3s;`}>Welcome, {userName()}!</h2>
      <p style={`color: rgba(255,255,255,0.4); font-size: 15px; margin: 0; opacity: ${doneAnim() ? '1' : '0'}; transition: opacity 0.6s 0.5s;`}>Your account is ready</p>
      <div style={`margin-top: 32px; display: flex; gap: 8px; opacity: ${doneAnim() ? '1' : '0'}; transition: opacity 0.6s 0.7s;`}>
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: breathe 1.2s ease-in-out infinite;" />
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; animation: breathe 1.2s ease-in-out 0.2s infinite;" />
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #6ee7b7; animation: breathe 1.2s ease-in-out 0.4s infinite;" />
      </div>
    </div>
  );

  return (
    <Switch>
      <Match when={step() === 1}>{renderWelcome()}</Match>
      <Match when={step() === 2}>{renderPhone()}</Match>
      <Match when={step() === 3}>{renderSMS()}</Match>
      <Match when={step() === 4}>{renderProfile()}</Match>
      <Match when={step() === 5}>{renderDone()}</Match>
    </Switch>
  );
}
