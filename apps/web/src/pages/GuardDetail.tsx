import { useParams, useNavigate } from '@solidjs/router';
import { Avatar, Badge, Button, Card, Rating, Icon } from '@bolh/ui';

// Mock data
const guard = {
  id: 1,
  name: 'Александр Иванов',
  phone: '+7 707 123 4567',
  avatarUrl: undefined,
  rating: 4.9,
  totalReviews: 127,
  verificationLevel: 4,
  hourlyRate: 8000,
  isAvailable: true,
  isOnline: true,
  experienceYears: 8,
  completedOrders: 245,
  specializations: ['VIP Protection', 'Bodyguard', 'Event Security'],
  bio: 'Профессиональный охранник с 8-летним опытом работы. Бывший сотрудник спецподразделения. Сертифицированный телохранитель.',
  reviews: [
    { id: 1, author: 'Марат К.', rating: 5, text: 'Отличный профессионал!', date: '2026-02-01' },
    { id: 2, author: 'Айгерим Б.', rating: 5, text: 'Пунктуальный и ответственный', date: '2026-01-28' },
  ],
};

export default function GuardDetailPage() {
  const params = useParams();
  const navigate = useNavigate();

  const verificationLabel = () => {
    switch (guard.verificationLevel) {
      case 4: return 'Elite';
      case 3: return 'Premium';
      case 2: return 'Verified';
      default: return 'Basic';
    }
  };

  return (
    <div class="pb-24">
      {/* Header */}
      <div class="bg-gradient-to-b from-blue-600 to-blue-700 text-white px-4 pt-4 pb-20">
        <button
          onClick={() => navigate(-1)}
          class="flex items-center gap-2 text-white/80 hover:text-white mb-4"
        >
          <Icon name="arrowLeft" size="sm" />
          Back
        </button>
      </div>

      {/* Profile card */}
      <Card class="-mt-16 mx-4 relative">
        <div class="text-center pt-2 pb-4">
          <Avatar
            src={guard.avatarUrl}
            name={guard.name}
            size="xl"
            status={guard.isOnline ? 'online' : 'offline'}
            class="mx-auto border-4 border-white -mt-12"
          />
          
          <h1 class="text-xl font-bold text-gray-900 mt-3">{guard.name}</h1>
          
          <div class="flex items-center justify-center gap-2 mt-1">
            <Badge variant="warning" size="sm">{verificationLabel()}</Badge>
            {guard.isAvailable && (
              <Badge variant="success" size="sm">Available</Badge>
            )}
          </div>
          
          <div class="flex items-center justify-center gap-1 mt-2">
            <Rating value={guard.rating} size="sm" readonly />
            <span class="text-sm text-gray-500">({guard.totalReviews})</span>
          </div>
        </div>

        {/* Stats */}
        <div class="flex border-t border-gray-100 divide-x divide-gray-100">
          <div class="flex-1 py-3 text-center">
            <p class="text-lg font-bold text-gray-900">{guard.experienceYears}</p>
            <p class="text-xs text-gray-500">Years exp.</p>
          </div>
          <div class="flex-1 py-3 text-center">
            <p class="text-lg font-bold text-gray-900">{guard.completedOrders}</p>
            <p class="text-xs text-gray-500">Orders</p>
          </div>
          <div class="flex-1 py-3 text-center">
            <p class="text-lg font-bold text-blue-600">{guard.hourlyRate.toLocaleString()} ₸</p>
            <p class="text-xs text-gray-500">per hour</p>
          </div>
        </div>
      </Card>

      {/* Bio */}
      <div class="px-4 mt-4">
        <Card title="About">
          <p class="text-gray-600">{guard.bio}</p>
          
          <div class="flex flex-wrap gap-2 mt-4">
            {guard.specializations.map(spec => (
              <Badge variant="default">{spec}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* Reviews */}
      <div class="px-4 mt-4">
        <Card title="Reviews">
          {guard.reviews.map(review => (
            <div class="py-3 border-b border-gray-100 last:border-0">
              <div class="flex items-center justify-between">
                <p class="font-medium text-gray-900">{review.author}</p>
                <Rating value={review.rating} size="sm" readonly />
              </div>
              <p class="text-sm text-gray-600 mt-1">{review.text}</p>
              <p class="text-xs text-gray-400 mt-1">{review.date}</p>
            </div>
          ))}
        </Card>
      </div>

      {/* Bottom actions */}
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <div class="flex gap-3">
          <Button
            variant="outline"
            class="flex-1"
            leftIcon={<Icon name="chat" size="sm" />}
          >
            Message
          </Button>
          <Button
            variant="primary"
            class="flex-1"
            onClick={() => navigate(`/orders/create?guard=${guard.id}`)}
          >
            Book Now
          </Button>
        </div>
      </div>
    </div>
  );
}
