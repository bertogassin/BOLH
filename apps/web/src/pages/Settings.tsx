import { useNavigate } from '@solidjs/router';
import { Card, ListItem, Icon, Button } from '@bolh/ui';
import { themeStore } from '@bolh/ui/stores/theme';

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div class="px-4 py-6 space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Appearance */}
      <Card title="Appearance">
        <ListItem
          title="Dark Mode"
          subtitle={themeStore.state.mode === 'dark' ? 'On' : 'Off'}
          leftIcon={<Icon name="star" size="md" class="text-gray-400" />}
          rightContent={
            <button
              onClick={() => themeStore.toggle()}
              class={`
                relative w-12 h-6 rounded-full transition-colors
                ${themeStore.state.resolvedMode === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}
              `}
            >
              <span
                class={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                  ${themeStore.state.resolvedMode === 'dark' ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          }
        />
      </Card>

      {/* Notifications */}
      <Card title="Notifications">
        <ListItem
          title="Push Notifications"
          subtitle="Receive order updates"
          leftIcon={<Icon name="bell" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
          onClick={() => navigate('/settings/notifications')}
        />
        <div class="border-b border-gray-100 mx-4" />
        <ListItem
          title="Sound"
          subtitle="Alert sounds enabled"
          leftIcon={<Icon name="settings" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
          onClick={() => navigate('/settings/sound')}
        />
      </Card>

      {/* Security */}
      <Card title="Security">
        <ListItem
          title="Change Password"
          leftIcon={<Icon name="shield" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
          onClick={() => navigate('/settings/password')}
        />
        <div class="border-b border-gray-100 mx-4" />
        <ListItem
          title="Biometric Login"
          subtitle="Use fingerprint or face"
          leftIcon={<Icon name="user" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
          onClick={() => navigate('/settings/biometric')}
        />
      </Card>

      {/* About */}
      <Card title="About">
        <ListItem
          title="Privacy Policy"
          leftIcon={<Icon name="shield" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
        />
        <div class="border-b border-gray-100 mx-4" />
        <ListItem
          title="Terms of Service"
          leftIcon={<Icon name="check" size="md" class="text-gray-400" />}
          rightIcon={<Icon name="chevronRight" size="sm" />}
        />
        <div class="border-b border-gray-100 mx-4" />
        <ListItem
          title="Version"
          subtitle="2.0.0"
          leftIcon={<Icon name="settings" size="md" class="text-gray-400" />}
        />
      </Card>
    </div>
  );
}
