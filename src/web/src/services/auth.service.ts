/**
 * Authentication Service
 * 
 * Implements secure JWT token-based authentication with encryption, automatic refresh,
 * and role-based access control. Provides comprehensive session management and
 * security features as specified in the technical requirements.
 * 
 * @version 1.0.0
 */

import { ApiService } from './api.service';
import {
  IUserCredentials,
  IAuthTokens,
  IUser,
  IAuthState
} from '../interfaces/auth.interface';
import {
  AUTH_API_ENDPOINTS,
  AUTH_STORAGE_KEYS,
  AUTH_STATES,
  TOKEN_CONFIG
} from '../constants/auth.constants';
import CryptoJS from 'crypto-js'; // ^4.1.1

export class AuthService {
  private apiService: ApiService;
  private refreshTokenTimeout?: NodeJS.Timeout;
  private readonly encryptionKey: string;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
    this.encryptionKey = process.env.VITE_TOKEN_ENCRYPTION_KEY || 'default-key';
    this.initializeAuth();
  }

  /**
   * Initializes authentication state from secure storage
   */
  private async initializeAuth(): Promise<void> {
    try {
      const encryptedTokens = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
      if (encryptedTokens) {
        const tokens = this.decryptTokens(encryptedTokens);
        if (this.isTokenValid(tokens.accessToken)) {
          this.apiService.setAuthToken(tokens.accessToken);
          this.setupRefreshTimer(tokens);
          await this.getCurrentUser();
        } else {
          await this.refreshToken();
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.clearAuth();
    }
  }

  /**
   * Authenticates user with credentials and establishes secure session
   * @param credentials User login credentials
   * @returns Promise with authentication tokens
   */
  public async login(credentials: IUserCredentials): Promise<IAuthTokens> {
    try {
      // Validate credentials format
      if (!this.validateCredentials(credentials)) {
        throw new Error('Invalid credentials format');
      }

      const response = await this.apiService.post<IAuthTokens>(
        AUTH_API_ENDPOINTS.LOGIN,
        credentials
      );

      const tokens = response.data;
      this.apiService.setAuthToken(tokens.accessToken);
      
      // Encrypt tokens before storage
      const encryptedTokens = this.encryptTokens(tokens);
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, encryptedTokens);
      
      this.setupRefreshTimer(tokens);
      
      return tokens;
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  /**
   * Securely terminates user session and cleans up authentication state
   */
  public async logout(): Promise<void> {
    try {
      await this.apiService.post(AUTH_API_ENDPOINTS.LOGOUT);
    } finally {
      this.clearAuth();
    }
  }

  /**
   * Automatically refreshes access token with retry mechanism
   */
  public async refreshToken(): Promise<IAuthTokens> {
    try {
      const encryptedTokens = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
      if (!encryptedTokens) {
        throw new Error('No refresh token available');
      }

      const tokens = this.decryptTokens(encryptedTokens);
      
      const response = await this.apiService.post<IAuthTokens>(
        AUTH_API_ENDPOINTS.REFRESH_TOKEN,
        { refreshToken: tokens.refreshToken }
      );

      const newTokens = response.data;
      this.apiService.setAuthToken(newTokens.accessToken);
      
      const encryptedNewTokens = this.encryptTokens(newTokens);
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, encryptedNewTokens);
      
      this.setupRefreshTimer(newTokens);
      
      return newTokens;
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  /**
   * Retrieves and validates current user information with role
   */
  public async getCurrentUser(): Promise<IUser> {
    const response = await this.apiService.get<IUser>(AUTH_API_ENDPOINTS.CURRENT_USER);
    const user = response.data;
    
    // Store encrypted user data
    const encryptedUser = this.encryptData(JSON.stringify(user));
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, encryptedUser);
    
    return user;
  }

  /**
   * Sets up automatic token refresh timer
   */
  private setupRefreshTimer(tokens: IAuthTokens): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const expiresIn = tokens.expiresIn * 1000; // Convert to milliseconds
    const refreshTime = expiresIn - TOKEN_CONFIG.TOKEN_REFRESH_THRESHOLD * 1000;
    
    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().catch(console.error);
    }, refreshTime);
  }

  /**
   * Validates user credentials format and strength
   */
  private validateCredentials(credentials: IUserCredentials): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordMinLength = 8;
    
    return (
      emailRegex.test(credentials.email) &&
      credentials.password.length >= passwordMinLength
    );
  }

  /**
   * Encrypts authentication tokens for secure storage
   */
  private encryptTokens(tokens: IAuthTokens): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(tokens),
      this.encryptionKey
    ).toString();
  }

  /**
   * Decrypts authentication tokens from secure storage
   */
  private decryptTokens(encryptedTokens: string): IAuthTokens {
    const decrypted = CryptoJS.AES.decrypt(
      encryptedTokens,
      this.encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    
    return JSON.parse(decrypted);
  }

  /**
   * Encrypts generic data for secure storage
   */
  private encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  /**
   * Validates JWT token expiration
   */
  private isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Clears all authentication state and secure storage
   */
  private clearAuth(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    this.apiService.setAuthToken(null);
    
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }
}

// Export singleton instance
export default new AuthService(new ApiService());