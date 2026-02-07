import { useNavigate } from '@solidjs/router';
import { Avatar, Card, ListItem, Icon, Button, Badge } from '@guardio/ui';
import { authStore } from '@guardio/ui/stores/auth';

const menuItems = [
  { id: 'edit', title: 'Edit Profile', icon: 'user', route: '/profile/edit' },
  { id: 'cards', title: 'Payment Methods', icon: 'wallet', route: '/profile/cards' },
  { id: 'subscription', title: 'Subscription', icon: 'star', route: '/subscription', badge: 'Free' },
  { id: 'favorites', title: 'Favorite Guards', icon: 'heart', route: '/favorites' },
  { id: 'settings', title: 'Settings', icon: 'settings', route: '/settings' },
  { id: 'help', title: 'Help & Support', icon: 'chat', route: '/help' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = () => authStore.state.user;

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  return (
    <div class="px-4 py-6 space-y-6">
      {/* Profile header */}
      <Card class="text-center">
        <div class="py-4">
          <Avatar
            src={user()?.avatarUrl}
            name={user()?.name}
            size="xl"
            class="mx-auto"
          />
          <h2 class="text-xl font-semibold text-gray-900 mt-4">
            {user()?.name}
          </h2>
          <p class="text-gray-500">{user()?.phone}</p>
          
          <div class="flex items-center justify-center gap-4 mt-4">
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">12</p>
              <p class="text-xs text-gray-500">Orders</p>
            </div>
            <div class="w-px h-10 bg-gray-200" />
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">4.9</p>
              <p class="text-xs text-gray-500">Rating</p>
            </div>
            <div class="w-px h-10 bg-gray-200" />
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">3</p>
              <p class="text-xs text-gray-500">Favorites</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Menu */}
      <Card>
        {menuItems.map((item, index) => (
          <>
            <ListItem
              title={item.title}
              leftIcon={<Icon name={item.icon} size="md" class="text-gray-400" />}
              rightIcon={<Icon name="chevronRight" size="sm" />}
              rightContent={item.badge ? <Badge variant="primary" size="sm">{item.badge}</Badge> : undefined}
              onClick={() => navigate(item.route)}
            />
            {index < menuItems.length - 1 && <div class="border-b border-gray-100 mx-4" />}
          </>
        ))}
      </Card>

      {/* Logout */}
      <Button
        variant="ghost"
        fullWidth
        class="text-red-600"
        onClick={handleLogout}
      >
        <Icon name="arrowLeft" size="sm" class="mr-2" />
        Log Out
      </Button>

      {/* App version */}
      <p class="text-center text-xs text-gray-400">
        Guardio v2.0.0
      </p>
    </div>
  );
}
