/**
 * Toast Notification Component
 * Shows temporary success/error/info messages
 */

import { createSignal, Show, onCleanup } from "solid-js";
import "./Toast.css";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);
let toastId = 0;

export function showToast(message: string, type: ToastType = "info", duration = 3000) {
  const id = toastId++;
  const toast = { id, message, type };
  
  setToasts((prev) => [...prev, toast]);
  
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, duration);
}

export function ToastContainer() {
  return (
    <div class="toast-container">
      {toasts().map((toast) => (
        <div class={`toast toast-${toast.type}`}>
          <div class="toast-icon">
            {toast.type === "success" && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M16.6667 5L7.50004 14.1667L3.33337 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            )}
            {toast.type === "error" && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            )}
            {toast.type === "info" && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 13V10M10 7H10.01M18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            )}
            {toast.type === "warning" && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 7V11M10 14H10.01M9 2L1.5 16.5C1.33565 16.8039 1.24958 17.1479 1.25149 17.4975C1.2534 17.8471 1.34321 18.1901 1.51074 18.4922C1.67828 18.7943 1.91738 19.0451 2.20633 19.2204C2.49529 19.3957 2.82427 19.4893 3.16 19.4917H16.84C17.1757 19.4893 17.5047 19.3957 17.7937 19.2204C18.0826 19.0451 18.3217 18.7943 18.4893 18.4922C18.6568 18.1901 18.7466 17.8471 18.7485 17.4975C18.7504 17.1479 18.6644 16.8039 18.5 16.5L11 2C10.8292 1.70446 10.5893 1.46007 10.3028 1.29149C10.0163 1.12292 9.6929 1.03564 9.36386 1.03711C9.03482 1.03858 8.71221 1.12874 8.42721 1.29986C8.14221 1.47099 7.90438 1.71749 7.736 2.015L9 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            )}
          </div>
          <span class="toast-message">{toast.message}</span>
          <button class="toast-close" onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
