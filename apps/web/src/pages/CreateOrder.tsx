import { createSignal } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { Button, Input, Card, Icon, Badge } from '@guardio/ui';

const serviceTypes = [
  { id: 'bodyguard', label: 'Bodyguard', icon: 'shield', price: 5000 },
  { id: 'property_patrol', label: 'Property Patrol', icon: 'location', price: 3000 },
  { id: 'event_security', label: 'Event Security', icon: 'star', price: 4000 },
  { id: 'vehicle_escort', label: 'Vehicle Escort', icon: 'arrowRight', price: 6000 },
];

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedService, setSelectedService] = createSignal(searchParams.type || '');
  const [address, setAddress] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [duration, setDuration] = createSignal(1);
  const [isLoading, setIsLoading] = createSignal(false);

  const selectedServiceData = () => serviceTypes.find(s => s.id === selectedService());
  
  const totalPrice = () => {
    const service = selectedServiceData();
    return service ? service.price * duration() : 0;
  };

  const handleSubmit = async () => {
    if (!selectedService() || !address()) return;
    
    setIsLoading(true);
    try {
      // TODO: Call API to create order
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/orders');
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="px-4 py-6 pb-24">
      {/* Header */}
      <div class="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">New Order</h1>
      </div>

      {/* Service type */}
      <section class="mb-6">
        <h2 class="text-sm font-medium text-gray-700 mb-3">Select Service</h2>
        <div class="grid grid-cols-2 gap-3">
          {serviceTypes.map(service => (
            <button
              onClick={() => setSelectedService(service.id)}
              class={`
                p-4 rounded-xl border-2 text-left transition-all
                ${selectedService() === service.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <Icon
                name={service.icon}
                size="lg"
                class={selectedService() === service.id ? 'text-blue-600' : 'text-gray-400'}
              />
              <p class="font-medium text-gray-900 mt-2">{service.label}</p>
              <p class="text-sm text-blue-600">{service.price.toLocaleString()} ₸/hr</p>
            </button>
          ))}
        </div>
      </section>

      {/* Location */}
      <section class="mb-6">
        <Input
          label="Location"
          placeholder="Enter address"
          value={address()}
          onInput={(e) => setAddress(e.currentTarget.value)}
          leftIcon={<Icon name="location" size="sm" />}
          fullWidth
        />
      </section>

      {/* Duration */}
      <section class="mb-6">
        <h2 class="text-sm font-medium text-gray-700 mb-3">Duration (hours)</h2>
        <div class="flex items-center gap-4">
          <button
            onClick={() => setDuration(Math.max(1, duration() - 1))}
            class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Icon name="minus" size="sm" />
          </button>
          <span class="text-2xl font-bold w-12 text-center">{duration()}</span>
          <button
            onClick={() => setDuration(duration() + 1)}
            class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <Icon name="plus" size="sm" />
          </button>
        </div>
      </section>

      {/* Description */}
      <section class="mb-6">
        <Input
          label="Additional Notes (optional)"
          placeholder="Any special requirements..."
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          fullWidth
        />
      </section>

      {/* Summary */}
      <Card class="bg-gray-50 mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600">Service</span>
          <span class="font-medium">{selectedServiceData()?.label || '-'}</span>
        </div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-gray-600">Duration</span>
          <span class="font-medium">{duration()} hours</span>
        </div>
        <div class="border-t border-gray-200 my-3" />
        <div class="flex items-center justify-between">
          <span class="font-semibold text-gray-900">Total</span>
          <span class="text-xl font-bold text-blue-600">
            {totalPrice().toLocaleString()} ₸
          </span>
        </div>
      </Card>

      {/* Submit button */}
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading()}
          disabled={!selectedService() || !address()}
          onClick={handleSubmit}
        >
          Find Guard
        </Button>
      </div>
    </div>
  );
}
