import { JSX, createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { Header, BottomNav, type NavItem } from '@guardio/ui';
import { authStore } from '@guardio/ui/stores/auth';
import { themeStore } from '@guardio/ui/stores/theme';

type AppProps = {
  children?: JSX.Element;
};

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'discover', label: 'Discover', icon: 'search' },
  { id: 'orders', label: 'Orders', icon: 'shield' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export default function App(props: AppProps = {}) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [activeNav, setActiveNav] = createSignal('home');
  const navigate = useNavigate();
  const location = useLocation();

  onMount(async () => {
    themeStore.init();
    await authStore.init();
    setIsLoading(false);
  });

  const handleNavSelect = (id: string) => {
    setActiveNav(id);
    const routes: Record<string, string> = {
      home: '/',
      discover: '/discover',
      orders: '/orders',
      chat: '/chat',
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

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
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

        <main class={showNav() ? 'pb-20' : ''}>
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
