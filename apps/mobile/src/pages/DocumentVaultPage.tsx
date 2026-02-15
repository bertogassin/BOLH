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
  type AuthUser,
} from '../store';
import { Icon, SkillIcon, Icons, EMOJI_TO_ICON, type NotifType } from '../ui';
import { LikeBadge, SwipeLayer, SwipeBack, playGlobalSound, haptic, hapticOrder, globalSoundEnabled, setGlobalSoundEnabled, globalHapticEnabled, setGlobalHapticEnabled, globalNotifSound, setGlobalNotifSound, globalVolume, setGlobalVolume, vibrationIntensity, setVibrationIntensity, rareEscalationEnabled, setRareEscalationEnabled } from '../ui';
import { MobileElina, ElinaChatPanel } from '../elina-ui';

const DOCUMENTS_MOCK: Document[] = [
  { id: '1', name: 'Расчётка Январь 2026', nameEn: 'Payslip January 2026', type: 'payslip', date: '31.01.2026', size: '156 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received', pinned: true },
  { id: '2', name: 'Контракт охраны #2026-001', nameEn: 'Security Contract #2026-001', type: 'contract', date: '15.01.2026', size: '2.3 MB', encrypted: true, sender: 'ТОО "Астана Плаза"', status: 'signed' },
  { id: '3', name: 'Расчётка Декабрь 2025', nameEn: 'Payslip December 2025', type: 'payslip', date: '31.12.2025', size: '148 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '4', name: 'Чек оплаты #8847', nameEn: 'Payment Receipt #8847', type: 'receipt', date: '20.12.2025', size: '45 KB', encrypted: true, status: 'received' },
  { id: '5', name: 'Сертификат охранника', nameEn: 'Security Guard Certificate', type: 'certificate', date: '10.12.2025', size: '1.1 MB', encrypted: true, status: 'signed', expiresAt: '10.12.2026' },
  { id: '6', name: 'Контракт #2025-089', nameEn: 'Contract #2025-089', type: 'contract', date: '01.12.2025', size: '2.1 MB', encrypted: true, sender: 'ИП Сидоров', status: 'signed' },
  { id: '7', name: 'Расчётка Ноябрь 2025', nameEn: 'Payslip November 2025', type: 'payslip', date: '30.11.2025', size: '151 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '8', name: 'Полис страхования', nameEn: 'Insurance Policy', type: 'insurance', date: '15.11.2025', size: '890 KB', encrypted: true, sender: 'СК "Надёжность"', status: 'received', expiresAt: '15.11.2026' },
  { id: '9', name: 'Удостоверение личности', nameEn: 'National ID Card', type: 'id', date: '01.10.2025', size: '2.5 MB', encrypted: true, status: 'signed', expiresAt: '01.10.2035' },
  { id: '10', name: 'Диплом сантехника', nameEn: 'Plumbing Diploma', type: 'diploma', date: '20.06.2023', size: '3.2 MB', encrypted: true, status: 'signed' },
  { id: '11', name: 'Лицензия электрика', nameEn: 'Electrician License', type: 'license', date: '01.03.2024', size: '1.8 MB', encrypted: true, status: 'signed', expiresAt: '01.03.2026' },
  { id: '12', name: 'Налоговый отчёт 2025', nameEn: 'Tax Report 2025', type: 'tax', date: '15.01.2026', size: '456 KB', encrypted: true, status: 'received' },
  { id: '13', name: 'Контракт уборки #126', nameEn: 'Cleaning Contract #126', type: 'contract', date: '28.01.2026', size: '1.5 MB', encrypted: true, sender: 'БЦ "Мегаполис"', status: 'pending', tags: ['urgent'] },
  { id: '14', name: 'Расчётка Октябрь 2025', nameEn: 'Payslip October 2025', type: 'payslip', date: '31.10.2025', size: '149 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '15', name: 'Акт выполненных работ', nameEn: 'Work Completion Certificate', type: 'receipt', date: '25.01.2026', size: '320 KB', encrypted: true, sender: 'ТОО "Астана Плаза"', status: 'pending' },
  { id: '16', name: 'Водительское удостоверение', nameEn: "Driver's License", type: 'license', date: '01.05.2024', size: '2.1 MB', encrypted: true, status: 'signed', expiresAt: '01.05.2034' },
  { id: '17', name: 'Расчётка Сентябрь 2025', nameEn: 'Payslip September 2025', type: 'payslip', date: '30.09.2025', size: '147 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '18', name: 'Медицинская справка', nameEn: 'Medical Certificate', type: 'certificate', date: '15.08.2025', size: '780 KB', encrypted: true, status: 'signed', expiresAt: '15.02.2026' },
  { id: '19', name: 'Расчётка Август 2025', nameEn: 'Payslip August 2025', type: 'payslip', date: '31.08.2025', size: '152 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '20', name: 'Справка о несудимости', nameEn: 'Criminal Record Certificate', type: 'certificate', date: '01.07.2025', size: '320 KB', encrypted: true, status: 'signed', expiresAt: '01.07.2026' },
  { id: '21', name: 'Расчётка Июль 2025', nameEn: 'Payslip July 2025', type: 'payslip', date: '31.07.2025', size: '150 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '22', name: 'Доп. соглашение #5', nameEn: 'Supplementary Agreement #5', type: 'contract', date: '10.07.2025', size: '890 KB', encrypted: true, sender: 'ИП Сидоров', status: 'expired', expiresAt: '10.01.2026' },
  { id: '23', name: 'Сертификат первой помощи', nameEn: 'First Aid Certificate', type: 'certificate', date: '20.05.2025', size: '1.4 MB', encrypted: true, status: 'signed', expiresAt: '20.05.2027' },
  { id: '24', name: 'Расчётка Июнь 2025', nameEn: 'Payslip June 2025', type: 'payslip', date: '30.06.2025', size: '146 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
];

const ACCESS_HISTORY_MOCK = [
  { type: 'viewed' as const, docName: 'Расчётка Январь 2026', time: 'Сегодня, 14:32', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'downloaded' as const, docName: 'Контракт #2026-001', time: 'Вчера, 09:15', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'shared' as const, docName: 'Сертификат охранника', time: '5 янв 2026', device: 'Safari', ip: '10.0.0.2' },
  { type: 'viewed' as const, docName: 'Полис страхования', time: '3 янв 2026', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'deleted_attempt' as const, docName: 'Черновик', time: '1 янв 2026', device: 'Chrome', ip: '172.16.0.5' },
];

export default function DocumentVaultPage(props: { onBack: () => void }) {
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearch, setShowSearch] = createSignal(false);
  const [previewDoc, setPreviewDoc] = createSignal<Document | null>(null);
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [uploading, setUploading] = createSignal(false);
  const [uploadSuccess, setUploadSuccess] = createSignal(false);
  const [showShare, setShowShare] = createSignal(false);
  const [shareDoc, setShareDoc] = createSignal<Document | null>(null);
  const [shareTimer, setShareTimer] = createSignal('24h');
  const [sharePin, setSharePin] = createSignal(false);
  const [shareLinkCopied, setShareLinkCopied] = createSignal(false);

  const dark = () => isDark();
  const docName = (doc: Document) => currentLang() === 'ru' ? doc.name : doc.nameEn;

  const categories = () => [
    { id: 'all', label: t('docs.catAll'), icon: '📁', count: 24 },
    { id: 'payslip', label: t('docs.catPayslips'), icon: '💰', count: 8 },
    { id: 'contract', label: t('docs.catContracts'), icon: '📄', count: 5 },
    { id: 'receipt', label: t('docs.catReceipts'), icon: '🧾', count: 3 },
    { id: 'certificate', label: t('docs.catCertificates'), icon: '🏆', count: 4 },
    { id: 'id', label: t('docs.catIds'), icon: '🪪', count: 1 },
    { id: 'diploma', label: t('docs.catDiplomas'), icon: '🎓', count: 1 },
    { id: 'license', label: t('docs.catLicenses'), icon: '📜', count: 2 },
    { id: 'insurance', label: t('docs.catInsurance'), icon: '🛡️', count: 1 },
    { id: 'tax', label: t('docs.catTax'), icon: '📊', count: 1 },
  ];

  const filteredDocs = () => {
    let list = DOCUMENTS_MOCK;
    if (selectedCategory() !== 'all') list = list.filter(d => d.type === selectedCategory());
    const q = searchQuery().toLowerCase();
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q));
    return list;
  };

  const pendingCount = () => DOCUMENTS_MOCK.filter(d => d.status === 'pending').length;
  const expiringCount = () => DOCUMENTS_MOCK.filter(d => d.expiresAt && new Date(d.expiresAt.split('.').reverse().join('-')) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length;
  const attentionCount = () => pendingCount() + expiringCount();

  const getTypeIcon = (type: Document['type']) => {
    const map: Record<Document['type'], string> = { payslip: '💰', contract: '📄', receipt: '🧾', certificate: '🏆', id: '🪪', diploma: '🎓', license: '📜', insurance: '🛡️', tax: '📊' };
    return map[type] || '📁';
  };

  const getTypeBg = (type: Document['type']) => {
    if (dark()) return 'from-indigo-500/30 to-purple-600/30';
    return 'from-indigo-100 to-purple-100';
  };

  const getStatusKey = (status: Document['status']) => {
    switch (status) {
      case 'received': return 'docs.statusReceived';
      case 'signed': return 'docs.statusSigned';
      case 'pending': return 'docs.statusPending';
      case 'expired': return 'docs.statusExpired';
      case 'rejected': return 'docs.statusRejected';
      default: return 'docs.statusReceived';
    }
  };

  const getStatusClass = (status: Document['status']) => {
    switch (status) {
      case 'received': case 'signed': return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'pending': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
      case 'expired': case 'rejected': return 'bg-red-500/20 text-red-700 dark:text-red-300';
      default: return 'bg-gray-500/20 text-gray-600 dark:text-gray-200';
    }
  };

  const startUpload = () => {
    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) { clearInterval(interval); setUploading(false); setUploadSuccess(true); return 100; }
        return p + 12;
      });
    }, 120);
  };

  const openShare = (doc: Document) => { setShareDoc(doc); setShowShare(true); setShareLinkCopied(false); };
  const copyShareLink = () => { setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 2000); };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Section 0: Header */}
      <div class="p-4 pb-2">
        <div class="flex items-center gap-3 mb-1">
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={props.onBack} aria-label="Back">
            <Icon name="chevronLeft" class={dark() ? 'text-white' : 'text-gray-700'} size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1 truncate">{t('docs.title')}</h1>
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => { setShowUpload(true); setUploadSuccess(false); }} aria-label="Upload">
            <Icon name="uploadCloud" class="text-indigo-400" size="sm" />
          </button>
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => setShowSearch(s => !s)} aria-label="Search">
            <Icon name="search" class={dark() ? 'text-white' : 'text-gray-600'} size="sm" />
          </button>
        </div>
        <p class="text-white/90 text-sm ml-[3.25rem]">{t('docs.encrypted')}</p>
        <div class="mt-2 px-1">
          <p class="text-xs text-white/90 mb-1">{t('docs.storageUsed')}</p>
          <div class="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 transition-all duration-500" style={{ width: '48%' }} />
          </div>
        </div>
      </div>

      <Show when={showSearch()}>
        <div class="px-4 pb-2 animate-slide-up">
          <input
            type="text"
            placeholder={t('search.placeholder')}
            class="w-full rounded-xl glass px-4 py-2.5 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            value={searchQuery()}
            onInput={e => setSearchQuery(e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Section 1: Security Banner */}
      <div class="px-4 mb-3">
        <div class={`rounded-2xl p-4 border overflow-hidden ${dark() ? 'bg-gradient-to-br from-green-900/60 to-emerald-900/40 border-green-500/30' : 'bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-400/40'} glass animate-slide-up`} style="animation-delay: 0.05s">
          <div class="flex items-center gap-3">
            <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${dark() ? 'bg-green-500/30' : 'bg-green-400/30'}`}>
              <Icon name="lock" class="text-slate-500 dark:text-gray-200" size="sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-green-800 dark:text-green-200">{t('docs.aes256')}</p>
              <p class="text-xs text-green-700 dark:text-green-300/90">{t('docs.onlyYou')}</p>
            </div>
            <div class="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center animate-pulse">
              <Icon name="shield" class="text-slate-500 dark:text-gray-200" size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Quick Stats */}
      <div class="px-4 mb-3 overflow-x-auto">
        <div class="flex gap-3 pb-2 -mx-1 animate-slide-up" style="animation-delay: 0.1s">
          <div class="flex-shrink-0 glass rounded-xl px-4 py-3 min-w-[120px]">
            <p class="text-2xl font-bold text-white">24</p>
            <p class="text-xs text-white/90">{t('docs.total')}</p>
          </div>
          <div class="flex-shrink-0 glass rounded-xl px-4 py-3 min-w-[120px]">
            <p class="text-2xl font-bold text-white">8</p>
            <p class="text-xs text-white/90">{t('docs.receivedMonth')}</p>
          </div>
          <div class="flex-shrink-0 rounded-xl px-4 py-3 min-w-[120px] bg-amber-500/20 border border-amber-400/30">
            <p class="text-2xl font-bold text-amber-200">3</p>
            <p class="text-xs text-amber-200/80">{t('docs.pendingSign')}</p>
          </div>
          <div class="flex-shrink-0 rounded-xl px-4 py-3 min-w-[120px] bg-red-500/20 border border-red-400/30 animate-pulse">
            <p class="text-2xl font-bold text-red-200">2</p>
            <p class="text-xs text-red-200/80">{t('docs.expiringSoon')}</p>
          </div>
        </div>
      </div>

      {/* Section 3: Notifications Bar */}
      <Show when={attentionCount() > 0}>
        <div class="px-4 mb-3">
          <div class="rounded-xl px-4 py-2.5 bg-amber-500/20 border border-amber-400/40 flex items-center justify-between gap-2 animate-slide-up" style="animation-delay: 0.12s">
            <span class="text-amber-200 text-sm font-medium">{attentionCount()} {t('docs.needAttention')}</span>
            <Icon name="chevronRight" class="text-slate-400 dark:text-gray-300 w-5 h-5 flex-shrink-0" />
          </div>
        </div>
      </Show>

      {/* Section 4: Categories */}
      <div class="px-4 mb-3">
        <div class="flex gap-2 overflow-x-auto pb-2 animate-slide-up" style="animation-delay: 0.15s">
          <For each={categories()}>
            {(cat) => (
              <button
                class={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap transition-all touch-scale ${
                  selectedCategory() === cat.id
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'glass text-white/90'
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span class="font-medium text-sm">{cat.label}</span>
                <span class={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory() === cat.id ? 'bg-white/20' : 'bg-white/20 text-white/90'}`}>{cat.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Section 5: Document List */}
      <div class="px-4 space-y-3 pb-6">
        <For each={filteredDocs()}>
          {(doc, i) => (
            <div
              class="glass rounded-2xl p-4 animate-slide-up border border-white/10 touch-scale"
              style={`animation-delay: ${Math.min(i() * 0.03, 0.4)}s`}
            >
              <div class="flex items-start gap-3">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTypeBg(doc.type)} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {getTypeIcon(doc.type)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-white truncate">{docName(doc)}</p>
                    <Show when={doc.pinned}>
                      <Icon name="star" class="text-amber-400 w-4 h-4 flex-shrink-0" size="xs" />
                    </Show>
                  </div>
                  <Show when={doc.sender}>
                    <p class="text-xs text-white/90 mt-0.5">{t('docs.from')}: {doc.sender}</p>
                  </Show>
                  <div class="flex flex-wrap items-center gap-2 mt-1">
                    <span class="text-xs text-white/90">{doc.date}</span>
                    <span class="text-white/85">•</span>
                    <span class="text-xs text-white/90">{doc.size}</span>
                    <Show when={doc.encrypted}>
                      <span class="text-xs text-green-400/90 flex items-center gap-1">
                        <Icon name="lock" size="xs" />
                        {t('docs.encryptedBadge')}
                      </span>
                    </Show>
                  </div>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusClass(doc.status)}`}>
                      {t(getStatusKey(doc.status))}
                    </span>
                    <Show when={doc.expiresAt}>
                      <span class="text-xs text-amber-400/90">{t('docs.expires')}: {doc.expiresAt}</span>
                    </Show>
                  </div>
                </div>
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" onClick={() => setPreviewDoc(doc)} title={t('docs.view')}>
                    <Icon name="eye" class="text-white/90" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" title={t('docs.download')}>
                    <Icon name="download" class="text-indigo-300" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" onClick={() => openShare(doc)} title={t('docs.share')}>
                    <Icon name="share" class="text-white/90" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center rounded-lg touch-scale" title={t('docs.delete')}>
                    <Icon name="trash" class="text-red-300" size="sm" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Section 9: Access History */}
      <div class="p-4 pt-2 pb-8">
        <p class="text-sm font-medium text-white/90 mb-3">{t('docs.accessHistory')}</p>
        <div class="glass rounded-2xl p-4 border border-white/10">
          <div class="space-y-0">
            <For each={ACCESS_HISTORY_MOCK}>
              {(entry, idx) => (
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      entry.type === 'viewed' ? 'bg-green-500/20' :
                      entry.type === 'downloaded' ? 'bg-slate-500/20' :
                      entry.type === 'shared' ? 'bg-amber-500/20' : 'bg-red-500/20'
                    }`}>
                      <Switch>
                        <Match when={entry.type === 'viewed'}><Icon name="eye" class="text-slate-500 dark:text-gray-200" size="xs" /></Match>
                        <Match when={entry.type === 'downloaded'}><Icon name="download" class="text-slate-500 dark:text-gray-200" size="xs" /></Match>
                        <Match when={entry.type === 'shared'}><Icon name="share" class="text-slate-500 dark:text-gray-200" size="xs" /></Match>
                        <Match when={entry.type === 'deleted_attempt'}><Icon name="trash" class="text-red-400" size="xs" /></Match>
                      </Switch>
                    </div>
                    <Show when={idx() < ACCESS_HISTORY_MOCK.length - 1}>
                      <div class="w-0.5 min-h-[24px] bg-white/10 my-0.5" />
                    </Show>
                  </div>
                  <div class="flex-1 min-w-0 pb-4">
                    <p class="text-sm text-white/90">{entry.docName}</p>
                    <p class="text-xs text-white/90">{entry.time} · {entry.device}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Section 7: Document Preview Modal */}
      <Show when={previewDoc()}>
        {(doc) => (
          <div
            class="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setPreviewDoc(null)}
          >
            <div class="p-4 flex items-center justify-between border-b border-white/10">
              <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => setPreviewDoc(null)}>
                <Icon name="x" class="text-white" size="sm" />
              </button>
              <h2 class="text-white font-semibold truncate flex-1 mx-2">{docName(doc())}</h2>
            </div>
            <div class="flex-1 overflow-auto p-4" onClick={e => e.stopPropagation()}>
              <p class="text-white/90 text-sm">{doc().date}{doc().sender ? ` · ${doc().sender}` : ''}</p>
              <div class="mt-4 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center aspect-[3/4] min-h-[280px]">
                <Icon name="fileText" class="text-white/90 w-20 h-20" size="xl" />
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class={`text-xs px-2 py-1 rounded-full ${getStatusClass(doc().status)}`}>{t(getStatusKey(doc().status))}</span>
              </div>
            </div>
            <div class="p-4 border-t border-white/10 flex gap-2 flex-wrap">
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="download" size="sm" />
                {t('docs.download')}
              </button>
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2" onClick={() => { setPreviewDoc(null); openShare(doc()); }}>
                <Icon name="share" size="sm" />
                {t('docs.share')}
              </button>
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="printer" size="sm" />
                {t('docs.print')}
              </button>
              <button class="py-2.5 px-4 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="trash" size="sm" />
                {t('docs.delete')}
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* Section 8: Upload Flow */}
      <Show when={showUpload()}>
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !uploading() && setShowUpload(false)}>
          <div class="w-full max-w-lg rounded-t-3xl glass border-t border-white/20 p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <Switch>
              <Match when={uploadSuccess()}>
                <div class="text-center py-4">
                  <div class="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mx-auto mb-3">
                    <Icon name="check" class="text-emerald-600 dark:text-emerald-400 w-8 h-8" size="lg" />
                  </div>
                  <p class="text-white font-semibold text-lg">{t('docs.uploadSuccess')}</p>
                  <button class="mt-4 px-6 py-2 rounded-xl bg-indigo-500 text-white font-medium touch-scale" onClick={() => { setShowUpload(false); setUploadSuccess(false); }}>{t('nav.home')}</button>
                </div>
              </Match>
              <Match when={uploading()}>
                <div class="py-4">
                  <p class="text-white font-medium mb-2">{t('docs.uploading')}</p>
                  <div class="h-2 rounded-full bg-white/20 overflow-hidden">
                    <div class="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress()}%` }} />
                  </div>
                </div>
              </Match>
              <Match when={!uploading() && !uploadSuccess()}>
                <p class="text-white font-semibold mb-4">{t('docs.title')}</p>
                <div class="grid grid-cols-1 gap-2">
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="camera" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.takePhoto')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="image" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.chooseGallery')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="fileText" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.uploadFile')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="camera" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.scanDocument')}</span>
                  </button>
                </div>
                <button class="mt-4 w-full py-2.5 rounded-xl border border-white/30 text-white/90 touch-scale" onClick={() => setShowUpload(false)}>{t('security.cancel')}</button>
              </Match>
            </Switch>
          </div>
        </div>
      </Show>

      {/* Section 10: Sharing Controls */}
      <Show when={showShare() && shareDoc()}>
        {(doc) => (
          <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowShare(false)}>
            <div class="w-full max-w-lg rounded-t-3xl glass border-t border-white/20 p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
              <p class="text-white font-semibold mb-4">{t('docs.share')}: {docName(doc())}</p>
              <div class="space-y-3">
                <button class="w-full flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left">
                  <Icon name="send" class="text-indigo-400" size="sm" />
                  <span class="text-white">{t('docs.shareViaLink')}</span>
                </button>
                <div class="flex items-center gap-2">
                  <span class="text-white/90 text-sm">{t('docs.shareWithTimer')}</span>
                  <select
                    class="rounded-lg bg-white/10 text-white border border-white/20 px-3 py-2 text-sm"
                    value={shareTimer()}
                    onInput={e => setShareTimer((e.target as HTMLSelectElement).value)}
                  >
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>
                <label class="flex items-center gap-3 p-3 rounded-xl glass cursor-pointer">
                  <input type="checkbox" checked={sharePin()} onInput={e => setSharePin(e.currentTarget.checked)} class="rounded" />
                  <span class="text-white text-sm">{t('docs.requirePin')}</span>
                </label>
                <div class="rounded-xl bg-white/10 border border-white/20 p-3 flex items-center justify-between gap-2">
                  <code class="text-white/90 text-sm truncate">https://bolh.app/s/enc-xxxx</code>
                  <button class="flex-shrink-0 py-1.5 px-3 rounded-lg bg-indigo-500 text-white text-sm font-medium touch-scale" onClick={copyShareLink}>
                    {shareLinkCopied() ? t('docs.linkCopied') : t('docs.copyLink')}
                  </button>
                </div>
              </div>
              <button class="mt-4 w-full py-2.5 rounded-xl border border-white/30 text-white/90 touch-scale" onClick={() => setShowShare(false)}>{t('security.cancel')}</button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

// ============== Verification System ==============
