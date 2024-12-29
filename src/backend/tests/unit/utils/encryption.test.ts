/**
 * @fileoverview Unit tests for encryption utilities
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  generateSecureKey
} from '../../src/utils/encryption.util';

// Test constants
const TEST_PASSWORD = 'TestP@ssw0rd123!$';
const TEST_DATA = 'Sensitive test data for encryption verification';
const TEST_KEY_LENGTH = 32;
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

describe('Password Hashing', () => {
  test('should hash password with correct salt rounds', async () => {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    expect(hashedPassword).toBeDefined();
    expect(hashedPassword.startsWith('$2b$')).toBeTruthy();
    expect(hashedPassword.split('$')[2]).toBe(SALT_ROUNDS.toString());
  });

  test('should enforce minimum password length', async () => {
    const weakPassword = 'weak';
    await expect(hashPassword(weakPassword)).rejects.toThrow('Password does not meet minimum length requirement');
  });

  test('should reject invalid password inputs', async () => {
    await expect(hashPassword('')).rejects.toThrow('Invalid password input');
    await expect(hashPassword(null as any)).rejects.toThrow('Invalid password input');
    await expect(hashPassword(undefined as any)).rejects.toThrow('Invalid password input');
  });

  test('should generate unique hashes for same password', async () => {
    const hash1 = await hashPassword(TEST_PASSWORD);
    const hash2 = await hashPassword(TEST_PASSWORD);
    expect(hash1).not.toBe(hash2);
  });

  test('should verify password correctly', async () => {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const isValid = await verifyPassword(TEST_PASSWORD, hashedPassword);
    expect(isValid).toBeTruthy();
  });

  test('should reject incorrect passwords', async () => {
    const hashedPassword = await hashPassword(TEST_PASSWORD);
    const isValid = await verifyPassword('WrongPassword123!@#', hashedPassword);
    expect(isValid).toBeFalsy();
  });

  test('should handle special characters in passwords', async () => {
    const specialPassword = '!@#$%^&*()_+{}:"<>?';
    const hashedPassword = await hashPassword(specialPassword + '123ABCdef');
    const isValid = await verifyPassword(specialPassword + '123ABCdef', hashedPassword);
    expect(isValid).toBeTruthy();
  });
});

describe('Data Encryption', () => {
  let encryptionKey: string;

  beforeEach(async () => {
    encryptionKey = await generateSecureKey(TEST_KEY_LENGTH);
  });

  test('should encrypt and decrypt data correctly', async () => {
    const encrypted = await encryptData(TEST_DATA, encryptionKey);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = await decryptData(
      encrypted.encryptedData,
      encryptionKey,
      encrypted.iv,
      encrypted.tag
    );
    expect(decrypted).toBe(TEST_DATA);
  });

  test('should generate unique IVs for same data', async () => {
    const encrypted1 = await encryptData(TEST_DATA, encryptionKey);
    const encrypted2 = await encryptData(TEST_DATA, encryptionKey);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  test('should reject invalid encryption parameters', async () => {
    await expect(encryptData('', encryptionKey)).rejects.toThrow('Missing data or key input');
    await expect(encryptData(TEST_DATA, '')).rejects.toThrow('Missing data or key input');
  });

  test('should reject invalid decryption parameters', async () => {
    const encrypted = await encryptData(TEST_DATA, encryptionKey);
    await expect(decryptData(
      encrypted.encryptedData,
      encryptionKey,
      'invalid-iv',
      encrypted.tag
    )).rejects.toThrow();
  });

  test('should reject tampered authentication tags', async () => {
    const encrypted = await encryptData(TEST_DATA, encryptionKey);
    const tamperedTag = Buffer.from(encrypted.tag).fill(0).toString('hex');
    await expect(decryptData(
      encrypted.encryptedData,
      encryptionKey,
      encrypted.iv,
      tamperedTag
    )).rejects.toThrow();
  });

  test('should handle different data types and lengths', async () => {
    const testCases = [
      'Short string',
      'A'.repeat(1000),
      JSON.stringify({ complex: 'object', with: ['arrays', 'and', 'nested', { data: true }] }),
      Buffer.from('Binary data').toString('base64')
    ];

    for (const testData of testCases) {
      const encrypted = await encryptData(testData, encryptionKey);
      const decrypted = await decryptData(
        encrypted.encryptedData,
        encryptionKey,
        encrypted.iv,
        encrypted.tag
      );
      expect(decrypted).toBe(testData);
    }
  });
});

describe('Key Generation', () => {
  test('should generate keys with correct length', async () => {
    const key = await generateSecureKey(TEST_KEY_LENGTH);
    const decodedKey = Buffer.from(key, 'base64url');
    expect(decodedKey.length).toBe(TEST_KEY_LENGTH);
  });

  test('should generate unique keys', async () => {
    const key1 = await generateSecureKey(TEST_KEY_LENGTH);
    const key2 = await generateSecureKey(TEST_KEY_LENGTH);
    expect(key1).not.toBe(key2);
  });

  test('should reject invalid key lengths', async () => {
    await expect(generateSecureKey(8)).rejects.toThrow('Invalid key length specified');
    await expect(generateSecureKey(100)).rejects.toThrow('Invalid key length specified');
  });

  test('should generate URL-safe base64 keys', async () => {
    const key = await generateSecureKey(TEST_KEY_LENGTH);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('should handle concurrent key generation', async () => {
    const promises = Array(10).fill(null).map(() => generateSecureKey(TEST_KEY_LENGTH));
    const keys = await Promise.all(promises);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test('should use default key length when not specified', async () => {
    const key = await generateSecureKey();
    const decodedKey = Buffer.from(key, 'base64url');
    expect(decodedKey.length).toBe(32); // Default KEY_BUFFER_SIZE
  });
});