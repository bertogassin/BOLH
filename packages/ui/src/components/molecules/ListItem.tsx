import { JSX, splitProps, Show } from 'solid-js';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  rightContent?: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  class?: string;
}

export function ListItem(props: ListItemProps) {
  const [local] = splitProps(props, [
    'title',
    'subtitle',
    'leftIcon',
    'rightIcon',
    'rightContent',
    'onClick',
    'disabled',
    'class',
  ]);

  return (
    <div
      class={`
        flex items-center gap-3 px-4 py-3
        ${local.onClick && !local.disabled
          ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100'
          : ''
        }
        ${local.disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${local.class || ''}
      `}
      onClick={!local.disabled ? local.onClick : undefined}
    >
      <Show when={local.leftIcon}>
        <div class="flex-shrink-0 text-gray-400">
          {local.leftIcon}
        </div>
      </Show>
      
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">
          {local.title}
        </p>
        <Show when={local.subtitle}>
          <p class="text-sm text-gray-500 truncate">
            {local.subtitle}
          </p>
        </Show>
      </div>
      
      <Show when={local.rightContent}>
        <div class="flex-shrink-0">
          {local.rightContent}
        </div>
      </Show>
      
      <Show when={local.rightIcon}>
        <div class="flex-shrink-0 text-gray-400">
          {local.rightIcon}
        </div>
      </Show>
    </div>
  );
}
