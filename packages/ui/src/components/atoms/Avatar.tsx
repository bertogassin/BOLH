import { JSX, splitProps, Show, createMemo } from 'solid-js';

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
  class?: string;
}

export function Avatar(props: AvatarProps) {
  const [local] = splitProps(props, ['src', 'name', 'size', 'status', 'class']);

  const size = () => local.size || 'md';

  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const statusStyles = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
  };

  const statusSizeStyles = {
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-4 h-4 border-2',
  };

  const initials = createMemo(() => {
    if (!local.name) return '?';
    return local.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  const bgColor = createMemo(() => {
    if (!local.name) return 'bg-gray-300';
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const index = local.name.charCodeAt(0) % colors.length;
    return colors[index];
  });

  return (
    <div class={`relative inline-block ${local.class || ''}`}>
      <Show
        when={local.src}
        fallback={
          <div
            class={`
              ${sizeStyles[size()]}
              ${bgColor()}
              rounded-full flex items-center justify-center
              text-white font-medium
            `}
          >
            {initials()}
          </div>
        }
      >
        <img
          src={local.src}
          alt={local.name || 'Avatar'}
          class={`
            ${sizeStyles[size()]}
            rounded-full object-cover
          `}
        />
      </Show>
      
      <Show when={local.status}>
        <span
          class={`
            absolute bottom-0 right-0 block rounded-full
            ${statusStyles[local.status!]}
            ${statusSizeStyles[size()]}
            border-white
          `}
        />
      </Show>
    </div>
  );
}
