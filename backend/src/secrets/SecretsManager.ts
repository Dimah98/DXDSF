/**
 * SecretsManager - API key encryption and secrets management
 *
 * Provides AES-256-GCM encryption for sensitive data stored in project files.
 * API keys are read from environment variables and never logged or sent to frontend.
 *
 * Requirements: 17, 18
 */

import crypto from 'crypto';

/** Encrypted value format: iv:authTag:ciphertext (all hex-encoded) */
type EncryptedString = string;

export interface SecretsManagerInterface {
  getSecret(key: string): string | undefined;
  setSecret(key: string, value: string): void;
  encrypt(text: string): EncryptedString;
  decrypt(encrypted: EncryptedString): string;
  encryptProjectSecrets(projectData: Record<string, unknown>): Record<string, unknown>;
  decryptProjectSecrets(projectData: Record<string, unknown>): Record<string, unknown>;
}

export class SecretsManager implements SecretsManagerInterface {
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly key: Buffer;

  /**
   * @param encryptionKey - Raw key material (min 32 chars). Defaults to ENCRYPTION_KEY env var.
   * @throws Error if no encryption key is available.
   */
  constructor(encryptionKey?: string) {
    const secret = encryptionKey ?? process.env['ENCRYPTION_KEY'];
    if (!secret) {
      throw new Error('ENCRYPTION_KEY is not set. Cannot initialize SecretsManager.');
    }
    // Derive a 32-byte key from the provided secret using scrypt
    this.key = crypto.scryptSync(secret, 'sf-bot-salt', 32);
  }

  /**
   * Read an API key or secret from environment variables.
   * Keys are never logged.
   */
  getSecret(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Set a secret in the current process environment.
   * Useful for injecting secrets at runtime without persisting to disk.
   */
  setSecret(key: string, value: string): void {
    process.env[key] = value;
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns a colon-separated string: iv:authTag:ciphertext (all hex).
   */
  encrypt(text: string): EncryptedString {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string previously encrypted with encrypt().
   * @throws Error if the ciphertext is tampered with or malformed.
   */
  decrypt(encrypted: EncryptedString): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format. Expected iv:authTag:ciphertext.');
    }

    const [ivHex, authTagHex, encryptedText] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt sensitive fields in a project data object before writing to disk.
   *
   * Encrypts the `apiKeys` field if present and not already encrypted.
   * The original object is not mutated — a shallow copy is returned.
   */
  encryptProjectSecrets(projectData: Record<string, unknown>): Record<string, unknown> {
    const result = { ...projectData };

    if (result['apiKeys'] !== undefined && result['apiKeys'] !== null) {
      // Only encrypt if not already an encrypted string
      if (typeof result['apiKeys'] !== 'string' || !this.isEncrypted(result['apiKeys'] as string)) {
        const serialized = typeof result['apiKeys'] === 'string'
          ? result['apiKeys']
          : JSON.stringify(result['apiKeys']);
        result['apiKeys'] = this.encrypt(serialized);
      }
    }

    // Also encrypt apiKey fields inside individual nodes
    if (Array.isArray(result['nodes'])) {
      result['nodes'] = (result['nodes'] as Array<Record<string, unknown>>).map(node => {
        if (
          node['data'] &&
          typeof node['data'] === 'object' &&
          (node['data'] as Record<string, unknown>)['apiKey'] &&
          typeof (node['data'] as Record<string, unknown>)['apiKey'] === 'string' &&
          !this.isEncrypted((node['data'] as Record<string, unknown>)['apiKey'] as string)
        ) {
          return {
            ...node,
            data: {
              ...(node['data'] as Record<string, unknown>),
              apiKey: this.encrypt((node['data'] as Record<string, unknown>)['apiKey'] as string),
            },
          };
        }
        return node;
      });
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in a project data object after loading from disk.
   *
   * Decrypts the `apiKeys` field if it is an encrypted string.
   * The original object is not mutated — a shallow copy is returned.
   */
  decryptProjectSecrets(projectData: Record<string, unknown>): Record<string, unknown> {
    const result = { ...projectData };

    if (typeof result['apiKeys'] === 'string' && this.isEncrypted(result['apiKeys'])) {
      try {
        const decrypted = this.decrypt(result['apiKeys']);
        // Try to parse as JSON; fall back to raw string
        try {
          result['apiKeys'] = JSON.parse(decrypted);
        } catch {
          result['apiKeys'] = decrypted;
        }
      } catch {
        // Leave as-is if decryption fails (e.g. wrong key)
        // Caller is responsible for handling this case
      }
    }

    // Also decrypt apiKey fields inside individual nodes
    if (Array.isArray(result['nodes'])) {
      result['nodes'] = (result['nodes'] as Array<Record<string, unknown>>).map(node => {
        const data = node['data'] as Record<string, unknown> | undefined;
        if (
          data &&
          typeof data['apiKey'] === 'string' &&
          this.isEncrypted(data['apiKey'])
        ) {
          try {
            return {
              ...node,
              data: {
                ...data,
                apiKey: this.decrypt(data['apiKey']),
              },
            };
          } catch {
            // Leave as-is if decryption fails
            return node;
          }
        }
        return node;
      });
    }

    return result;
  }

  /**
   * Heuristic check: an encrypted string has the format hex:hex:hex
   * with the first segment being 32 hex chars (16-byte IV).
   */
  private isEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    // IV is 16 bytes = 32 hex chars
    return /^[0-9a-f]{32}$/i.test(parts[0]);
  }
}

// Export a lazy singleton — only instantiated when first accessed,
// so tests can set ENCRYPTION_KEY before importing.
let _instance: SecretsManager | null = null;

export function getSecretsManager(): SecretsManager {
  if (!_instance) {
    _instance = new SecretsManager();
  }
  return _instance;
}

/** Reset the singleton (useful in tests). */
export function resetSecretsManager(): void {
  _instance = null;
}
