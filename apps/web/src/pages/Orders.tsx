import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { OrderCard, Button, Icon } from '@guardio/ui';

const tabs = ['Active', 'Completed', 'All'];

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
  const [activeTab, setActiveTab] = createSignal('Active');

  const filteredOrders = () => {
    switch (activeTab()) {
      case 'Active':
        return orders.filter(o => ['new', 'accepted', 'in_progress'].includes(o.status));
      case 'Completed':
        return orders.filter(o => o.status === 'completed');
      default:
        return orders;
    }
  };

  return (
    <div class="px-4 py-6">
      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">My Orders</h1>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon name="plus" size="sm" />}
          onClick={() => navigate('/orders/create')}
        >
          New Order
        </Button>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-gray-200 mb-4">
        <For each={tabs}>
          {(tab) => (
            <button
              onClick={() => setActiveTab(tab)}
              class={`
                px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${activeTab() === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab}
            </button>
          )}
        </For>
      </div>

      {/* Orders list */}
      <Show
        when={filteredOrders().length > 0}
        fallback={
          <div class="text-center py-12">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="shield" size="xl" class="text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">No orders yet</h3>
            <p class="text-gray-500 mb-4">Book your first security service</p>
            <Button
              variant="primary"
              onClick={() => navigate('/orders/create')}
            >
              Create Order
            </Button>
          </div>
        }
      >
        <div class="space-y-3">
          <For each={filteredOrders()}>
            {(order) => (
              <OrderCard
                {...order}
                onClick={() => navigate(`/orders/${order.id}`)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
