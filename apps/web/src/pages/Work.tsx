import { useNavigate } from '@solidjs/router';
import { Icon } from '@guardio/ui';

// This page links to the existing professions/Discover system
// The "Работа" tab serves as a shortcut to professional services

export default function WorkPage() {
  const navigate = useNavigate();

  return (
    <div class="px-4 py-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Работа</h1>
      <p class="text-gray-500 text-sm mb-6">Выберите направление деятельности</p>

      <div class="space-y-3">
        <button
          onClick={() => navigate('/discover')}
          class="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-gray-100 dark:border-gray-700"
        >
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Icon name="search" size="md" class="text-blue-600" />
          </div>
          <div class="flex-1 text-left">
            <p class="font-medium text-gray-900 dark:text-white">Найти специалиста</p>
            <p class="text-xs text-gray-500">Поиск по всем профессиям</p>
          </div>
          <Icon name="chevronRight" size="sm" class="text-gray-400" />
        </button>

        <button
          onClick={() => navigate('/orders/create')}
          class="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-gray-100 dark:border-gray-700"
        >
          <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <Icon name="plus" size="md" class="text-green-600" />
          </div>
          <div class="flex-1 text-left">
            <p class="font-medium text-gray-900 dark:text-white">Создать заказ</p>
            <p class="text-xs text-gray-500">Опишите задачу и найдите исполнителя</p>
          </div>
          <Icon name="chevronRight" size="sm" class="text-gray-400" />
        </button>

        <button
          onClick={() => navigate('/orders')}
          class="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-gray-100 dark:border-gray-700"
        >
          <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Icon name="shield" size="md" class="text-amber-600" />
          </div>
          <div class="flex-1 text-left">
            <p class="font-medium text-gray-900 dark:text-white">Мои заказы</p>
            <p class="text-xs text-gray-500">Активные и завершённые заказы</p>
          </div>
          <Icon name="chevronRight" size="sm" class="text-gray-400" />
        </button>

        <button
          onClick={() => navigate('/marketplace')}
          class="w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] border border-gray-100 dark:border-gray-700"
        >
          <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <Icon name="briefcase" size="md" class="text-purple-600" />
          </div>
          <div class="flex-1 text-left">
            <p class="font-medium text-gray-900 dark:text-white">Маркетплейс</p>
            <p class="text-xs text-gray-500">Товары и услуги</p>
          </div>
          <Icon name="chevronRight" size="sm" class="text-gray-400" />
        </button>
      </div>
    </div>
  );
}
