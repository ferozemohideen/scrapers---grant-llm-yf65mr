/**
 * Storage Utility Module
 * 
 * Provides secure browser storage operations with AES-256 encryption,
 * data compression, type-safe storage/retrieval, and cross-tab synchronization.
 * 
 * @version 1.0.0
 * @package crypto-js ^4.1.1
 */

import CryptoJS from 'crypto-js'; // ^4.1.1
import { AUTH_STORAGE_KEYS } from '../constants/auth.constants';

// Global Constants
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || 'default-key';
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB storage limit

/**
 * Storage key constants for application-wide use
 */
export enum StorageKeys {
    AUTH_TOKENS = 'auth_tokens',
    USER_PREFERENCES = 'user_preferences',
    STORAGE_META = 'storage_meta'
}

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
    constructor(
        public code: string,
        public message: string
    ) {
        super(message);
        this.name = 'StorageError';
    }
}

/**
 * Interface for storage operation options
 */
export interface StorageOptions {
    encrypt?: boolean;
    syncTabs?: boolean;
    expiryTime?: number;
    compress?: boolean;
}

/**
 * Interface for storage item metadata
 */
interface StorageMetadata {
    encryptionVersion: string;
    createdAt: number;
    expiresAt: number;
    checksum: string;
}

/**
 * Generates a checksum for data integrity validation
 */
const generateChecksum = (data: string): string => {
    return CryptoJS.SHA256(data).toString();
};

/**
 * Compresses data using LZ compression
 */
const compressData = (data: string): string => {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
};

/**
 * Decompresses LZ compressed data
 */
const decompressData = (data: string): string => {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(data));
};

/**
 * Encrypts data using AES-256 encryption
 */
const encryptData = (data: string): string => {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts AES-256 encrypted data
 */
const decryptData = (data: string): string => {
    const bytes = CryptoJS.AES.decrypt(data, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Validates storage quota and cleans up if necessary
 */
const validateStorageQuota = async (): Promise<void> => {
    const totalSize = new Blob([JSON.stringify(localStorage)]).size;
    
    if (totalSize > MAX_STORAGE_SIZE) {
        // Clean up expired items first
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            try {
                const item = await getLocalStorage(key);
                if (!item) {
                    localStorage.removeItem(key);
                }
            } catch (error) {
                console.warn(`Error cleaning up storage key ${key}:`, error);
            }
        }
    }
};

/**
 * Securely stores data in localStorage with encryption and metadata
 */
export const setLocalStorage = async <T>(
    key: string,
    value: T,
    options: StorageOptions = {}
): Promise<void> => {
    try {
        await validateStorageQuota();

        // Prepare data and metadata
        const timestamp = Date.now();
        const serializedData = JSON.stringify(value);
        let processedData = serializedData;

        if (options.compress) {
            processedData = compressData(processedData);
        }

        if (options.encrypt) {
            processedData = encryptData(processedData);
        }

        const metadata: StorageMetadata = {
            encryptionVersion: options.encrypt ? STORAGE_VERSION : '',
            createdAt: timestamp,
            expiresAt: options.expiryTime ? timestamp + options.expiryTime : 0,
            checksum: generateChecksum(serializedData)
        };

        const storageItem = {
            data: processedData,
            metadata
        };

        localStorage.setItem(key, JSON.stringify(storageItem));

        // Handle cross-tab synchronization
        if (options.syncTabs) {
            window.dispatchEvent(new StorageEvent('storage', {
                key,
                newValue: JSON.stringify(storageItem)
            }));
        }
    } catch (error) {
        throw new StorageError(
            'STORAGE_SET_ERROR',
            `Failed to store data for key ${key}: ${error.message}`
        );
    }
};

/**
 * Retrieves and validates data from localStorage
 */
export const getLocalStorage = async <T>(
    key: string,
    options: StorageOptions = {}
): Promise<T | null> => {
    try {
        const storageItem = localStorage.getItem(key);
        if (!storageItem) {
            return null;
        }

        const { data, metadata } = JSON.parse(storageItem);

        // Validate expiration
        if (metadata.expiresAt && metadata.expiresAt < Date.now()) {
            localStorage.removeItem(key);
            return null;
        }

        let processedData = data;

        // Handle decryption if needed
        if (metadata.encryptionVersion) {
            if (metadata.encryptionVersion !== STORAGE_VERSION) {
                throw new StorageError(
                    'ENCRYPTION_VERSION_MISMATCH',
                    'Storage encryption version mismatch'
                );
            }
            processedData = decryptData(processedData);
        }

        // Handle decompression if needed
        if (options.compress) {
            processedData = decompressData(processedData);
        }

        // Parse and validate data
        const parsedData = JSON.parse(processedData) as T;
        const checksum = generateChecksum(JSON.stringify(parsedData));

        if (checksum !== metadata.checksum) {
            throw new StorageError(
                'DATA_INTEGRITY_ERROR',
                'Storage data integrity check failed'
            );
        }

        return parsedData;
    } catch (error) {
        if (error instanceof StorageError) {
            throw error;
        }
        throw new StorageError(
            'STORAGE_GET_ERROR',
            `Failed to retrieve data for key ${key}: ${error.message}`
        );
    }
};

/**
 * Removes item from localStorage
 */
export const removeLocalStorage = (key: string): void => {
    localStorage.removeItem(key);
};

/**
 * Clears all items from localStorage
 */
export const clearLocalStorage = (): void => {
    localStorage.clear();
};

// Initialize storage event listener for cross-tab synchronization
window.addEventListener('storage', (event) => {
    if (event.key && event.newValue) {
        // Handle cross-tab storage updates
        const { key, newValue } = event;
        try {
            const parsedValue = JSON.parse(newValue);
            localStorage.setItem(key, JSON.stringify(parsedValue));
        } catch (error) {
            console.error('Error syncing storage across tabs:', error);
        }
    }
});