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

export default function IncidentReportPage(props: { onBack: () => void }) {
  const types = [{id:'suspicious',label:'incident.suspicious',icon:'search' as const},{id:'unauthorized',label:'incident.unauthorized',icon:'shield' as const},{id:'hazard',label:'incident.hazard',icon:'alertTriangle' as const},{id:'medical',label:'incident.medical',icon:'heart' as const},{id:'damage',label:'incident.damage',icon:'home' as const},{id:'other',label:'incident.other',icon:'message' as const}];
  const sevs = [{id:'low',label:'incident.low',color:'bg-gray-400'},{id:'medium',label:'incident.medium',color:'bg-amber-500'},{id:'high',label:'incident.high',color:'bg-orange-500'},{id:'critical',label:'incident.critical',color:'bg-red-500'}];
  const [selType, setSelType] = createSignal('');
  const [sev, setSev] = createSignal('medium');
  const [desc, setDesc] = createSignal('');
  const [photos, setPhotos] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const submit = () => {setSubmitting(true);playGlobalSound('send');setTimeout(()=>{setSubmitting(false);playGlobalSound('success');haptic('heavy');props.onBack();},1500);};
  return (
    <div class="p-4 animate-fade-in pb-24">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('incident.title')}</h2></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.type')}</p>
      <div class="grid grid-cols-2 gap-3 mb-5"><For each={types}>{(tp)=>(<button onClick={()=>{setSelType(tp.id);haptic('light');}} class={`p-4 rounded-2xl text-left touch-scale ${selType()===tp.id?'glass border-2 border-red-400 shadow-md':'glass'}`}><Icon name={tp.icon} class={selType()===tp.id?'text-red-500':'text-gray-400'}/><p class="font-medium text-sm text-gray-800 mt-2">{t(tp.label)}</p></button>)}</For></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.severity')}</p>
      <div class="flex gap-2 mb-5"><For each={sevs}>{(s)=>(<button onClick={()=>{setSev(s.id);haptic('light');}} class={`flex-1 py-3 rounded-xl text-center touch-scale ${sev()===s.id?'bg-gray-900 text-white':'glass text-gray-600'}`}><div class={`w-3 h-3 ${s.color} rounded-full mx-auto mb-1`}/><span class="text-xs">{t(s.label)}</span></button>)}</For></div>
      <p class="text-sm font-medium text-gray-700 mb-2">{t('incident.description')}</p>
      <textarea value={desc()} onInput={(e)=>setDesc(e.currentTarget.value)} placeholder={t('incident.descPlaceholder')} rows={4} class="w-full px-4 py-3 glass rounded-2xl text-sm outline-none resize-none mb-5"/>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.photos')}</p>
      <div class="flex gap-3 mb-6"><button onClick={()=>{setPhotos(photos()+1);haptic('light');}} class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center touch-scale"><Icon name="camera" class="text-gray-400"/></button><For each={Array(photos())}>{(_,i)=>(<div class="w-20 h-20 bg-gray-200 rounded-xl flex items-center justify-center"><span class="text-sm text-gray-500">#{i()+1}</span></div>)}</For></div>
      <div class="fixed bottom-0 left-0 right-0 p-4 safe-area-bottom bg-white/95" style="z-index:50">
        <button class="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-bold text-lg touch-scale disabled:opacity-50 flex items-center justify-center gap-2" disabled={!selType()||!desc()||submitting()} onClick={submit}>
          <Show when={submitting()} fallback={<><Icon name="send" class="text-white" size="sm"/>{t('incident.submit')}</>}><div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/></Show>
        </button>
      </div>
    </div>
  );
}

