import { JSX, splitProps } from 'solid-js';

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: JSX.Element;
  class?: string;
}

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'children', 'class']);

  const variant = () => local.variant || 'default';
  const size = () => local.size || 'md';

  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-cyan-100 text-cyan-800',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      class={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles[variant()]}
        ${sizeStyles[size()]}
        ${local.class || ''}
      `}
    >
      {local.children}
    </span>
  );
}
