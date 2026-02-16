import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, Button, Icon, Badge, ListItem } from '@bolh/ui';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Basic specialist discovery', '5 orders per month', 'Standard support'],
    isCurrent: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 4990,
    features: ['Unlimited discovery', '20 orders per month', 'Priority support', 'Order history'],
    recommended: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 9990,
    features: ['All Basic features', 'Unlimited orders', 'Preferred specialists', 'Real-time tracking', '24/7 support'],
    recommended: true,
  },
];

const paymentHistory = [
  { id: '1', date: '2026-02-01', description: 'Order #12345', amount: 16000, status: 'completed' },
  { id: '2', date: '2026-01-28', description: 'Order #12344', amount: 48000, status: 'completed' },
  { id: '3', date: '2026-01-25', description: 'Subscription - Basic', amount: 4990, status: 'completed' },
];

const savedCards = [
  { id: '1', lastFour: '4242', brand: 'Visa', isDefault: true },
  { id: '2', lastFour: '5555', brand: 'Mastercard', isDefault: false },
];

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = createSignal<string | null>(null);
  const [showAddCard, setShowAddCard] = createSignal(false);

  const handleUpgrade = (planId: string) => {
    setSelectedPlan(planId);
    // TODO: Show payment modal
  };

  return (
    <div class="px-4 py-6 pb-20 space-y-6">
      {/* Header */}
      <div class="flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">Payments & Subscription</h1>
      </div>

      {/* Current Plan */}
      <section>
        <h2 class="text-sm font-medium text-gray-500 mb-3 uppercase">Current Plan</h2>
        <Card class="border-2 border-blue-500">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900">Free Plan</h3>
                <Badge variant="primary">Active</Badge>
              </div>
              <p class="text-sm text-gray-500 mt-1">5 orders remaining this month</p>
            </div>
            <Button variant="primary" size="sm">
              Upgrade
            </Button>
          </div>
        </Card>
      </section>

      {/* Plans */}
      <section>
        <h2 class="text-sm font-medium text-gray-500 mb-3 uppercase">Available Plans</h2>
        <div class="space-y-3">
          <For each={plans}>
            {(plan) => (
              <Card 
                class={`
                  ${plan.recommended ? 'border-2 border-blue-500' : ''}
                  ${plan.isCurrent ? 'bg-gray-50' : ''}
                `}
              >
                <Show when={plan.recommended}>
                  <Badge variant="primary" class="mb-2">Recommended</Badge>
                </Show>
                
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="font-semibold text-gray-900">{plan.name}</h3>
                    <p class="text-2xl font-bold text-blue-600 mt-1">
                      {plan.price > 0 ? `${plan.price.toLocaleString()} ₸` : 'Free'}
                      <span class="text-sm font-normal text-gray-500">/month</span>
                    </p>
                  </div>
                  
                  <Show
                    when={!plan.isCurrent}
                    fallback={<Badge variant="success">Current</Badge>}
                  >
                    <Button
                      variant={plan.recommended ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      Select
                    </Button>
                  </Show>
                </div>

                <ul class="mt-3 space-y-2">
                  <For each={plan.features}>
                    {(feature) => (
                      <li class="flex items-center gap-2 text-sm text-gray-600">
                        <Icon name="check" size="sm" class="text-green-500" />
                        {feature}
                      </li>
                    )}
                  </For>
                </ul>
              </Card>
            )}
          </For>
        </div>
      </section>

      {/* Payment Methods */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-gray-500 uppercase">Payment Methods</h2>
          <button 
            class="text-sm text-blue-600"
            onClick={() => setShowAddCard(true)}
          >
            + Add Card
          </button>
        </div>
        
        <Card>
          <For each={savedCards}>
            {(card, index) => (
              <>
                <ListItem
                  title={`${card.brand} •••• ${card.lastFour}`}
                  subtitle={card.isDefault ? 'Default' : undefined}
                  leftIcon={<Icon name="wallet" size="md" class="text-gray-400" />}
                  rightContent={
                    <Show when={card.isDefault}>
                      <Badge variant="success" size="sm">Default</Badge>
                    </Show>
                  }
                />
                <Show when={index() < savedCards.length - 1}>
                  <div class="border-b border-gray-100 mx-4" />
                </Show>
              </>
            )}
          </For>
        </Card>
      </section>

      {/* Payment History */}
      <section>
        <h2 class="text-sm font-medium text-gray-500 mb-3 uppercase">Payment History</h2>
        <Card>
          <For each={paymentHistory}>
            {(payment, index) => (
              <>
                <ListItem
                  title={payment.description}
                  subtitle={payment.date}
                  rightContent={
                    <span class="font-semibold text-gray-900">
                      {payment.amount.toLocaleString()} ₸
                    </span>
                  }
                />
                <Show when={index() < paymentHistory.length - 1}>
                  <div class="border-b border-gray-100 mx-4" />
                </Show>
              </>
            )}
          </For>
        </Card>
      </section>
    </div>
  );
}
