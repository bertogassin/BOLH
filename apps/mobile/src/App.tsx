import { createSignal, For, Show, Switch, Match, onMount } from 'solid-js';
import { t, isRTL } from './i18n';
import { Icon } from './ui';
import { SwipeBack } from './ui';
import { initLikes, setActiveDepartment, setHomeMode, setHomeExpandedDept, setHomeExpandedGroup, setHomeExpandedSkill } from './store';
import { type PageId, HIDE_NAV_PAGES, FULL_HEIGHT_PAGES, BACK_MAP, NAV_ITEMS } from './config/routes';

import { BlockchainScreen } from './components';

// ── Pages ──
import HomePage from './pages/HomePage';
import MyBoardPage from './pages/MyBoardPage';
import DepartmentViewPage from './pages/DepartmentViewPage';
import WorkerSkillsPage from './pages/WorkerSkillsPage';
import UrgentOrderPage from './pages/UrgentOrderPage';
import DiscoverPage from './pages/DiscoverPage';
import MapPage from './pages/MapPage';
import TrackingPage from './pages/TrackingPage';
import OrdersPage from './pages/OrdersPage';
import ThemePage from './pages/ThemePage';
import ContractsPage from './pages/ContractsPage';
import NewContractPage from './pages/NewContractPage';
import DocumentVaultPage from './pages/DocumentVaultPage';
import VerificationPage from './pages/VerificationPage';
import AcademyGamePage from './pages/AcademyGamePage';
import LanguagePage from './pages/LanguagePage';
import RatingPage from './pages/RatingPage';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import SecurityCenterPage from './pages/SecurityCenterPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import SkillDetailPage from './pages/SkillDetailPage';
import SettingsPage from './pages/SettingsPage';
import WalletPage from './pages/WalletPage';
import ReferralPage from './pages/ReferralPage';
import PaymentsPage from './pages/PaymentsPage';
import AchievementsPage from './pages/AchievementsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MarketplacePage from './pages/MarketplacePage';
import IncidentReportPage from './pages/IncidentReportPage';
import CreateOrderPage from './pages/CreateOrderPage';
import WorkerDetailPage from './pages/WorkerDetailPage';

export default function App() {
  const [currentPage, setCurrentPage] = createSignal<PageId>('home');

  const showNav = () => !HIDE_NAV_PAGES.includes(currentPage());
  const goBack = (fallback: PageId = 'home') => setCurrentPage(BACK_MAP[currentPage()] ?? fallback);

  onMount(() => {
    document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
    initLikes();
  });

  return (
    <div class="min-h-screen safe-area-top">
      <main class={FULL_HEIGHT_PAGES.includes(currentPage()) ? 'h-screen' : showNav() ? 'pb-24' : 'pb-4'}>
        <Switch>
          <Match when={currentPage() === 'home'}>
            <HomePage onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'myboard'}>
            <MyBoardPage onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'urgent'}>
            <SwipeBack onBack={() => goBack()}><UrgentOrderPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'department'}>
            <SwipeBack onBack={() => { setActiveDepartment(null); setCurrentPage('home'); }}>
              <DepartmentViewPage onNavigate={setCurrentPage} onBack={() => { setActiveDepartment(null); setCurrentPage('home'); }} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'discover'}>
            <SwipeBack onBack={() => goBack()}><DiscoverPage /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'map'}>
            <SwipeBack onBack={() => goBack()}><MapPage /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'tracking'}>
            <SwipeBack onBack={() => goBack()}><TrackingPage /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'orders'}>
            <SwipeBack onBack={() => goBack()}><OrdersPage /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'wallet'}>
            <SwipeBack onBack={() => goBack()}><WalletPage onBack={() => goBack()} onNavigate={setCurrentPage} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'blockchain'}>
            <SwipeBack onBack={() => goBack()}><BlockchainScreen onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'referral'}>
            <SwipeBack onBack={() => goBack()}><ReferralPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'profile'}>
            <SwipeBack onBack={() => goBack()}><ProfilePage onNavigate={setCurrentPage} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'language'}>
            <SwipeBack onBack={() => goBack()}><LanguagePage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'theme'}>
            <SwipeBack onBack={() => goBack()}><ThemePage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'contracts'}>
            <SwipeBack onBack={() => goBack()}><ContractsPage onNavigate={setCurrentPage} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'newcontract'}>
            <SwipeBack onBack={() => goBack()}><NewContractPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'documents'}>
            <SwipeBack onBack={() => goBack()}><DocumentVaultPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'verification'}>
            <SwipeBack onBack={() => goBack()}><VerificationPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'academy'}>
            <SwipeBack onBack={() => goBack()}><AcademyGamePage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'security'}>
            <SwipeBack onBack={() => goBack()}><SecurityCenterPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'chat'}>
            <SwipeBack onBack={() => goBack()}><ChatPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'notifications'}>
            <SwipeBack onBack={() => goBack()}><NotificationsPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'rating'}>
            <SwipeBack onBack={() => goBack()}><RatingPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'auth'}>
            <AuthPage onComplete={() => setCurrentPage('home')} />
          </Match>
          <Match when={currentPage() === 'settings'}>
            <SwipeBack onBack={() => goBack()}><SettingsPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'skilldetail'}>
            <SwipeBack onBack={() => goBack()}><SkillDetailPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'payments'}>
            <SwipeBack onBack={() => goBack()}><PaymentsPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'achievements'}>
            <SwipeBack onBack={() => goBack()}><AchievementsPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'analytics'}>
            <SwipeBack onBack={() => goBack()}><AnalyticsPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'marketplace'}>
            <SwipeBack onBack={() => goBack()}><MarketplacePage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'incident'}>
            <SwipeBack onBack={() => goBack()}><IncidentReportPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'createorder'}>
            <SwipeBack onBack={() => goBack()}><CreateOrderPage onBack={() => goBack()} /></SwipeBack>
          </Match>
          <Match when={currentPage() === 'workerdetail'}>
            <SwipeBack onBack={() => goBack()}><WorkerDetailPage onBack={() => goBack()} onNavigate={setCurrentPage} /></SwipeBack>
          </Match>
        </Switch>
      </main>

      <Show when={showNav()}>
        <nav class="fixed bottom-0 left-0 right-0 safe-area-bottom" style="z-index: 100">
          <div class="absolute inset-0 backdrop-blur-2xl bg-black/60 border-t border-white/[0.06]" style="-webkit-backdrop-filter: blur(40px) saturate(180%); backdrop-filter: blur(40px) saturate(180%);" />
          <div class="relative flex items-end justify-around px-2 pt-2 pb-3">
            <For each={NAV_ITEMS}>
              {(item) => {
                const isActive = () => currentPage() === item.id;
                const isCenter = () => !!item.center;

                return isCenter() ? (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(item.id)}
                    class="flex flex-col items-center -mt-5 touch-scale"
                  >
                    <div class={`w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isActive()
                        ? 'bg-white shadow-lg shadow-white/20 scale-105'
                        : 'bg-white/[0.12] border border-white/[0.08]'
                    }`}>
                      <Icon name={item.icon} class={isActive() ? 'text-black' : 'text-white/50'} />
                    </div>
                    <span class={`text-[9px] mt-1.5 font-semibold tracking-wide uppercase ${
                      isActive() ? 'text-white' : 'text-white/30'
                    }`}>
                      {t(item.labelKey)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'home') {
                        setHomeExpandedDept(null);
                        setHomeExpandedGroup(null);
                        setHomeExpandedSkill(null);
                      }
                      setCurrentPage(item.id);
                    }}
                    class="flex flex-col items-center justify-center min-w-[56px] py-1 transition-all duration-200 touch-scale group"
                  >
                    <div class={`relative p-2 rounded-xl transition-all duration-300 ${
                      isActive() ? 'bg-white/[0.12]' : ''
                    }`}>
                      <Icon
                        name={item.icon}
                        class={`transition-all duration-300 ${isActive() ? 'text-white' : 'text-white/35 group-hover:text-white/50'}`}
                        size="sm"
                      />
                      {isActive() && <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />}
                    </div>
                    <span class={`text-[9px] mt-0.5 font-medium tracking-wide transition-all duration-300 ${
                      isActive() ? 'text-white/90' : 'text-white/25'
                    }`}>
                      {t(item.labelKey)}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </nav>
      </Show>
    </div>
  );
}

