import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button, Input, Icon } from '@bolh/ui';

type Role = 'client' | 'specialist';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = createSignal(1);
  const [role, setRole] = createSignal<Role>('client');
  const [phone, setPhone] = createSignal('');
  const [name, setName] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (password() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }
    
    setError('');
    setIsLoading(true);

    try {
      // TODO: Call actual API
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate('/login');
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="min-h-screen flex flex-col justify-center px-6 py-12 bg-white">
      <div class="mx-auto w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={() => step() > 1 ? setStep(step() - 1) : navigate('/login')}
          class="flex items-center gap-2 text-gray-600 mb-6"
        >
          <Icon name="arrowLeft" size="sm" />
          Back
        </button>

        {/* Title */}
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Create Account</h1>
        <p class="text-gray-500 mb-8">
          {step() === 1 ? 'Choose your account type' : 'Enter your details'}
        </p>

        {/* Step 1: Choose role */}
        {step() === 1 && (
          <div class="space-y-4">
            <button
              onClick={() => { setRole('client'); setStep(2); }}
              class={`
                w-full p-4 rounded-xl border-2 text-left transition-all
                ${role() === 'client' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Icon name="user" size="lg" class="text-blue-600" />
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">I need security</h3>
                  <p class="text-sm text-gray-500">Book specialists for your needs</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setRole('specialist'); setStep(2); }}
              class={`
                w-full p-4 rounded-xl border-2 text-left transition-all
                ${role() === 'specialist' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Icon name="shield" size="lg" class="text-green-600" />
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">I am a specialist</h3>
                  <p class="text-sm text-gray-500">Provide security services</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Enter details */}
        {step() === 2 && (
          <form onSubmit={handleSubmit} class="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Enter your name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              fullWidth
            />

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
              placeholder="Create a password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              hint="At least 8 characters"
              fullWidth
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
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
              Create Account
            </Button>

            <p class="text-xs text-gray-500 text-center">
              By creating an account, you agree to our{' '}
              <a href="#" class="text-blue-600">Terms of Service</a>
              {' '}and{' '}
              <a href="#" class="text-blue-600">Privacy Policy</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
