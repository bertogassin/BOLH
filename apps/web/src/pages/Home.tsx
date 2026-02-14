import { createSignal, onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, Button, GuardCard, Icon, SearchBar } from '@guardio/ui';
import Elina from '../components/Elina';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { id: 'sos', label: 'SOS', icon: 'sos', color: 'bg-red-500' },
  { id: 'bodyguard', label: 'Bodyguard', icon: 'shield', color: 'bg-blue-500' },
  { id: 'patrol', label: 'Patrol', icon: 'location', color: 'bg-green-500' },
  { id: 'escort', label: 'Escort', icon: 'arrowRight', color: 'bg-purple-500' },
];

// Mock data
const nearbyGuards = [
  {
    id: 1,
    name: 'Александр Иванов',
    rating: 4.9,
    totalReviews: 127,
    verificationLevel: 4,
    distanceKm: 0.5,
    hourlyRate: 8000,
    isAvailable: true,
    isOnline: true,
    specializations: ['VIP Protection', 'Bodyguard'],
  },
  {
    id: 2,
    name: 'Сергей Петров',
    rating: 4.7,
    totalReviews: 89,
    verificationLevel: 3,
    distanceKm: 1.2,
    hourlyRate: 6000,
    isAvailable: true,
    isOnline: true,
    specializations: ['Event Security'],
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = createSignal('');

  const handleQuickAction = (action: QuickAction) => {
    if (action.id === 'sos') {
      // Handle SOS
      alert('SOS Alert activated!');
    } else {
      navigate(`/orders/create?type=${action.id}`);
    }
  };

  return (
    <div class="px-4 py-6 space-y-6 animate-fade-in">
      {/* Elina — floating companion */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Привет!</h1>
          <p class="text-sm text-gray-500">Элина рядом — нажми на неё</p>
        </div>
        <Elina size={56} showCustomizer={true} />
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search guards, services..."
        value={searchQuery()}
        onChange={setSearchQuery}
        onSearch={(q) => navigate(`/discover?q=${encodeURIComponent(q)}`)}
      />

      {/* Quick Actions */}
      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div class="grid grid-cols-4 gap-3">
          <For each={quickActions}>
            {(action) => (
              <button
                onClick={() => handleQuickAction(action)}
                class="flex flex-col items-center gap-2"
              >
                <div class={`w-14 h-14 ${action.color} rounded-2xl flex items-center justify-center shadow-md`}>
                  <Icon name={action.icon} size="lg" class="text-white" />
                </div>
                <span class="text-xs text-gray-600 font-medium">{action.label}</span>
              </button>
            )}
          </For>
        </div>
      </section>

      {/* Active Order - links to live tracking */}
      <Card
        title="Активный заказ"
        class="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/tracking/1')}
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500">Охрана объекта</p>
            <p class="text-base font-semibold text-green-600 flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              В пути
            </p>
            <p class="text-sm text-gray-500">Охранник: Александр И.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/tracking/1')}>
            Отследить
          </Button>
        </div>
      </Card>

      {/* Nearby Guards */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-900">Nearby Guards</h2>
          <button 
            onClick={() => navigate('/discover')}
            class="text-sm text-blue-600 font-medium"
          >
            See all
          </button>
        </div>
        
        <div class="space-y-3">
          <For each={nearbyGuards}>
            {(guard) => (
              <GuardCard
                {...guard}
                onClick={() => navigate(`/guards/${guard.id}`)}
              />
            )}
          </For>
        </div>
      </section>

      {/* Promotions */}
      <Card class="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold">Premium Membership</h3>
            <p class="text-sm opacity-90">Get 20% off on all services</p>
          </div>
          <Button variant="secondary" size="sm">
            Upgrade
          </Button>
        </div>
      </Card>
    </div>
  );
}
