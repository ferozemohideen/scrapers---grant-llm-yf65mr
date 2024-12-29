/**
 * @fileoverview Enhanced User Repository with comprehensive security and validation
 * @version 1.0.0
 * @license MIT
 */

import { FilterQuery, UpdateQuery, ClientSession } from 'mongoose'; // v6.9.0
import { User, IUser } from '../models/user.model';
import { UserRole } from '../../interfaces/auth.interface';
import { USER_VALIDATION_RULES } from '../../constants/validation.constants';
import { Logger } from '../../utils/logger.util';
import { EncryptionError } from '../../utils/encryption.util';

/**
 * Custom error class for repository operations
 */
class UserRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserRepositoryError';
  }
}

/**
 * Enhanced repository class for secure user data operations
 */
export class UserRepository {
  private readonly model = User;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Securely find user by ID with enhanced validation
   * @param id - User ID to find
   * @returns Promise resolving to user document or null
   * @throws UserRepositoryError for invalid operations
   */
  async findById(id: string): Promise<IUser | null> {
    try {
      if (!id?.match(/^[0-9a-fA-F]{24}$/)) {
        throw new UserRepositoryError('Invalid user ID format');
      }

      const user = await this.model.findById(id).select('-password -passwordHistory');
      
      this.logger.info('User lookup by ID completed', { userId: id, found: !!user });
      
      return user;
    } catch (error) {
      this.logger.error('Error in findById operation', { error, userId: id });
      throw new UserRepositoryError(`Find user by ID failed: ${error.message}`);
    }
  }

  /**
   * Securely find user by email with validation
   * @param email - User email to find
   * @returns Promise resolving to user document or null
   * @throws UserRepositoryError for invalid operations
   */
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      if (!email || !USER_VALIDATION_RULES.EMAIL_VALIDATION.pattern.test(email)) {
        throw new UserRepositoryError('Invalid email format');
      }

      const user = await this.model.findOne({ email: email.toLowerCase() })
        .select('-password -passwordHistory');
      
      this.logger.info('User lookup by email completed', { email, found: !!user });
      
      return user;
    } catch (error) {
      this.logger.error('Error in findByEmail operation', { error, email });
      throw new UserRepositoryError(`Find user by email failed: ${error.message}`);
    }
  }

  /**
   * Create new user with enhanced validation and security
   * @param userData - User data for creation
   * @param session - Database session for transaction
   * @returns Promise resolving to created user
   * @throws UserRepositoryError for invalid operations
   */
  async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
    try {
      // Validate required fields
      if (!userData.email || !userData.password) {
        throw new UserRepositoryError('Missing required user data');
      }

      // Validate email format
      if (!USER_VALIDATION_RULES.EMAIL_VALIDATION.pattern.test(userData.email)) {
        throw new UserRepositoryError('Invalid email format');
      }

      // Check for existing user
      const existingUser = await this.model.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        throw new UserRepositoryError('Email already registered');
      }

      // Create user with session if provided
      const user = new this.model({
        ...userData,
        email: userData.email.toLowerCase(),
        role: userData.role || UserRole.ANALYST,
        isActive: true,
        createdAt: new Date()
      });

      const savedUser = session ? 
        await user.save({ session }) :
        await user.save();

      this.logger.info('New user created successfully', { userId: savedUser._id });

      // Return user without sensitive data
      return savedUser.toObject({
        transform: (doc, ret) => {
          delete ret.password;
          delete ret.passwordHistory;
          return ret;
        }
      });
    } catch (error) {
      this.logger.error('Error in create operation', { error, userData });
      throw new UserRepositoryError(`User creation failed: ${error.message}`);
    }
  }

  /**
   * Update existing user with validation and security checks
   * @param id - User ID to update
   * @param updateData - Update data
   * @param session - Database session for transaction
   * @returns Promise resolving to updated user
   * @throws UserRepositoryError for invalid operations
   */
  async update(
    id: string,
    updateData: UpdateQuery<IUser>,
    session?: ClientSession
  ): Promise<IUser | null> {
    try {
      if (!id?.match(/^[0-9a-fA-F]{24}$/)) {
        throw new UserRepositoryError('Invalid user ID format');
      }

      // Prevent updating critical fields
      const sanitizedUpdate = { ...updateData };
      delete sanitizedUpdate.role; // Role changes handled separately
      delete sanitizedUpdate.password; // Password changes handled separately

      const options = {
        new: true,
        runValidators: true,
        session
      };

      const updatedUser = await this.model
        .findByIdAndUpdate(id, sanitizedUpdate, options)
        .select('-password -passwordHistory');

      if (!updatedUser) {
        throw new UserRepositoryError('User not found');
      }

      this.logger.info('User updated successfully', { userId: id });
      
      return updatedUser;
    } catch (error) {
      this.logger.error('Error in update operation', { error, userId: id });
      throw new UserRepositoryError(`User update failed: ${error.message}`);
    }
  }

  /**
   * Soft delete user with security validation
   * @param id - User ID to delete
   * @param session - Database session for transaction
   * @returns Promise resolving to deletion status
   * @throws UserRepositoryError for invalid operations
   */
  async delete(id: string, session?: ClientSession): Promise<boolean> {
    try {
      if (!id?.match(/^[0-9a-fA-F]{24}$/)) {
        throw new UserRepositoryError('Invalid user ID format');
      }

      const updateResult = await this.model.findByIdAndUpdate(
        id,
        {
          isActive: false,
          deletedAt: new Date(),
          activeSessions: [] // Clear all sessions
        },
        { session }
      );

      const success = !!updateResult;
      this.logger.info('User soft delete completed', { userId: id, success });
      
      return success;
    } catch (error) {
      this.logger.error('Error in delete operation', { error, userId: id });
      throw new UserRepositoryError(`User deletion failed: ${error.message}`);
    }
  }

  /**
   * Find all users with role-based filtering and security
   * @param filter - Query filter criteria
   * @returns Promise resolving to filtered users array
   * @throws UserRepositoryError for invalid operations
   */
  async findAll(filter: FilterQuery<IUser> = {}): Promise<IUser[]> {
    try {
      // Ensure only active users are returned
      const secureFilter = {
        ...filter,
        isActive: true
      };

      const users = await this.model
        .find(secureFilter)
        .select('-password -passwordHistory')
        .sort({ createdAt: -1 });

      this.logger.info('Users query completed', { count: users.length });
      
      return users;
    } catch (error) {
      this.logger.error('Error in findAll operation', { error, filter });
      throw new UserRepositoryError(`Find all users failed: ${error.message}`);
    }
  }

  /**
   * Update user's last login timestamp with validation
   * @param id - User ID to update
   * @returns Promise resolving when update is complete
   * @throws UserRepositoryError for invalid operations
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      if (!id?.match(/^[0-9a-fA-F]{24}$/)) {
        throw new UserRepositoryError('Invalid user ID format');
      }

      const updateResult = await this.model.findByIdAndUpdate(
        id,
        {
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          accountLockoutUntil: null
        }
      );

      if (!updateResult) {
        throw new UserRepositoryError('User not found');
      }

      this.logger.info('Last login timestamp updated', { userId: id });
    } catch (error) {
      this.logger.error('Error in updateLastLogin operation', { error, userId: id });
      throw new UserRepositoryError(`Update last login failed: ${error.message}`);
    }
  }
}