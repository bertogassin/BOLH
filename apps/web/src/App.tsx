import { JSX, createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { Header, BottomNav, type NavItem } from '@guardio/ui';
import { authStore } from '@guardio/ui/stores/auth';
import { themeStore } from '@guardio/ui/stores/theme';

// Swipe-back threshold in pixels
const SWIPE_THRESHOLD = 60;

type AppProps = {
  children?: JSX.Element;
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'map', label: 'Карта', icon: 'location' },
  { id: 'work', label: 'Работа', icon: 'briefcase' },
  { id: 'wallet', label: 'Wallet', icon: 'creditCard' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

export default function App(props: AppProps = {}) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [activeNav, setActiveNav] = createSignal('home');
  const [swipeX, setSwipeX] = createSignal(0);
  const [swiping, setSwiping] = createSignal(false);
  const navigate = useNavigate();
  const location = useLocation();

  let touchStartX = 0;
  let touchStartY = 0;
  let isHorizontalSwipe = false;

  // Swipe-back gesture handler (60px threshold, left edge only)
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    // Only activate if touch starts within 30px of left edge
    if (touch.clientX <= 30) {
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isHorizontalSwipe = false;
      setSwiping(true);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!swiping()) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);

    // Determine if horizontal swipe (first 10px of movement)
    if (!isHorizontalSwipe && (deltaX > 10 || deltaY > 10)) {
      isHorizontalSwipe = deltaX > deltaY;
      if (!isHorizontalSwipe) {
        setSwiping(false);
        setSwipeX(0);
        return;
      }
    }

    if (isHorizontalSwipe && deltaX > 0) {
      setSwipeX(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!swiping()) return;
    if (swipeX() >= SWIPE_THRESHOLD) {
      // Navigate back
      navigate(-1);
    }
    setSwipeX(0);
    setSwiping(false);
    isHorizontalSwipe = false;
  };

  onMount(async () => {
    themeStore.init();
    await authStore.init();
    setIsLoading(false);
  });

  const handleNavSelect = (id: string) => {
    setActiveNav(id);
    const routes: Record<string, string> = {
      home: '/',
      map: '/map',
      work: '/work',
      wallet: '/wallet',
      profile: '/profile',
    };
    navigate(routes[id] || '/');
  };

  const isAuthPage = () => {
    return location.pathname.startsWith('/login') || location.pathname.startsWith('/register');
  };

  const showNav = () => {
    return authStore.state.isAuthenticated && !isAuthPage();
  };

  // Check if current page is a sub-page (not main nav)
  const isSubPage = () => {
    const mainPaths = ['/', '/map', '/work', '/orders', '/profile'];
    return !mainPaths.includes(location.pathname);
  };

  return (
    <div
      class="min-h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe-back visual indicator */}
      <Show when={swiping() && swipeX() > 10}>
        <div
          class="fixed top-0 left-0 bottom-0 z-[9999] pointer-events-none transition-opacity"
          style={{
            width: '4px',
            background: `linear-gradient(to right, rgba(99,102,241,${Math.min(swipeX() / SWIPE_THRESHOLD, 1) * 0.8}), transparent)`,
            opacity: Math.min(swipeX() / SWIPE_THRESHOLD, 1),
          }}
        />
        <div
          class="fixed top-1/2 -translate-y-1/2 z-[9999] pointer-events-none"
          style={{
            left: `${Math.min(swipeX() - 20, 40)}px`,
            opacity: Math.min(swipeX() / SWIPE_THRESHOLD, 1),
            transform: `translateY(-50%) scale(${0.5 + Math.min(swipeX() / SWIPE_THRESHOLD, 1) * 0.5})`,
          }}
        >
          <div class={`w-8 h-8 rounded-full flex items-center justify-center ${
            swipeX() >= SWIPE_THRESHOLD ? 'bg-indigo-500' : 'bg-gray-600'
          } transition-colors`}>
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>
      </Show>

      <Show when={!isLoading()} fallback={
        <div class="flex items-center justify-center min-h-screen">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        </div>
      }>
        <Show when={showNav()}>
          <Header
            user={authStore.state.user ? {
              name: authStore.state.user.name,
              avatarUrl: authStore.state.user.avatarUrl,
            } : undefined}
            showNotifications
            notificationCount={3}
            onNotificationsClick={() => navigate('/notifications')}
          />
        </Show>

        <main
          class={showNav() ? 'pb-20' : ''}
          style={swiping() && swipeX() > 10 ? {
            transform: `translateX(${swipeX() * 0.3}px)`,
            transition: swiping() ? 'none' : 'transform 0.3s ease-out',
          } : {
            transform: 'translateX(0)',
            transition: 'transform 0.3s ease-out',
          }}
        >
          {props.children}
        </main>

        <Show when={showNav()}>
          <BottomNav
            items={navItems}
            activeId={activeNav()}
            onSelect={handleNavSelect}
          />
        </Show>
      </Show>
    </div>
  );
}
