import { JSX, splitProps, Show } from 'solid-js';
import { Icon } from '../atoms/Icon';
import { Avatar } from '../atoms/Avatar';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showNotifications?: boolean;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  rightContent?: JSX.Element;
  user?: {
    name: string;
    avatarUrl?: string;
  };
  transparent?: boolean;
  class?: string;
}

export function Header(props: HeaderProps) {
  const [local] = splitProps(props, [
    'title',
    'subtitle',
    'showBack',
    'onBack',
    'showNotifications',
    'notificationCount',
    'onNotificationsClick',
    'rightContent',
    'user',
    'transparent',
    'class',
  ]);

  return (
    <header
      class={`
        sticky top-0 z-40
        ${local.transparent ? 'bg-transparent' : 'bg-white shadow-sm'}
        ${local.class || ''}
      `}
    >
      <div class="flex items-center justify-between h-14 px-4">
        <div class="flex items-center gap-3">
          <Show when={local.showBack}>
            <button
              type="button"
              onClick={local.onBack}
              class="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Icon name="arrowLeft" size="md" />
            </button>
          </Show>
          
          <Show when={local.user}>
            <Avatar
              src={local.user!.avatarUrl}
              name={local.user!.name}
              size="sm"
            />
          </Show>
          
          <div>
            <Show when={local.title}>
              <h1 class="text-lg font-semibold text-gray-900">{local.title}</h1>
            </Show>
            <Show when={local.subtitle}>
              <p class="text-sm text-gray-500">{local.subtitle}</p>
            </Show>
            <Show when={local.user && !local.title}>
              <p class="text-sm text-gray-500">Welcome back,</p>
              <p class="text-base font-semibold text-gray-900">{local.user!.name}</p>
            </Show>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={local.showNotifications}>
            <button
              type="button"
              onClick={local.onNotificationsClick}
              class="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Icon name="bell" size="md" />
              <Show when={local.notificationCount && local.notificationCount > 0}>
                <span class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {local.notificationCount! > 9 ? '9+' : local.notificationCount}
                </span>
              </Show>
            </button>
          </Show>
          
          <Show when={local.rightContent}>
            {local.rightContent}
          </Show>
        </div>
      </div>
    </header>
  );
}
