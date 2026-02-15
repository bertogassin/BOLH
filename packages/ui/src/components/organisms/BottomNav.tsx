import { For, splitProps } from 'solid-js';
import { Icon } from '../atoms/Icon';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

export interface BottomNavProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  class?: string;
}

export function BottomNav(props: BottomNavProps) {
  const [local] = splitProps(props, ['items', 'activeId', 'onSelect', 'class']);

  return (
    <nav
      class={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white border-t border-gray-200
        safe-area-inset-bottom
        ${local.class || ''}
      `}
    >
      <div class="flex items-center justify-around h-16">
        <For each={local.items}>
          {(item) => {
            const isActive = () => local.activeId === item.id;

            return (
              <button
                type="button"
                onClick={() => local.onSelect(item.id)}
                class={`
                  flex flex-col items-center justify-center
                  w-full h-full
                  transition-colors duration-200
                  ${isActive() ? 'text-blue-600' : 'text-gray-500'}
                `}
              >
                <div class="relative">
                  <Icon
                    name={item.icon}
                    size="md"
                    class={isActive() ? 'text-blue-600' : 'text-gray-500'}
                  />
                  {item.badge && item.badge > 0 && (
                    <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span class={`text-xs mt-1 ${isActive() ? 'font-medium' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </nav>
  );
}
