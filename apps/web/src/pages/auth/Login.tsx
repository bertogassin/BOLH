import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button, Input, Icon } from '@guardio/ui';
import { authStore } from '@guardio/ui/stores/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // TODO: Call actual API
      // const response = await api.login(phone(), password());
      
      // Mock login for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      authStore.login(
        {
          id: 1,
          phone: phone(),
          name: 'Test User',
          role: 'client',
        },
        'mock_access_token',
        'mock_refresh_token'
      );
      
      navigate('/');
    } catch (err) {
      setError('Invalid phone number or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex flex-col justify-center px-6 py-12 bg-white">
      <div class="mx-auto w-full max-w-sm">
        {/* Logo */}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Icon name="shield" size="xl" class="text-white" />
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Welcome to Guardio</h1>
          <p class="text-gray-500 mt-2">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="space-y-4">
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+7 (___) ___-__-__"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
            leftIcon={<Icon name="phone" size="sm" />}
            fullWidth
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            fullWidth
          />

          {error() && (
            <p class="text-sm text-red-600">{error()}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading()}
          >
            Sign In
          </Button>
        </form>

        {/* Forgot password */}
        <div class="mt-4 text-center">
          <button class="text-sm text-blue-600 hover:underline">
            Forgot password?
          </button>
        </div>

        {/* Divider */}
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200" />
          </div>
          <div class="relative flex justify-center">
            <span class="bg-white px-4 text-sm text-gray-500">or</span>
          </div>
        </div>

        {/* Register */}
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={() => navigate('/register')}
        >
          Create Account
        </Button>
      </div>
    </div>
  );
}
