/**
 * Spinner Component
 * Animated loading indicator for async operations
 */

import "./Spinner.css";

interface SpinnerProps {
  size?: "small" | "medium" | "large";
  color?: "primary" | "success" | "error";
}

export function Spinner(props: SpinnerProps) {
  const size = props.size || "medium";
  const color = props.color || "primary";

  return (
    <div class={`spinner spinner-${size} spinner-${color}`}>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
    </div>
  );
}

export function LoadingOverlay(props: { message?: string }) {
  return (
    <div class="loading-overlay">
      <div class="loading-content">
        <Spinner size="large" />
        {props.message && <div class="loading-message">{props.message}</div>}
      </div>
    </div>
  );
}

export function SkeletonLoader(props: { width?: string; height?: string; count?: number }) {
  const count = props.count || 1;
  const items = Array.from({ length: count });

  return (
    <>
      {items.map(() => (
        <div
          class="skeleton"
          style={{
            width: props.width || "100%",
            height: props.height || "20px",
          }}
        ></div>
      ))}
    </>
  );
}
