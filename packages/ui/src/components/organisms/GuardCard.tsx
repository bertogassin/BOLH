import { splitProps, Show } from 'solid-js';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Rating } from '../molecules/Rating';
import { Icon } from '../atoms/Icon';

export interface GuardCardProps {
  id: number;
  name: string;
  avatarUrl?: string;
  rating: number;
  totalReviews: number;
  verificationLevel: number;
  distanceKm?: number;
  hourlyRate: number;
  isAvailable: boolean;
  isOnline: boolean;
  specializations?: string[];
  onClick?: () => void;
  class?: string;
}

export function GuardCard(props: GuardCardProps) {
  const [local] = splitProps(props, [
    'id',
    'name',
    'avatarUrl',
    'rating',
    'totalReviews',
    'verificationLevel',
    'distanceKm',
    'hourlyRate',
    'isAvailable',
    'isOnline',
    'specializations',
    'onClick',
    'class',
  ]);

  const verificationLabel = () => {
    switch (local.verificationLevel) {
      case 4: return 'Elite';
      case 3: return 'Premium';
      case 2: return 'Verified';
      case 1: return 'Basic';
      default: return null;
    }
  };

  const verificationVariant = () => {
    switch (local.verificationLevel) {
      case 4: return 'warning';
      case 3: return 'primary';
      case 2: return 'success';
      default: return 'default';
    }
  };

  return (
    <div
      class={`
        bg-white rounded-xl shadow-md p-4
        ${local.onClick ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}
        ${local.class || ''}
      `}
      onClick={local.onClick}
    >
      <div class="flex items-start gap-3">
        <Avatar
          src={local.avatarUrl}
          name={local.name}
          size="lg"
          status={local.isOnline ? 'online' : 'offline'}
        />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-semibold text-gray-900 truncate">
              {local.name}
            </h3>
            <Show when={verificationLabel()}>
              <Badge variant={verificationVariant() as any} size="sm">
                {verificationLabel()}
              </Badge>
            </Show>
          </div>
          
          <div class="flex items-center gap-2 mt-1">
            <Rating value={local.rating} size="sm" readonly />
            <span class="text-sm text-gray-500">
              ({local.totalReviews})
            </span>
          </div>
          
          <Show when={local.distanceKm !== undefined}>
            <div class="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <Icon name="location" size="sm" />
              <span>{local.distanceKm!.toFixed(1)} km away</span>
            </div>
          </Show>
        </div>
        
        <div class="text-right">
          <p class="text-lg font-bold text-blue-600">
            {local.hourlyRate.toLocaleString()} ₸
          </p>
          <p class="text-xs text-gray-500">per hour</p>
        </div>
      </div>
      
      <Show when={local.specializations?.length}>
        <div class="flex flex-wrap gap-1 mt-3">
          {local.specializations!.slice(0, 3).map(spec => (
            <Badge variant="default" size="sm">
              {spec}
            </Badge>
          ))}
        </div>
      </Show>
      
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <Show
          when={local.isAvailable}
          fallback={
            <span class="text-sm text-gray-500">Currently unavailable</span>
          }
        >
          <span class="text-sm text-green-600 font-medium">Available now</span>
        </Show>
        
        <Icon name="chevronRight" size="md" class="text-gray-400" />
      </div>
    </div>
  );
}
