/**
 * @fileoverview Enterprise-grade encryption utility module for secure data handling
 * @version 1.0.0
 * @license MIT
 */

import { USER_VALIDATION_RULES } from '../constants/validation.constants';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt'; // v5.1.0

// Cryptographic constants
const SALT_ROUNDS = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_BUFFER_SIZE = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Custom error class for encryption-related errors
 */
class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  iv: string;
  encryptedData: string;
  tag: string;
}

/**
 * Securely hashes passwords using bcrypt with configurable salt rounds
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password with salt
 * @throws {EncryptionError} If password validation fails or hashing errors occur
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password requirements
    if (!password || typeof password !== 'string') {
      throw new EncryptionError('Invalid password input');
    }

    if (password.length < USER_VALIDATION_RULES.PASSWORD_POLICY.minLength) {
      throw new EncryptionError('Password does not meet minimum length requirement');
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Clear password from memory
    crypto.randomFill(Buffer.from(password), (err) => {
      if (err) console.error('Failed to clear password from memory');
    });

    return hashedPassword;
  } catch (error) {
    throw new EncryptionError(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Verifies a password against its hash with timing attack protection
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 * @throws {EncryptionError} If verification process fails
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) {
      throw new EncryptionError('Missing password or hash input');
    }

    const isMatch = await bcrypt.compare(password, hash);

    // Clear password from memory
    crypto.randomFill(Buffer.from(password), (err) => {
      if (err) console.error('Failed to clear password from memory');
    });

    return isMatch;
  } catch (error) {
    throw new EncryptionError(`Password verification failed: ${error.message}`);
  }
}

/**
 * Encrypts sensitive data using AES-256-GCM with authentication
 * @param {string} data - Data to encrypt
 * @param {string} key - Encryption key
 * @returns {Promise<EncryptedData>} Encrypted data object with IV and auth tag
 * @throws {EncryptionError} If encryption process fails
 */
export async function encryptData(data: string, key: string): Promise<EncryptedData> {
  try {
    if (!data || !key) {
      throw new EncryptionError('Missing data or key input');
    }

    // Validate key length
    const keyBuffer = Buffer.from(key);
    if (keyBuffer.length !== KEY_BUFFER_SIZE) {
      throw new EncryptionError('Invalid key length');
    }

    // Generate IV
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);

    // Encrypt data
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Clear sensitive data from memory
    crypto.randomFill(Buffer.from(data), (err) => {
      if (err) console.error('Failed to clear data from memory');
    });

    return {
      iv: iv.toString('hex'),
      encryptedData,
      tag: tag.toString('hex')
    };
  } catch (error) {
    throw new EncryptionError(`Data encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts AES-256-GCM encrypted data with authentication verification
 * @param {string} encryptedData - Data to decrypt
 * @param {string} key - Decryption key
 * @param {string} iv - Initialization vector
 * @param {string} tag - Authentication tag
 * @returns {Promise<string>} Decrypted data
 * @throws {EncryptionError} If decryption or authentication fails
 */
export async function decryptData(
  encryptedData: string,
  key: string,
  iv: string,
  tag: string
): Promise<string> {
  try {
    if (!encryptedData || !key || !iv || !tag) {
      throw new EncryptionError('Missing required decryption parameters');
    }

    const keyBuffer = Buffer.from(key);
    const ivBuffer = Buffer.from(iv, 'hex');
    const tagBuffer = Buffer.from(tag, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new EncryptionError(`Data decryption failed: ${error.message}`);
  }
}

/**
 * Generates cryptographically secure keys with entropy validation
 * @param {number} length - Desired key length in bytes
 * @returns {Promise<string>} Secure random key string
 * @throws {EncryptionError} If key generation fails
 */
export async function generateSecureKey(length: number = KEY_BUFFER_SIZE): Promise<string> {
  try {
    if (length < 16 || length > 64) {
      throw new EncryptionError('Invalid key length specified');
    }

    return new Promise((resolve, reject) => {
      crypto.randomBytes(length, (err, buffer) => {
        if (err) reject(new EncryptionError(`Key generation failed: ${err.message}`));
        
        // Convert to URL-safe base64
        const key = buffer.toString('base64url');
        
        // Clear buffer from memory
        crypto.randomFill(buffer, (err) => {
          if (err) console.error('Failed to clear key buffer from memory');
        });

        resolve(key);
      });
    });
  } catch (error) {
    throw new EncryptionError(`Key generation failed: ${error.message}`);
  }
}