/**
 * BIP39 Seed Phrase Utility
 * Generate and restore wallets from seed phrases
 */

import CryptoJS from "crypto-js";
import * as bip39 from "bip39";

export interface SeedPhraseData {
  mnemonic: string;
  pubkey: string;
  seckey: string;
  address: string;
  createdAt: string;
}

/**
 * Generate a new 12-word BIP39 seed phrase
 */
export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(128); // 12 words
}

/**
 * Validate a BIP39 seed phrase
 */
export function validateSeedPhrase(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Convert seed phrase to secret key (simplified - uses entropy directly)
 */
export function seedPhraseToSecretKey(mnemonic: string): string {
  if (!validateSeedPhrase(mnemonic)) {
    throw new Error("Invalid seed phrase");
  }

  const entropy = bip39.mnemonicToEntropy(mnemonic);
  return entropy.substring(0, 64).padEnd(64, "0");
}

/**
 * Derive a public key from a secret key (demo deterministic derivation)
 */
export function derivePublicKey(seckey: string): string {
  return CryptoJS.SHA256(seckey).toString();
}

/**
 * Convert secret key back to seed phrase (creates recovery phrase)
 */
export function secretKeyToSeedPhrase(seckey: string): string {
  const entropy = seckey.substring(0, 32).padEnd(32, "0");

  try {
    const mnemonic = bip39.entropyToMnemonic(entropy);
    return mnemonic;
  } catch (error) {
    throw new Error("Failed to generate seed phrase from secret key");
  }
}

/**
 * Create a complete backup containing wallet information
 */
export function createWalletBackup(
  walletName: string,
  pubkey: string,
  seckey: string,
  address: string
): SeedPhraseData {
  const seedPhrase = secretKeyToSeedPhrase(seckey);

  return {
    mnemonic: seedPhrase,
    pubkey: pubkey,
    seckey: seckey,
    address: address,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Restore wallet from seed phrase
 */
export function restoreWalletFromSeedPhrase(mnemonic: string): {
  pubkey: string;
  seckey: string;
} {
  if (!validateSeedPhrase(mnemonic)) {
    throw new Error("Invalid seed phrase: Phrase does not match BIP39 word list");
  }

  try {
    const seckey = seedPhraseToSecretKey(mnemonic);
    const pubkey = derivePublicKey(seckey);
    return { pubkey, seckey };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to restore wallet: ${msg}`);
  }
}

/**
 * Format seed phrase for display (capitalize and split words)
 */
export function formatSeedPhrase(mnemonic: string): string[] {
  return mnemonic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Check seed phrase strength
 */
export function getSeedPhraseStrength(mnemonic: string): {
  strength: "weak" | "good" | "strong";
  details: string;
} {
  const words = formatSeedPhrase(mnemonic);
  const validFormat = validateSeedPhrase(mnemonic);

  if (!validFormat) {
    return {
      strength: "weak",
      details: "Invalid seed phrase format",
    };
  }

  if (words.length === 12) {
    return {
      strength: "good",
      details: "Standard 12-word phrase (128-bit entropy)",
    };
  }

  if (words.length === 24) {
    return {
      strength: "strong",
      details: "Extended 24-word phrase (256-bit entropy)",
    };
  }

  return {
    strength: "weak",
    details: `Unexpected word count: ${words.length}`,
  };
}
