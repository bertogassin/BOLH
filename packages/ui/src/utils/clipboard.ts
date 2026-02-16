/**
 * Clipboard utility for copying text
 */

import { showToast } from "../components/Toast";

export async function copyToClipboard(text: string, successMessage = "Copied to clipboard!") {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, "success", 2000);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        showToast(successMessage, "success", 2000);
        return true;
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
        textArea.remove();
        showToast("Failed to copy", "error");
        return false;
      }
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showToast("Failed to copy", "error");
    return false;
  }
}
