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

export default function MarketplacePage(props: { onBack: () => void }) {
  const cats = ['all','equipment','uniforms','training','safety'];
  const [activeCat, setActiveCat] = createSignal('all');
  const [cartCount, setCartCount] = createSignal(0);
  const products = [
    {id:1,name:'Professional Body Armor',desc:'Level IIIA protection',price:150000,oldPrice:180000,cat:'safety',rating:4.8,reviews:45,inStock:true},
    {id:2,name:'Security Radio Set',desc:'Long-range (pair)',price:35000,cat:'equipment',rating:4.5,reviews:89,inStock:true},
    {id:3,name:'Guard Uniform Set',desc:'Professional black',price:25000,cat:'uniforms',rating:4.7,reviews:156,inStock:true},
    {id:4,name:'First Aid Kit Pro',desc:'Complete emergency kit',price:15000,cat:'safety',rating:4.9,reviews:234,inStock:false},
    {id:5,name:'Online Training Course',desc:'Certification',price:50000,cat:'training',rating:4.6,reviews:67,inStock:true},
    {id:6,name:'Tactical Flashlight',desc:'High-power LED',price:8000,cat:'equipment',rating:4.4,reviews:112,inStock:true},
  ];
  const filtered = () => activeCat()==='all' ? products : products.filter(p=>p.cat===activeCat());
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('marketplace.title')}</h2></div>
        <div class="relative"><button class="p-2 touch-scale"><Icon name="wallet" /></button><Show when={cartCount()>0}><span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{cartCount()}</span></Show></div>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-4"><For each={cats}>{(c)=>(<button onClick={()=>setActiveCat(c)} class={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-scale ${activeCat()===c?'bg-indigo-500 text-white':'glass text-gray-600'}`}>{t('marketplace.cat.'+c)}</button>)}</For></div>
      <div class="grid grid-cols-2 gap-3"><For each={filtered()}>{(p)=>(
        <div class="glass rounded-2xl overflow-hidden">
          <div class="h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"><Icon name="camera" size="xl" class="text-gray-300" /></div>
          <div class="p-3">
            <p class="font-medium text-sm text-gray-800 line-clamp-2">{p.name}</p>
            <div class="flex items-center gap-1 my-1"><Icon name="star" size="xs" class="text-amber-400"/><span class="text-xs text-gray-500">{p.rating} ({p.reviews})</span></div>
            <div class="flex items-center gap-2"><span class="font-bold text-indigo-600">{p.price.toLocaleString()} ₸</span><Show when={p.oldPrice}><span class="text-xs text-gray-400 line-through">{p.oldPrice?.toLocaleString()}</span></Show></div>
            <button class={`w-full mt-2 py-2 rounded-xl text-sm font-medium touch-scale ${p.inStock?'bg-indigo-500 text-white':'bg-gray-200 text-gray-400'}`} disabled={!p.inStock} onClick={()=>{if(p.inStock){setCartCount(cartCount()+1);haptic('light');playGlobalSound('success');}}}>{p.inStock?t('marketplace.addToCart'):t('marketplace.outOfStock')}</button>
          </div>
        </div>
      )}</For></div>
    </div>
  );
}

