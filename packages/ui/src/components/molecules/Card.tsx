import { JSX, splitProps, Show } from 'solid-js';

export interface CardProps {
  children: JSX.Element;
  title?: string;
  subtitle?: string;
  footer?: JSX.Element;
  onClick?: () => void;
  hoverable?: boolean;
  class?: string;
}

export function Card(props: CardProps) {
  const [local, rest] = splitProps(props, [
    'children',
    'title',
    'subtitle',
    'footer',
    'onClick',
    'hoverable',
    'class',
  ]);

  return (
    <div
      class={`
        bg-white rounded-xl shadow-md overflow-hidden
        ${local.hoverable ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}
        ${local.class || ''}
      `}
      onClick={local.onClick}
    >
      <Show when={local.title || local.subtitle}>
        <div class="px-4 py-3 border-b border-gray-100">
          <Show when={local.title}>
            <h3 class="text-lg font-semibold text-gray-900">{local.title}</h3>
          </Show>
          <Show when={local.subtitle}>
            <p class="text-sm text-gray-500 mt-0.5">{local.subtitle}</p>
          </Show>
        </div>
      </Show>
      
      <div class="p-4">
        {local.children}
      </div>
      
      <Show when={local.footer}>
        <div class="px-4 py-3 bg-gray-50 border-t border-gray-100">
          {local.footer}
        </div>
      </Show>
    </div>
  );
}
