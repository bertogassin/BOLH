import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Avatar, Badge, Button, Icon, Card } from '@guardio/ui';
import { locationStore } from '@guardio/ui/stores/location';

// Mock guard data
const guard = {
  id: 1,
  name: 'Александр Иванов',
  phone: '+7 707 123 4567',
  rating: 4.9,
  avatarUrl: undefined,
};

export default function LiveTrackingPage() {
  const params = useParams();
  const navigate = useNavigate();
  
  const [guardLocation, setGuardLocation] = createSignal({ lat: 43.238, lng: 76.945 });
  const [eta, setEta] = createSignal('5 min');
  const [distance, setDistance] = createSignal('1.2 km');
  const [status, setStatus] = createSignal<'arriving' | 'arrived' | 'in_progress'>('arriving');

  let wsConnection: WebSocket | null = null;
  let movementInterval: ReturnType<typeof setInterval> | null = null;

  const closeConnection = () => {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  };

  onMount(() => {
    // Get user's current location
    locationStore.getCurrentPosition();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    // Simulate guard movement
    movementInterval = setInterval(() => {
      setGuardLocation(prev => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.001,
        lng: prev.lng + (Math.random() - 0.5) * 0.001,
      }));
      
      // Update ETA based on distance
      const minutes = Math.floor(Math.random() * 5) + 1;
      setEta(`${minutes} min`);
    }, 3000);
  });

  onCleanup(() => {
    if (movementInterval) clearInterval(movementInterval);
    closeConnection();
  });

  const connectWebSocket = () => {
    // TODO: Connect to actual WebSocket server
    // wsConnection = new WebSocket('wss://api.guardio.app/ws');
    // wsConnection.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.type === 'guard:location') {
    //     setGuardLocation({ lat: data.latitude, lng: data.longitude });
    //   }
    // };
  };

  const handleCall = () => {
    window.location.href = `tel:${guard.phone}`;
  };

  const handleMessage = () => {
    navigate(`/chat/${params.orderId}`);
  };

  const handleSOS = () => {
    // TODO: Trigger SOS alert
    alert('SOS alert sent to emergency contacts!');
  };

  return (
    <div class="h-screen flex flex-col">
      {/* Header */}
      <div class="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <div class="flex-1">
          <h1 class="font-semibold text-gray-900">Live Tracking</h1>
          <p class="text-sm text-gray-500">Order #{params.orderId}</p>
        </div>
        <button
          onClick={handleSOS}
          class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center"
        >
          <Icon name="sos" size="sm" class="text-white" />
        </button>
      </div>

      {/* Map placeholder */}
      <div class="flex-1 bg-gray-200 relative">
        {/* This would be replaced with an actual map component */}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center text-gray-500">
            <Icon name="location" size="xl" class="mx-auto mb-2" />
            <p>Map view</p>
            <p class="text-sm">Guard location: {guardLocation().lat.toFixed(4)}, {guardLocation().lng.toFixed(4)}</p>
          </div>
        </div>
        
        {/* Status badge */}
        <div class="absolute top-4 left-4 right-4">
          <div class="bg-white rounded-lg shadow-lg p-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Show
                when={status() === 'arriving'}
                fallback={
                  <Badge variant="success">
                    {status() === 'arrived' ? 'Arrived' : 'In Progress'}
                  </Badge>
                }
              >
                <Badge variant="primary">Guard en route</Badge>
              </Show>
              <span class="text-sm text-gray-600">{distance()} away</span>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-blue-600">{eta()}</p>
              <p class="text-xs text-gray-500">ETA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Guard info panel */}
      <div class="bg-white rounded-t-3xl shadow-lg -mt-6 relative z-10 p-4 pb-8">
        <div class="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        
        <div class="flex items-center gap-3 mb-4">
          <Avatar
            src={guard.avatarUrl}
            name={guard.name}
            size="lg"
            status="online"
          />
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900">{guard.name}</h3>
            <div class="flex items-center gap-1">
              <Icon name="star" size="sm" class="text-yellow-400" />
              <span class="text-sm text-gray-600">{guard.rating}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div class="space-y-3 mb-4">
          <div class="flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full ${status() !== 'arriving' ? 'bg-green-500' : 'bg-blue-500'}`} />
            <p class={`text-sm ${status() !== 'arriving' ? 'text-green-600' : 'text-gray-900'}`}>
              Guard accepted order
            </p>
            <span class="text-xs text-gray-400 ml-auto">10:30</span>
          </div>
          <div class="flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full ${status() === 'in_progress' ? 'bg-green-500' : 'bg-gray-300'}`} />
            <p class={`text-sm ${status() === 'arrived' || status() === 'in_progress' ? 'text-green-600' : 'text-gray-400'}`}>
              Guard arrived
            </p>
            <span class="text-xs text-gray-400 ml-auto">{status() !== 'arriving' ? '10:35' : '-'}</span>
          </div>
          <div class="flex items-center gap-3">
            <div class={`w-3 h-3 rounded-full ${status() === 'in_progress' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
            <p class={`text-sm ${status() === 'in_progress' ? 'text-gray-900' : 'text-gray-400'}`}>
              Service in progress
            </p>
          </div>
        </div>

        {/* Actions */}
        <div class="flex gap-3">
          <Button
            variant="outline"
            class="flex-1"
            leftIcon={<Icon name="phone" size="sm" />}
            onClick={handleCall}
          >
            Call
          </Button>
          <Button
            variant="primary"
            class="flex-1"
            leftIcon={<Icon name="chat" size="sm" />}
            onClick={handleMessage}
          >
            Message
          </Button>
        </div>
      </div>
    </div>
  );
}
