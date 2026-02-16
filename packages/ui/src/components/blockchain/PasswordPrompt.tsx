/**
 * Password Prompt Modal
 * For encrypting/decrypting private keys
 */

import { createSignal, Show } from "solid-js";
import "./PasswordPrompt.css";

export interface PasswordPromptProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  isConfirm?: boolean; // Show password strength indicator for new passwords
  onConfirm: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

export function PasswordPrompt(props: PasswordPromptProps) {
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

    const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e"];

    return {
      score: score,
      label: labels[score] || "Very Weak",
      color: colors[score] || "#ef4444",
    };
  };

  const handleConfirm = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (!password()) {
      setError("Password is required");
      return;
    }

    if (props.isConfirm) {
      if (password() !== confirmPassword()) {
        setError("Passwords do not match");
        return;
      }

      // Validate password strength
      const strength = getPasswordStrength(password());
      if (strength.score < 4) {
        setError(`Password is too weak (${strength.label}). Please choose a stronger password.`);
        return;
      }
    }

    try {
      setLoading(true);
      await props.onConfirm(password());
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    props.onCancel();
  };

  const strength = getPasswordStrength(password());

  return (
    <Show when={props.isOpen}>
      <div class="password-prompt-overlay">
        <div class="password-prompt-modal">
          <div class="password-header">
            <h2>{props.title}</h2>
            <Show when={props.subtitle}>
              <p class="password-subtitle">{props.subtitle}</p>
            </Show>
          </div>

          <form onSubmit={handleConfirm} class="password-form">
            {/* Password Input */}
            <div class="password-field">
              <label for="password">Password</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword() ? "text" : "password"}
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  placeholder="Enter password"
                  class="password-input"
                  disabled={loading()}
                  autocomplete="off"
                />
                <button
                  type="button"
                  class="toggle-visibility"
                  onClick={() => setShowPassword(!showPassword())}
                  disabled={loading()}
                  title={showPassword() ? "Hide password" : "Show password"}
                >
                  {showPassword() ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {/* Password Strength Indicator (for new passwords) */}
              <Show when={props.isConfirm && password()}>
                <div class="password-strength">
                  <div class="strength-bar">
                    <div
                      class="strength-fill"
                      style={{
                        width: `${(strength.score / 6) * 100}%`,
                        "background-color": strength.color,
                      }}
                    />
                  </div>
                  <span class="strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              </Show>
            </div>

            {/* Confirm Password (for new passwords) */}
            <Show when={props.isConfirm}>
              <div class="password-field">
                <label for="confirm-password">Confirm Password</label>
                <div class="password-input-wrapper">
                  <input
                    id="confirm-password"
                    type={showPassword() ? "text" : "password"}
                    value={confirmPassword()}
                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                    placeholder="Confirm password"
                    class="password-input"
                    disabled={loading()}
                    autocomplete="off"
                  />
                </div>

                <Show when={password() && confirmPassword() && password() === confirmPassword()}>
                  <p class="password-match">✓ Passwords match</p>
                </Show>
              </div>
            </Show>

            {/* Error Message */}
            <Show when={error()}>
              <div class="password-error">
                <span>⚠️ {error()}</span>
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="password-actions">
              <button
                type="button"
                class="password-btn cancel"
                onClick={handleCancel}
                disabled={loading()}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="password-btn confirm"
                disabled={loading() || !password()}
              >
                {loading() ? "Processing..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
