/**
 * QR Code Modal Component
 * Displays QR codes for wallet addresses
 */

import { createEffect, createSignal, Show } from "solid-js";
import QRCode from "qrcode";
import "./QRModal.css";

interface QRModalProps {
  title?: string;
  value?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRModal(props: QRModalProps) {
  const [qrDataUrl, setQrDataUrl] = createSignal<string>("");
  const [generating, setGenerating] = createSignal(false);

  // Generate QR code when value changes
  createEffect(async () => {
    if (props.isOpen && props.value) {
      setGenerating(true);
      try {
        const dataUrl = await QRCode.toDataURL(props.value!, {
          errorCorrectionLevel: "H",
          type: "image/png",
          width: 300,
          margin: 2,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("Failed to generate QR code:", err);
      } finally {
        setGenerating(false);
      }
    }
  });

  return (
    <Show when={props.isOpen}>
      <div class="qr-modal-overlay" onClick={props.onClose}>
        <div class="qr-modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="qr-modal-header">
            <h3>{props.title || "QR Code"}</h3>
            <button class="qr-close-btn" onClick={props.onClose} title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="qr-modal-body">
            {generating() ? (
              <div class="qr-loading">
                <div class="qr-spinner"></div>
              </div>
            ) : (
              <Show when={qrDataUrl()}>
                <img src={qrDataUrl()} alt="QR Code" class="qr-image" />
              </Show>
            )}
          </div>

          <div class="qr-modal-footer">
            <p class="qr-address">{props.value}</p>
            <button class="qr-copy-btn" onClick={() => {
              if (props.value) {
                navigator.clipboard.writeText(props.value);
              }
            }}>
              Copy Address
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function QRButton(props: { value: string; title?: string }) {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <>
      <button
        class="qr-icon-btn"
        onClick={() => setIsOpen(true)}
        title={props.title || "Show QR code"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" />
          <rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" />
          <rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" />
          <circle cx="19" cy="19" r="2" fill="currentColor" />
        </svg>
      </button>
      <QRModal
        title="Wallet Address QR"
        value={props.value}
        isOpen={isOpen()}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
