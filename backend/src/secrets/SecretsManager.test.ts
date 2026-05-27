/**
 * Unit tests for SecretsManager
 *
 * Tests AES-256-GCM encryption/decryption, scrypt key derivation,
 * project secrets encryption/decryption, and environment variable management.
 *
 * Requirements: 17, 18
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsManager, getSecretsManager, resetSecretsManager } from './SecretsManager';

// ─── Test Setup ──────────────────────────────────────────────────────────────

const TEST_KEY = 'test-encryption-key-at-least-32-characters-long';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('SecretsManager constructor', () => {
  it('initializes successfully with a provided encryption key', () => {
    expect(() => new SecretsManager(TEST_KEY)).not.toThrow();
  });

  it('initializes successfully using ENCRYPTION_KEY env variable', () => {
    const original = process.env['ENCRYPTION_KEY'];
    process.env['ENCRYPTION_KEY'] = TEST_KEY;
    try {
      expect(() => new SecretsManager()).not.toThrow();
    } finally {
      if (original === undefined) {
        delete process.env['ENCRYPTION_KEY'];
      } else {
        process.env['ENCRYPTION_KEY'] = original;
      }
    }
  });

  it('throws when no encryption key is available (Requirement 17.2)', () => {
    const original = process.env['ENCRYPTION_KEY'];
    delete process.env['ENCRYPTION_KEY'];
    try {
      expect(() => new SecretsManager()).toThrow('ENCRYPTION_KEY is not set');
    } finally {
      if (original !== undefined) {
        process.env['ENCRYPTION_KEY'] = original;
      }
    }
  });

  it('two instances with the same key produce compatible ciphertexts', () => {
    const sm1 = new SecretsManager(TEST_KEY);
    const sm2 = new SecretsManager(TEST_KEY);
    const encrypted = sm1.encrypt('hello');
    expect(sm2.decrypt(encrypted)).toBe('hello');
  });

  it('two instances with different keys cannot decrypt each other\'s ciphertexts', () => {
    const sm1 = new SecretsManager(TEST_KEY);
    const sm2 = new SecretsManager('another-key-that-is-at-least-32-chars-long!!');
    const encrypted = sm1.encrypt('secret');
    expect(() => sm2.decrypt(encrypted)).toThrow();
  });
});

// ─── encrypt / decrypt ───────────────────────────────────────────────────────

describe('encrypt', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('returns a non-empty string (Requirement 17.1)', () => {
    const result = sm.encrypt('hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a colon-separated iv:authTag:ciphertext format', () => {
    const result = sm.encrypt('hello');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/i);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/i);
    // Ciphertext is non-empty hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/i);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const c1 = sm.encrypt('same text');
    const c2 = sm.encrypt('same text');
    expect(c1).not.toBe(c2);
  });

  it('encrypts empty string without throwing', () => {
    expect(() => sm.encrypt('')).not.toThrow();
  });

  it('encrypts unicode text', () => {
    const text = 'Привіт 🌻 世界';
    const encrypted = sm.encrypt(text);
    expect(sm.decrypt(encrypted)).toBe(text);
  });

  it('encrypts long strings', () => {
    const longText = 'a'.repeat(10000);
    const encrypted = sm.encrypt(longText);
    expect(sm.decrypt(encrypted)).toBe(longText);
  });
});

describe('decrypt', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('correctly decrypts an encrypted string (Requirement 17.4)', () => {
    const plaintext = 'my-api-key-12345';
    const encrypted = sm.encrypt(plaintext);
    expect(sm.decrypt(encrypted)).toBe(plaintext);
  });

  it('throws for a malformed encrypted string (wrong number of parts)', () => {
    expect(() => sm.decrypt('onlyone')).toThrow('Invalid encrypted string format');
    expect(() => sm.decrypt('two:parts')).toThrow('Invalid encrypted string format');
    expect(() => sm.decrypt('four:parts:here:extra')).toThrow('Invalid encrypted string format');
  });

  it('throws when ciphertext is tampered with (GCM auth tag check)', () => {
    const encrypted = sm.encrypt('original');
    const parts = encrypted.split(':');
    // Flip the last character of the ciphertext
    const tampered = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
    const tamperedStr = `${parts[0]}:${parts[1]}:${tampered}`;
    expect(() => sm.decrypt(tamperedStr)).toThrow();
  });

  it('throws when auth tag is tampered with', () => {
    const encrypted = sm.encrypt('original');
    const parts = encrypted.split(':');
    const tamperedTag = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'a' ? 'b' : 'a');
    const tamperedStr = `${parts[0]}:${tamperedTag}:${parts[2]}`;
    expect(() => sm.decrypt(tamperedStr)).toThrow();
  });

  it('round-trips JSON strings correctly', () => {
    const obj = { apiKey: 'secret', farmId: '12345' };
    const json = JSON.stringify(obj);
    const encrypted = sm.encrypt(json);
    const decrypted = sm.decrypt(encrypted);
    expect(JSON.parse(decrypted)).toEqual(obj);
  });
});

// ─── getSecret / setSecret ───────────────────────────────────────────────────

describe('getSecret', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('returns the value of an existing environment variable (Requirement 18.1)', () => {
    process.env['TEST_API_KEY_SM'] = 'my-secret-value';
    try {
      expect(sm.getSecret('TEST_API_KEY_SM')).toBe('my-secret-value');
    } finally {
      delete process.env['TEST_API_KEY_SM'];
    }
  });

  it('returns undefined for a non-existent environment variable', () => {
    delete process.env['NONEXISTENT_KEY_XYZ'];
    expect(sm.getSecret('NONEXISTENT_KEY_XYZ')).toBeUndefined();
  });
});

describe('setSecret', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  afterEach(() => {
    delete process.env['RUNTIME_SECRET_TEST'];
  });

  it('sets a value in process.env', () => {
    sm.setSecret('RUNTIME_SECRET_TEST', 'runtime-value');
    expect(process.env['RUNTIME_SECRET_TEST']).toBe('runtime-value');
  });

  it('can be retrieved via getSecret after setSecret', () => {
    sm.setSecret('RUNTIME_SECRET_TEST', 'round-trip-value');
    expect(sm.getSecret('RUNTIME_SECRET_TEST')).toBe('round-trip-value');
  });
});

// ─── encryptProjectSecrets ───────────────────────────────────────────────────

describe('encryptProjectSecrets', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('encrypts the top-level apiKeys field (Requirement 17.3)', () => {
    const project = { apiKeys: { key1: 'value1' }, nodes: [] };
    const result = sm.encryptProjectSecrets(project);
    expect(typeof result['apiKeys']).toBe('string');
    expect(result['apiKeys']).not.toEqual(project.apiKeys);
  });

  it('does not mutate the original object', () => {
    const project = { apiKeys: { key1: 'value1' }, nodes: [] };
    const original = JSON.stringify(project);
    sm.encryptProjectSecrets(project);
    expect(JSON.stringify(project)).toBe(original);
  });

  it('does not re-encrypt an already-encrypted apiKeys field', () => {
    const project = { apiKeys: { key1: 'value1' }, nodes: [] };
    const once = sm.encryptProjectSecrets(project);
    const twice = sm.encryptProjectSecrets(once);
    // The encrypted string should be the same (already encrypted, not double-encrypted)
    expect(twice['apiKeys']).toBe(once['apiKeys']);
  });

  it('encrypts apiKey fields inside nodes (Requirement 17.3)', () => {
    const project = {
      nodes: [
        { id: '1', data: { apiKey: 'plain-api-key', url: 'https://example.com' } },
        { id: '2', data: { label: 'no key here' } },
      ],
    };
    const result = sm.encryptProjectSecrets(project);
    const nodes = result['nodes'] as Array<{ id: string; data: Record<string, unknown> }>;
    // Node with apiKey should be encrypted
    expect(typeof nodes[0].data['apiKey']).toBe('string');
    expect(nodes[0].data['apiKey']).not.toBe('plain-api-key');
    // Node without apiKey should be unchanged
    expect(nodes[1].data['label']).toBe('no key here');
    expect(nodes[1].data['apiKey']).toBeUndefined();
  });

  it('does not re-encrypt already-encrypted node apiKey fields', () => {
    const project = {
      nodes: [{ id: '1', data: { apiKey: 'plain-api-key' } }],
    };
    const once = sm.encryptProjectSecrets(project);
    const twice = sm.encryptProjectSecrets(once);
    const nodesOnce = once['nodes'] as Array<{ data: Record<string, unknown> }>;
    const nodesTwice = twice['nodes'] as Array<{ data: Record<string, unknown> }>;
    expect(nodesTwice[0].data['apiKey']).toBe(nodesOnce[0].data['apiKey']);
  });

  it('passes through projects without apiKeys or node apiKey fields unchanged', () => {
    const project = { nodes: [{ id: '1', data: { label: 'click' } }], edges: [] };
    const result = sm.encryptProjectSecrets(project);
    expect(result['apiKeys']).toBeUndefined();
    const nodes = result['nodes'] as Array<{ data: Record<string, unknown> }>;
    expect(nodes[0].data['apiKey']).toBeUndefined();
  });

  it('handles null apiKeys gracefully', () => {
    const project = { apiKeys: null, nodes: [] };
    expect(() => sm.encryptProjectSecrets(project as unknown as Record<string, unknown>)).not.toThrow();
  });
});

// ─── decryptProjectSecrets ───────────────────────────────────────────────────

describe('decryptProjectSecrets', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('decrypts the top-level apiKeys field (Requirement 17.4)', () => {
    const original = { apiKeys: { key1: 'value1', key2: 'value2' }, nodes: [] };
    const encrypted = sm.encryptProjectSecrets(original);
    const decrypted = sm.decryptProjectSecrets(encrypted);
    expect(decrypted['apiKeys']).toEqual(original.apiKeys);
  });

  it('decrypts apiKey fields inside nodes (Requirement 17.4)', () => {
    const original = {
      nodes: [
        { id: '1', data: { apiKey: 'my-secret-key', url: 'https://api.example.com' } },
      ],
    };
    const encrypted = sm.encryptProjectSecrets(original);
    const decrypted = sm.decryptProjectSecrets(encrypted);
    const nodes = decrypted['nodes'] as Array<{ data: Record<string, unknown> }>;
    expect(nodes[0].data['apiKey']).toBe('my-secret-key');
  });

  it('does not mutate the original object', () => {
    const original = { apiKeys: { key1: 'value1' }, nodes: [] };
    const encrypted = sm.encryptProjectSecrets(original);
    const encryptedCopy = JSON.stringify(encrypted);
    sm.decryptProjectSecrets(encrypted);
    expect(JSON.stringify(encrypted)).toBe(encryptedCopy);
  });

  it('passes through projects without encrypted fields unchanged', () => {
    const project = { nodes: [{ id: '1', data: { label: 'click' } }], edges: [] };
    const result = sm.decryptProjectSecrets(project);
    expect(result).toEqual(project);
  });

  it('leaves apiKeys unchanged if decryption fails (wrong key)', () => {
    const sm2 = new SecretsManager('another-key-that-is-at-least-32-chars-long!!');
    const original = { apiKeys: { key1: 'value1' }, nodes: [] };
    const encrypted = sm.encryptProjectSecrets(original);
    // sm2 cannot decrypt sm's ciphertext — should leave as-is without throwing
    expect(() => sm2.decryptProjectSecrets(encrypted)).not.toThrow();
    const result = sm2.decryptProjectSecrets(encrypted);
    // The apiKeys field should remain as the encrypted string
    expect(typeof result['apiKeys']).toBe('string');
  });

  it('full round-trip: encrypt then decrypt restores original data', () => {
    const original = {
      apiKeys: { sunflowerKey: 'eyJhbGciOiJIUzI1NiJ9.test', farmId: '12345' },
      nodes: [
        { id: '1', data: { apiKey: 'node-api-key-value', url: 'https://api.sunflower-land.com' } },
        { id: '2', data: { label: 'click', selector: '.button' } },
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }],
    };
    const encrypted = sm.encryptProjectSecrets(original);
    const decrypted = sm.decryptProjectSecrets(encrypted);
    expect(decrypted['apiKeys']).toEqual(original.apiKeys);
    const nodes = decrypted['nodes'] as Array<{ id: string; data: Record<string, unknown> }>;
    expect(nodes[0].data['apiKey']).toBe('node-api-key-value');
    expect(nodes[1].data['label']).toBe('click');
  });
});

// ─── Singleton helpers ────────────────────────────────────────────────────────

describe('getSecretsManager singleton', () => {
  beforeEach(() => {
    resetSecretsManager();
    process.env['ENCRYPTION_KEY'] = TEST_KEY;
  });

  afterEach(() => {
    resetSecretsManager();
  });

  it('returns the same instance on repeated calls', () => {
    const a = getSecretsManager();
    const b = getSecretsManager();
    expect(a).toBe(b);
  });

  it('returns a new instance after resetSecretsManager()', () => {
    const a = getSecretsManager();
    resetSecretsManager();
    const b = getSecretsManager();
    expect(a).not.toBe(b);
  });

  it('throws if ENCRYPTION_KEY is not set when first accessed', () => {
    resetSecretsManager();
    delete process.env['ENCRYPTION_KEY'];
    try {
      expect(() => getSecretsManager()).toThrow('ENCRYPTION_KEY is not set');
    } finally {
      process.env['ENCRYPTION_KEY'] = TEST_KEY;
    }
  });
});

// ─── Security: API keys never in plain text ───────────────────────────────────

describe('Security requirements', () => {
  let sm: SecretsManager;

  beforeEach(() => {
    sm = new SecretsManager(TEST_KEY);
  });

  it('encrypted project data does not contain the plain-text API key (Requirement 17.5, 17.6)', () => {
    const apiKey = 'super-secret-api-key-12345';
    const project = {
      nodes: [{ id: '1', data: { apiKey } }],
      apiKeys: { main: apiKey },
    };
    const encrypted = sm.encryptProjectSecrets(project);
    const serialized = JSON.stringify(encrypted);
    // The plain-text key must not appear in the serialized output
    expect(serialized).not.toContain(apiKey);
  });

  it('encrypted string is not the same as the original value (Requirement 17.1)', () => {
    const plaintext = 'my-api-key';
    const encrypted = sm.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });
});
