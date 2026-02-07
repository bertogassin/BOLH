import { splitProps, Show } from 'solid-js';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';

export interface OrderCardProps {
  id: string;
  status: 'new' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  serviceType: string;
  address: string;
  price: number;
  currency?: string;
  scheduledAt?: string;
  guard?: {
    name: string;
    avatarUrl?: string;
    rating: number;
  };
  createdAt: string;
  onClick?: () => void;
  class?: string;
}

export function OrderCard(props: OrderCardProps) {
  const [local] = splitProps(props, [
    'id',
    'status',
    'serviceType',
    'address',
    'price',
    'currency',
    'scheduledAt',
    'guard',
    'createdAt',
    'onClick',
    'class',
  ]);

  const statusConfig = {
    new: { label: 'New', variant: 'info' as const },
    accepted: { label: 'Accepted', variant: 'primary' as const },
    in_progress: { label: 'In Progress', variant: 'warning' as const },
    completed: { label: 'Completed', variant: 'success' as const },
    cancelled: { label: 'Cancelled', variant: 'error' as const },
  };

  const serviceTypeLabels: Record<string, string> = {
    bodyguard: 'Bodyguard',
    property_patrol: 'Property Patrol',
    event_security: 'Event Security',
    vehicle_escort: 'Vehicle Escort',
    personal_protection: 'Personal Protection',
    cctv_monitoring: 'CCTV Monitoring',
    alarm_response: 'Alarm Response',
    custom: 'Custom Service',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      class={`
        bg-white rounded-xl shadow-md overflow-hidden
        ${local.onClick ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}
        ${local.class || ''}
      `}
      onClick={local.onClick}
    >
      <div class="p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900">
                {serviceTypeLabels[local.serviceType] || local.serviceType}
              </h3>
              <Badge variant={statusConfig[local.status].variant} size="sm">
                {statusConfig[local.status].label}
              </Badge>
            </div>
            
            <div class="flex items-center gap-1 mt-1 text-sm text-gray-500">
              <Icon name="location" size="sm" />
              <span class="truncate">{local.address}</span>
            </div>
          </div>
          
          <div class="text-right">
            <p class="text-lg font-bold text-gray-900">
              {local.price.toLocaleString()} {local.currency || '₸'}
            </p>
          </div>
        </div>
        
        <Show when={local.guard}>
          <div class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <Avatar
              src={local.guard!.avatarUrl}
              name={local.guard!.name}
              size="sm"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900">{local.guard!.name}</p>
              <div class="flex items-center gap-1">
                <Icon name="star" size="sm" class="text-yellow-400" />
                <span class="text-sm text-gray-500">{local.guard!.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </Show>
        
        <div class="flex items-center justify-between mt-3 text-sm text-gray-500">
          <Show when={local.scheduledAt}>
            <span>Scheduled: {formatDate(local.scheduledAt!)}</span>
          </Show>
          <span>Created: {formatDate(local.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
