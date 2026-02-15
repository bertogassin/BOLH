import { createSignal, For, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { SearchBar, GuardCard, Badge, Button, Icon } from '@guardio/ui';

// Mock data
const guards = [
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
  {
    id: 3,
    name: 'Дмитрий Козлов',
    rating: 4.5,
    totalReviews: 45,
    verificationLevel: 2,
    distanceKm: 2.3,
    hourlyRate: 5000,
    isAvailable: false,
    isOnline: false,
    specializations: ['Property Patrol'],
  },
];

const filters = ['All', 'Bodyguard', 'Event', 'Patrol', 'VIP'];

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = createSignal(searchParams.q || '');
  const [activeFilter, setActiveFilter] = createSignal('All');
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // TODO: Call API to search guards
  };

  return (
    <div class="px-4 py-6 space-y-4">
      {/* Search */}
      <SearchBar
        placeholder="Search guards..."
        value={searchQuery()}
        onChange={setSearchQuery}
        onSearch={handleSearch}
      />

      {/* Filters */}
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        <For each={filters}>
          {(filter) => (
            <button
              onClick={() => setActiveFilter(filter)}
              class={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                transition-colors duration-200
                ${activeFilter() === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {filter}
            </button>
          )}
        </For>
      </div>

      {/* Results header */}
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-500">
          {guards.length} guards found
        </p>
        <button class="flex items-center gap-1 text-sm text-gray-600">
          <Icon name="chevronDown" size="sm" />
          Sort by
        </button>
      </div>

      {/* Guards list */}
      <div class="space-y-3">
        <Show
          when={!isLoading()}
          fallback={
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
            </div>
          }
        >
          <For each={guards}>
            {(guard) => (
              <GuardCard
                {...guard}
                onClick={() => navigate(`/guards/${guard.id}`)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
