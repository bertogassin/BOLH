import { For, splitProps } from 'solid-js';

export interface RatingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  readonly?: boolean;
  onChange?: (value: number) => void;
  class?: string;
}

export function Rating(props: RatingProps) {
  const [local] = splitProps(props, [
    'value',
    'max',
    'size',
    'showValue',
    'readonly',
    'onChange',
    'class',
  ]);

  const max = () => local.max || 5;
  const size = () => local.size || 'md';

  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (index: number) => {
    if (!local.readonly && local.onChange) {
      local.onChange(index + 1);
    }
  };

  return (
    <div class={`flex items-center gap-1 ${local.class || ''}`}>
      <For each={Array(max()).fill(0)}>
        {(_, index) => {
          const filled = () => index() < Math.floor(local.value);
          const partial = () => !filled() && index() < local.value;

          return (
            <button
              type="button"
              disabled={local.readonly}
              onClick={() => handleClick(index())}
              class={`
                ${!local.readonly ? 'cursor-pointer hover:scale-110' : ''}
                transition-transform duration-150
              `}
            >
              <svg
                class={`${sizeStyles[size()]} ${filled() || partial() ? 'text-yellow-400' : 'text-gray-300'}`}
                fill={filled() ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          );
        }}
      </For>
      
      {local.showValue && (
        <span class="ml-1 text-sm font-medium text-gray-600">
          {local.value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
