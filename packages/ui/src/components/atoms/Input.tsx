import { JSX, splitProps, Show, createSignal } from 'solid-js';

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  fullWidth?: boolean;
}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, [
    'label',
    'error',
    'hint',
    'leftIcon',
    'rightIcon',
    'fullWidth',
    'class',
    'type',
  ]);

  const [showPassword, setShowPassword] = createSignal(false);
  const isPassword = () => local.type === 'password';
  const inputType = () => {
    if (isPassword()) {
      return showPassword() ? 'text' : 'password';
    }
    return local.type;
  };

  return (
    <div class={`${local.fullWidth ? 'w-full' : ''}`}>
      <Show when={local.label}>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {local.label}
        </label>
      </Show>
      
      <div class="relative">
        <Show when={local.leftIcon}>
          <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {local.leftIcon}
          </div>
        </Show>
        
        <input
          {...rest}
          type={inputType()}
          class={`
            block w-full rounded-lg border
            px-4 py-2.5
            text-gray-900 placeholder:text-gray-400
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-50 disabled:text-gray-500
            ${local.leftIcon ? 'pl-10' : ''}
            ${local.rightIcon || isPassword() ? 'pr-10' : ''}
            ${local.error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }
            ${local.class || ''}
          `}
        />
        
        <Show when={isPassword()}>
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword(!showPassword())}
          >
            <Show when={showPassword()} fallback={
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }>
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </Show>
          </button>
        </Show>
        
        <Show when={!isPassword() && local.rightIcon}>
          <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {local.rightIcon}
          </div>
        </Show>
      </div>
      
      <Show when={local.error}>
        <p class="mt-1 text-sm text-red-600">{local.error}</p>
      </Show>
      
      <Show when={!local.error && local.hint}>
        <p class="mt-1 text-sm text-gray-500">{local.hint}</p>
      </Show>
    </div>
  );
}
