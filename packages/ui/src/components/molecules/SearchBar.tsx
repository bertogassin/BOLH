import { JSX, splitProps, createSignal, Show } from 'solid-js';
import { Icon } from '../atoms/Icon';

export interface SearchBarProps {
  value?: string;
  placeholder?: string;
  onSearch?: (value: string) => void;
  onChange?: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  class?: string;
}

export function SearchBar(props: SearchBarProps) {
  const [local] = splitProps(props, [
    'value',
    'placeholder',
    'onSearch',
    'onChange',
    'onClear',
    'loading',
    'class',
  ]);

  const [internalValue, setInternalValue] = createSignal(local.value || '');

  const handleInput = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setInternalValue(value);
    local.onChange?.(value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      local.onSearch?.(internalValue());
    }
  };

  const handleClear = () => {
    setInternalValue('');
    local.onChange?.('');
    local.onClear?.();
  };

  return (
    <div class={`relative ${local.class || ''}`}>
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Show
          when={!local.loading}
          fallback={
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          }
        >
          <Icon name="search" size="md" />
        </Show>
      </div>
      
      <input
        type="text"
        value={internalValue()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={local.placeholder || 'Search...'}
        class="
          w-full pl-10 pr-10 py-2.5
          bg-gray-100 border-none rounded-full
          text-gray-900 placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white
          transition-all duration-200
        "
      />
      
      <Show when={internalValue()}>
        <button
          type="button"
          onClick={handleClear}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <Icon name="close" size="sm" />
        </button>
      </Show>
    </div>
  );
}
