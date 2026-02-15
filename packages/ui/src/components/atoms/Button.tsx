import { JSX, splitProps, Show } from 'solid-js';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'fullWidth',
    'leftIcon',
    'rightIcon',
    'children',
    'class',
    'disabled',
  ]);

  const variant = () => local.variant || 'primary';
  const size = () => local.size || 'md';

  const baseStyles = `
    inline-flex items-center justify-center
    font-medium rounded-lg
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantStyles = {
    primary: `
      bg-blue-600 text-white
      hover:bg-blue-700
      focus:ring-blue-500
      active:bg-blue-800
    `,
    secondary: `
      bg-gray-200 text-gray-900
      hover:bg-gray-300
      focus:ring-gray-500
      active:bg-gray-400
    `,
    outline: `
      border-2 border-blue-600 text-blue-600
      hover:bg-blue-50
      focus:ring-blue-500
      active:bg-blue-100
    `,
    ghost: `
      text-gray-700
      hover:bg-gray-100
      focus:ring-gray-500
      active:bg-gray-200
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700
      focus:ring-red-500
      active:bg-red-800
    `,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5',
  };

  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      class={`
        ${baseStyles}
        ${variantStyles[variant()]}
        ${sizeStyles[size()]}
        ${local.fullWidth ? 'w-full' : ''}
        ${local.class || ''}
      `}
    >
      <Show when={local.loading}>
        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            stroke-width="4"
            fill="none"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </Show>
      
      <Show when={!local.loading && local.leftIcon}>
        {local.leftIcon}
      </Show>
      
      <span>{local.children}</span>
      
      <Show when={!local.loading && local.rightIcon}>
        {local.rightIcon}
      </Show>
    </button>
  );
}
