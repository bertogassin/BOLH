/**
 * Private Key Encryption Utility - AES-256
 * Secure wallet key storage with password protection
 */

import CryptoJS from "crypto-js";

export interface EncryptedKeyData {
  ciphertext: string;
  salt: string;
  iv: string;
  version: number;
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(
  password: string,
  salt: string,
  iterations: number = 10000
): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32, // 256 bits
    iterations: iterations,
  }).toString();
}

/**
 * Encrypt private key with password using AES-256
 */
export function encryptPrivateKey(
  privateKey: string,
  password: string
): EncryptedKeyData {
  // Generate random salt and IV
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
  const iv = CryptoJS.lib.WordArray.random(128 / 8).toString();

  // Derive encryption key from password
  const key = deriveKey(password, salt);

  // Encrypt the private key
  const encrypted = CryptoJS.AES.encrypt(privateKey, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    ciphertext: encrypted.toString(),
    salt: salt,
    iv: iv,
    version: 1,
  };
}

/**
 * Decrypt private key with password using AES-256
 */
export function decryptPrivateKey(
  encryptedData: EncryptedKeyData,
  password: string
): string {
  try {
    // Derive decryption key from password using same salt
    const key = deriveKey(password, encryptedData.salt);

    // Decrypt the ciphertext
    const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Convert decrypted data to string
    const privateKey = decrypted.toString(CryptoJS.enc.Utf8);

    // Verify decryption was successful (basic check)
    if (!privateKey || privateKey.length === 0) {
      throw new Error("Decryption failed: invalid password or corrupted data");
    }

    return privateKey;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decrypt key: ${msg}`);
  }
}

/**
 * Validate encryption password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Check if stored data is encrypted
 */
export function isEncrypted(data: any): data is EncryptedKeyData {
  return (
    data &&
    typeof data === "object" &&
    "ciphertext" in data &&
    "salt" in data &&
    "iv" in data &&
    "version" in data
  );
}
