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
import { api, isBackendAvailable, type ChatMessage } from '../api';

const MOCK_MESSAGES: { id: number; from: 'me' | 'worker'; text: string; time: string; dateKey?: string; read: boolean }[] = [
  { id: 1, from: 'worker', text: 'Здравствуйте! Я принял ваш заказ', time: '10:30', dateKey: 'today', read: true },
  { id: 2, from: 'me', text: 'Отлично! Когда будете?', time: '10:31', read: true },
  { id: 3, from: 'worker', text: 'Через 15 минут буду на месте', time: '10:32', read: true },
  { id: 4, from: 'me', text: 'Хорошо, жду', time: '10:33', read: true },
  { id: 5, from: 'worker', text: 'Я на месте, открывайте', time: '10:45', read: false },
  { id: 6, from: 'me', text: 'Спасибо, всё прошло отлично', time: '11:02', read: true },
  { id: 7, from: 'worker', text: 'Рад был помочь. Оставьте отзыв, если удобно', time: '11:05', read: false },
];


export default function ChatPage(props: { onBack: () => void }) {
  const CHAT_KEY = 'bolh_chat_v1';
  const loadChat = () => { try { const d = JSON.parse(localStorage.getItem(CHAT_KEY) || ''); return d.length ? d : MOCK_MESSAGES; } catch { return [...MOCK_MESSAGES]; } };
  const [messageList, setMessageList] = createSignal(loadChat());
  const [inputText, setInputText] = createSignal('');
  const [showTyping, setShowTyping] = createSignal(false);
  const [conversationId, setConversationId] = createSignal<string | null>(null);

  const saveChat = (msgs: typeof MOCK_MESSAGES) => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs)); } catch {} };

  // Fetch messages from API on mount
  onMount(async () => {
    try {
      const backendUp = await isBackendAvailable();
      if (!backendUp) return;

      const conversations = await api.chat.listConversations();
      if (conversations && conversations.length > 0) {
        const conv = conversations[0]; // Use first conversation for now
        setConversationId(conv.id);
        const messages = await api.chat.getMessages(conv.id);
        if (messages && messages.length > 0) {
          const userId = authUser()?.id;
          const mapped = messages.map((m: ChatMessage) => ({
            id: parseInt(m.id) || Date.now(),
            from: (m.senderId === userId ? 'me' : 'worker') as 'me' | 'worker',
            text: m.text,
            time: new Date(m.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
            read: m.read,
          }));
          setMessageList(mapped);
          saveChat(mapped);
        }
      }
    } catch (e) {
      console.warn('Failed to load chat from API:', e);
    }
  });

  const sendMessage = () => {
    const txt = inputText().trim();
    if (!txt) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const newMsg = { id: Date.now(), from: 'me' as const, text: txt, time, read: false };
    const updated = [...messageList(), newMsg];
    setMessageList(updated);
    saveChat(updated);
    setInputText('');

    // Send via API if connected
    const cId = conversationId();
    if (cId) {
      api.chat.sendMessage(cId, txt).catch(() => {});
    }

    // Simulate worker reply (only if backend is not connected)
    if (!cId) {
      setShowTyping(true);
      setTimeout(() => {
        setShowTyping(false);
        const replies = [
          'Хорошо, понял!', 'Сделаю!', 'Буду через 10 минут', 'Спасибо за информацию',
          'Уточню и вернусь', 'Договорились!', 'Отлично, приступаю', 'Принял, работаю над этим'
        ];
        const reply = { id: Date.now()+1, from: 'worker' as const, text: replies[Math.floor(Math.random()*replies.length)], time, read: false };
        const withReply = [...messageList(), reply];
        setMessageList(withReply);
        saveChat(withReply);
      }, 1500 + Math.random() * 1500);
    }
  };

  const dateSeparators = (): Record<number, string> => {
    const out: Record<number, string> = {};
    messageList().forEach((m, i) => {
      if (m.dateKey === 'today') out[i] = t('chat.today');
      if (m.dateKey === 'yesterday') out[i] = t('notifications.yesterday');
    });
    return out;
  };

  return (
    <div class="h-screen flex flex-col animate-fade-in bg-gradient-to-b from-slate-900/20 to-transparent">
      {/* Header */}
      <div class={`flex items-center gap-3 p-4 safe-area-top ${isDark() ? 'bg-black/95' : 'bg-white/95'} border-b border-gray-200/50 shadow-sm`}>
        <button onClick={props.onBack} class="w-10 h-10 rounded-full flex items-center justify-center touch-scale active:opacity-70">
          <Icon name="chevronLeft" class={isDark() ? 'text-white' : 'text-gray-700'} size="sm" />
        </button>
        <div class="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
          АК
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 truncate">Алексей К.</p>
          <p class="text-xs text-green-600 font-medium flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('chat.online')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <For each={messageList()}>
          {(msg, i) => (
            <>
              <Show when={dateSeparators()[i()]}>
                <p class="text-center text-xs text-gray-500 font-medium py-2">{dateSeparators()[i()]}</p>
              </Show>
              <div class={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div
                  class={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-md ${
                    msg.from === 'me'
                      ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                      : isDark()
                        ? 'rounded-bl-md bg-white/10 text-gray-100 border border-white/10'
                        : 'rounded-bl-md glass text-gray-800'
                  }`}
                >
                  <p class="text-sm leading-relaxed">{msg.text}</p>
                  <div class="flex items-center justify-end gap-1 mt-1">
                    <span class="text-[10px] opacity-80">{msg.time}</span>
                    <Show when={msg.from === 'me'}>
                      <span class="ml-1">
                        {msg.read ? (
                          <Icon name="checkDouble" class="w-3.5 h-3.5 text-white/90" />
                        ) : (
                          <Icon name="check" class="w-3.5 h-3.5 text-white/90" />
                        )}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </>
          )}
        </For>
        <Show when={showTyping()}>
          <div class="flex justify-start">
            <div class="rounded-2xl rounded-bl-md px-4 py-2.5 glass text-gray-500 text-sm flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0ms" />
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 150ms" />
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 300ms" />
              <span class="text-xs ml-1">{t('chat.typing')}</span>
            </div>
          </div>
        </Show>
      </div>

      {/* Input bar */}
      <div class={`p-3 safe-area-bottom ${isDark() ? 'bg-black/98' : 'bg-white/95'} border-t border-gray-200/50`}>
        <div class="flex items-center gap-2 glass rounded-2xl pl-4 pr-2 py-2">
          <input
            type="text"
            value={inputText()}
            onInput={(e) => setInputText(e.currentTarget.value)}
            placeholder={t('chat.typeMessage')}
            class="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none py-2"
          />
          <button class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 touch-scale">
            <Icon name="image" class="w-5 h-5" />
          </button>
          <button
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg touch-scale disabled:opacity-50"
            disabled={!inputText().trim()}
            onClick={sendMessage}
          >
            <Icon name="send" class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Notifications Page ==============
