import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Avatar, Card, ListItem, Icon, Button, Badge } from '@bolh/ui';
import { authStore } from '@bolh/ui/stores/auth';

type UserRole = 'client' | 'worker';
type VisibilityMode = 'on_map' | 'online_hidden' | 'offline';
type WorkStatus = 'ready' | 'busy' | 'inactive';
type EquipmentLevel = 'full' | 'partial' | 'none';
type MobilityType = 'car' | 'light' | 'walking';

const visibilityOptions: { value: VisibilityMode; label: string; description: string; icon: string; color: string }[] = [
  {
    value: 'on_map',
    label: 'На карте',
    description: 'Вы видны клиентам на карте',
    icon: 'location',
    color: 'bg-green-500',
  },
  {
    value: 'online_hidden',
    label: 'Онлайн, скрыт',
    description: 'Вы онлайн, но не видны на карте',
    icon: 'shield',
    color: 'bg-yellow-500',
  },
  {
    value: 'offline',
    label: 'Оффлайн',
    description: 'Вы не принимаете заказы',
    icon: 'close',
    color: 'bg-gray-500',
  },
];

// Worker questionnaire options
const workStatusOptions: { value: WorkStatus; label: string; icon: string; color: string }[] = [
  { value: 'ready', label: 'Готов к заказам', icon: 'check', color: 'bg-green-500' },
  { value: 'busy', label: 'Временно занят', icon: 'bell', color: 'bg-yellow-500' },
  { value: 'inactive', label: 'Неактивен', icon: 'close', color: 'bg-gray-500' },
];

const equipmentOptions: { value: EquipmentLevel; label: string; description: string; icon: string }[] = [
  { value: 'full', label: 'Полный комплект', description: 'Все инструменты при себе', icon: 'wrench' },
  { value: 'partial', label: 'Частичный набор', description: 'Основные инструменты', icon: 'wrench' },
  { value: 'none', label: 'Без инструментов', description: 'Работаю с инструментами клиента', icon: 'close' },
];

const mobilityOptions: { value: MobilityType; label: string; icon: string }[] = [
  { value: 'car', label: 'Автомобиль', icon: 'car' },
  { value: 'light', label: 'Лёгкий транспорт', icon: 'bike' },
  { value: 'walking', label: 'Пешком', icon: 'walking' },
];

// Document types for PRO verification
interface UserDocument {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'verified' | 'rejected';
  uploadedAt: string;
}

const mockDocuments: UserDocument[] = [
  { id: '1', name: 'Удостоверение личности', type: 'id', status: 'verified', uploadedAt: '2026-01-15' },
  { id: '2', name: 'Лицензия охранника', type: 'license', status: 'verified', uploadedAt: '2026-01-20' },
  { id: '3', name: 'Сертификат первой помощи', type: 'certificate', status: 'pending', uploadedAt: '2026-02-10' },
];

const clientMenuItems = [
  { id: 'edit', title: 'Редактировать профиль', icon: 'user', route: '/profile/edit' },
  { id: 'wallet', title: 'Wallet & Blockchain', icon: 'wallet', route: '/wallet' },
  { id: 'orders', title: 'Мои заказы', icon: 'shield', route: '/orders' },
  { id: 'favorites', title: 'Избранные специалисты', icon: 'heart', route: '/favorites' },
  { id: 'subscription', title: 'Подписка', icon: 'star', route: '/subscription', badge: 'Free' },
  { id: 'settings', title: 'Настройки', icon: 'settings', route: '/settings' },
  { id: 'help', title: 'Помощь и поддержка', icon: 'chat', route: '/help' },
];

const workerMenuItems = [
  { id: 'edit', title: 'Редактировать профиль', icon: 'user', route: '/profile/edit' },
  { id: 'specializations', title: 'Специализации', icon: 'shield', route: '/profile/specializations' },
  { id: 'schedule', title: 'Расписание', icon: 'bell', route: '/profile/schedule' },
  { id: 'wallet', title: 'Wallet & Blockchain', icon: 'wallet', route: '/wallet' },
  { id: 'reviews', title: 'Отзывы', icon: 'star', route: '/profile/reviews' },
  { id: 'documents', title: 'Документы', icon: 'camera', route: '/profile/documents' },
  { id: 'settings', title: 'Настройки', icon: 'settings', route: '/settings' },
  { id: 'help', title: 'Помощь и поддержка', icon: 'chat', route: '/help' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = () => authStore.state.user;
  const [role, setRole] = createSignal<UserRole>('client');
  const [visibility, setVisibility] = createSignal<VisibilityMode>('on_map');
  const [workStatus, setWorkStatus] = createSignal<WorkStatus>('ready');
  const [equipment, setEquipment] = createSignal<EquipmentLevel>('full');
  const [mobility, setMobility] = createSignal<MobilityType>('car');
  const [documents] = createSignal<UserDocument[]>(mockDocuments);
  const [showDocUpload, setShowDocUpload] = createSignal(false);

  const menuItems = () => role() === 'client' ? clientMenuItems : workerMenuItems;

  const isPro = () => documents().filter(d => d.status === 'verified').length >= 2;
  const verifiedCount = () => documents().filter(d => d.status === 'verified').length;
  const pendingCount = () => documents().filter(d => d.status === 'pending').length;

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  const handleRoleSwitch = () => {
    setRole(r => r === 'client' ? 'worker' : 'client');
  };

  const handleVisibilityChange = (mode: VisibilityMode) => {
    setVisibility(mode);
    // TODO: Send to server via API
  };

  return (
    <div class="px-4 py-6 space-y-4">
      {/* Profile header */}
      <Card class="text-center">
        <div class="py-4">
          <Avatar
            src={user()?.avatarUrl}
            name={user()?.name}
            size="xl"
            class="mx-auto"
          />
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-4">
            {user()?.name}
          </h2>
          <p class="text-gray-500">{user()?.phone}</p>

          {/* Role switcher */}
          <div class="flex items-center justify-center mt-3 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mx-auto max-w-xs">
            <button
              onClick={() => setRole('client')}
              class={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                role() === 'client'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Заказчик
            </button>
            <button
              onClick={() => setRole('worker')}
              class={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                role() === 'worker'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Специалист
            </button>
          </div>

          {/* Stats */}
          <div class="flex items-center justify-center gap-4 mt-4">
            {role() === 'client' ? (
              <>
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">12</p>
                  <p class="text-xs text-gray-500">Заказов</p>
                </div>
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">4.9</p>
                  <p class="text-xs text-gray-500">Рейтинг</p>
                </div>
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">3</p>
                  <p class="text-xs text-gray-500">Избранное</p>
                </div>
              </>
            ) : (
              <>
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">89</p>
                  <p class="text-xs text-gray-500">Выполнено</p>
                </div>
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">4.9</p>
                  <p class="text-xs text-gray-500">Рейтинг</p>
                </div>
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <p class="text-2xl font-bold text-gray-900 dark:text-white">340К</p>
                  <p class="text-xs text-gray-500">Заработок ₸</p>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Visibility control — only for workers */}
      {role() === 'worker' && (
        <Card>
          <div class="p-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon name="location" size="sm" class="text-gray-400" />
              Видимость на карте
            </h3>
            <div class="space-y-2">
              {visibilityOptions.map((opt) => (
                <button
                  onClick={() => handleVisibilityChange(opt.value)}
                  class={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    visibility() === opt.value
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                      : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div class={`w-8 h-8 ${opt.color} rounded-full flex items-center justify-center`}>
                    <Icon name={opt.icon} size="sm" class="text-white" />
                  </div>
                  <div class="flex-1 text-left">
                    <p class={`text-sm font-medium ${
                      visibility() === opt.value ? 'text-blue-600' : 'text-gray-900 dark:text-white'
                    }`}>
                      {opt.label}
                    </p>
                    <p class="text-xs text-gray-500">{opt.description}</p>
                  </div>
                  {visibility() === opt.value && (
                    <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Icon name="check" size="sm" class="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Worker Questionnaire — status, equipment, mobility */}
      {role() === 'worker' && (
        <Card>
          <div class="p-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon name="briefcase" size="sm" class="text-gray-400" />
              Анкета специалиста
            </h3>

            {/* Work Status */}
            <p class="text-xs text-gray-500 mb-2">Состояние</p>
            <div class="flex gap-2 mb-4">
              <For each={workStatusOptions}>
                {(opt) => (
                  <button
                    onClick={() => setWorkStatus(opt.value)}
                    class={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      workStatus() === opt.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 text-blue-600'
                        : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div class={`w-2 h-2 rounded-full ${opt.color}`} />
                    {opt.label}
                  </button>
                )}
              </For>
            </div>

            {/* Equipment */}
            <p class="text-xs text-gray-500 mb-2">Оснащение</p>
            <div class="space-y-1.5 mb-4">
              <For each={equipmentOptions}>
                {(opt) => (
                  <button
                    onClick={() => setEquipment(opt.value)}
                    class={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                      equipment() === opt.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <Icon name={opt.icon} size="sm" class={equipment() === opt.value ? 'text-blue-500' : 'text-gray-400'} />
                    <div class="text-left">
                      <p class={`text-sm font-medium ${equipment() === opt.value ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>{opt.label}</p>
                      <p class="text-xs text-gray-500">{opt.description}</p>
                    </div>
                    <Show when={equipment() === opt.value}>
                      <Icon name="check" size="sm" class="text-blue-500 ml-auto" />
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Mobility */}
            <p class="text-xs text-gray-500 mb-2">Мобильность</p>
            <div class="flex gap-2">
              <For each={mobilityOptions}>
                {(opt) => (
                  <button
                    onClick={() => setMobility(opt.value)}
                    class={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg transition-all ${
                      mobility() === opt.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent'
                    }`}
                  >
                    <Icon name={opt.icon} size="md" class={mobility() === opt.value ? 'text-blue-500' : 'text-gray-400'} />
                    <span class={`text-xs font-medium ${mobility() === opt.value ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      {opt.label}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Card>
      )}

      {/* Documents + PRO Status — only for workers */}
      {role() === 'worker' && (
        <Card>
          <div class="p-3">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon name="document" size="sm" class="text-gray-400" />
                Документы
                <Show when={isPro()}>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    <Icon name="verified" size="sm" class="text-white" />
                    PRO
                  </span>
                </Show>
              </h3>
              <button
                onClick={() => setShowDocUpload(!showDocUpload())}
                class="text-blue-600 text-xs font-medium flex items-center gap-1"
              >
                <Icon name="upload" size="sm" />
                Загрузить
              </button>
            </div>

            {/* PRO progress */}
            <Show when={!isPro()}>
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 mb-3">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs font-medium text-amber-800 dark:text-amber-300">До статуса PRO</span>
                  <span class="text-xs text-amber-600">{verifiedCount()}/2 документов</span>
                </div>
                <div class="w-full h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full">
                  <div
                    class="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(verifiedCount() / 2) * 100}%` }}
                  />
                </div>
                <p class="text-xs text-amber-700 dark:text-amber-400 mt-1.5">
                  Подтвердите 2 документа для получения PRO статуса
                </p>
              </div>
            </Show>

            {/* Document list */}
            <div class="space-y-2">
              <For each={documents()}>
                {(doc) => (
                  <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      doc.status === 'verified' ? 'bg-green-100 dark:bg-green-900/30' :
                      doc.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      <Icon
                        name={doc.status === 'verified' ? 'check' : doc.status === 'pending' ? 'bell' : 'close'}
                        size="sm"
                        class={
                          doc.status === 'verified' ? 'text-green-600' :
                          doc.status === 'pending' ? 'text-yellow-600' :
                          'text-red-600'
                        }
                      />
                    </div>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</p>
                      <p class="text-xs text-gray-500">{doc.uploadedAt}</p>
                    </div>
                    <Badge
                      variant={doc.status === 'verified' ? 'success' : doc.status === 'pending' ? 'warning' : 'danger'}
                      size="sm"
                    >
                      {doc.status === 'verified' ? 'Подтверждён' : doc.status === 'pending' ? 'На проверке' : 'Отклонён'}
                    </Badge>
                  </div>
                )}
              </For>
            </div>

            {/* Upload prompt */}
            <Show when={showDocUpload()}>
              <div class="mt-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center">
                <Icon name="upload" size="lg" class="text-gray-400 mx-auto mb-2" />
                <p class="text-sm text-gray-600 dark:text-gray-400">Нажмите для загрузки документа</p>
                <p class="text-xs text-gray-400 mt-1">PDF, JPG, PNG до 10 МБ</p>
                <Button variant="outline" size="sm" class="mt-3">
                  Выбрать файл
                </Button>
              </div>
            </Show>
          </div>
        </Card>
      )}

      {/* Menu */}
      <Card>
        {menuItems().map((item, index) => (
          <>
            <ListItem
              title={item.title}
              leftIcon={<Icon name={item.icon} size="md" class="text-gray-400" />}
              rightIcon={<Icon name="chevronRight" size="sm" />}
              rightContent={item.badge ? <Badge variant="primary" size="sm">{item.badge}</Badge> : undefined}
              onClick={() => navigate(item.route)}
            />
            {index < menuItems().length - 1 && <div class="border-b border-gray-100 dark:border-gray-800 mx-4" />}
          </>
        ))}
      </Card>

      {/* Quick order button for clients */}
      {role() === 'client' && (
        <Button
          variant="primary"
          fullWidth
          leftIcon={<Icon name="shield" size="sm" />}
          onClick={() => navigate('/orders/create')}
        >
          Заказать специалиста
        </Button>
      )}

      {/* Logout */}
      <Button
        variant="ghost"
        fullWidth
        class="text-red-600"
        onClick={handleLogout}
      >
        <Icon name="arrowLeft" size="sm" class="mr-2" />
        Выйти
      </Button>

      {/* App version */}
      <p class="text-center text-xs text-gray-400">
        BOLH v2.0.0
      </p>
    </div>
  );
}
