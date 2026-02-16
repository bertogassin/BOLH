import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { OrderCard, Button, Icon, Badge } from '@bolh/ui';

const tabs = ['Активные', 'Завершённые', 'Все'];

// Mock data
const orders = [
  {
    id: '1',
    status: 'in_progress' as const,
    serviceType: 'bodyguard',
    address: 'ул. Абая 150, Алматы',
    price: 16000,
    createdAt: '2026-02-06T10:00:00Z',
    guard: {
      name: 'Александр И.',
      rating: 4.9,
    },
  },
  {
    id: '2',
    status: 'completed' as const,
    serviceType: 'event_security',
    address: 'Дворец Республики, Алматы',
    price: 48000,
    createdAt: '2026-02-05T14:00:00Z',
    guard: {
      name: 'Сергей П.',
      rating: 4.7,
    },
  },
  {
    id: '3',
    status: 'new' as const,
    serviceType: 'property_patrol',
    address: 'КП Жетысу, Алматы',
    price: 9000,
    scheduledAt: '2026-02-08T09:00:00Z',
    createdAt: '2026-02-06T11:30:00Z',
  },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal('Активные');

  const filteredOrders = () => {
    switch (activeTab()) {
      case 'Активные':
        return orders.filter(o => ['new', 'accepted', 'in_progress'].includes(o.status));
      case 'Завершённые':
        return orders.filter(o => o.status === 'completed');
      default:
        return orders;
    }
  };

  const activeOrder = () => orders.find(o => o.status === 'in_progress');

  return (
    <div class="px-4 py-6">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Мои заказы</h1>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon name="plus" size="sm" />}
          onClick={() => navigate('/orders/create')}
        >
          Новый
        </Button>
      </div>

      {/* Active order tracking banner */}
      <Show when={activeOrder()}>
        {(order) => (
          <button
            onClick={() => navigate(`/tracking/${order().id}`)}
            class="w-full mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 flex items-center gap-3 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all active:scale-[0.98]"
          >
            {/* Pulsing indicator */}
            <div class="relative">
              <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Icon name="location" size="lg" class="text-white" />
              </div>
              <div class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-blue-600 animate-pulse" />
            </div>

            <div class="flex-1 text-left">
              <p class="text-white font-semibold">Охранник в пути</p>
              <p class="text-blue-200 text-sm">{order().guard?.name} • {order().address}</p>
            </div>

            <div class="text-right">
              <p class="text-white font-bold text-lg">~5 мин</p>
              <p class="text-blue-200 text-xs">Отследить →</p>
            </div>
          </button>
        )}
      </Show>

      {/* Tabs */}
      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <For each={tabs}>
          {(tab) => (
            <button
              onClick={() => setActiveTab(tab)}
              class={`
                px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${activeTab() === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }
              `}
            >
              {tab}
              <Show when={tab === 'Активные' && activeOrder()}>
                <span class="ml-1.5 w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Orders list */}
      <Show
        when={filteredOrders().length > 0}
        fallback={
          <div class="text-center py-12">
            <div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="shield" size="xl" class="text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">Заказов пока нет</h3>
            <p class="text-gray-500 mb-4">Закажите первую охранную услугу</p>
            <Button
              variant="primary"
              onClick={() => navigate('/orders/create')}
            >
              Создать заказ
            </Button>
          </div>
        }
      >
        <div class="space-y-3">
          <For each={filteredOrders()}>
            {(order) => (
              <div
                class={`${order.status === 'in_progress' ? 'ring-2 ring-blue-500/30 rounded-xl' : ''}`}
              >
                <OrderCard
                  {...order}
                  onClick={() =>
                    order.status === 'in_progress'
                      ? navigate(`/tracking/${order.id}`)
                      : navigate(`/orders/${order.id}`)
                  }
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
