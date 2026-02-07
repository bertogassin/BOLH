import { splitProps } from 'solid-js';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}

export function Spinner(props: SpinnerProps) {
  const [local] = splitProps(props, ['size', 'class']);

  const size = () => local.size || 'md';

  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      class={`animate-spin ${sizeStyles[size()]} ${local.class || ''}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
