/**
 * @fileoverview Enhanced User Model with comprehensive security features
 * @version 1.0.0
 * @license MIT
 */

import { Schema, model, Document } from 'mongoose'; // v6.9.0
import { UserRole } from '../../interfaces/auth.interface';
import { hashPassword, verifyPassword } from '../../utils/encryption.util';
import { USER_VALIDATION_RULES } from '../../constants/validation.constants';

/**
 * Enhanced interface for user document with security features
 */
export interface IUser extends Document {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  lastLogin: Date | null;
  isActive: boolean;
  failedLoginAttempts: number;
  accountLockoutUntil: Date | null;
  passwordLastChanged: Date;
  passwordHistory: string[];
  securityQuestions: Array<{
    question: string;
    answer: string;
  }>;
  activeSessions: Array<{
    sessionId: string;
    device: string;
    lastActive: Date;
  }>;
  gdprConsent: boolean;
  dataRetentionApproval: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  lockAccount(): Promise<void>;
  validateSecurityQuestion(question: string, answer: string): Promise<boolean>;
}

/**
 * Enhanced Mongoose schema for user model with security features
 */
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value: string) => USER_VALIDATION_RULES.EMAIL_VALIDATION.pattern.test(value),
        message: 'Invalid email format'
      },
      maxlength: USER_VALIDATION_RULES.EMAIL_VALIDATION.maxLength
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      validate: {
        validator: (value: string) => {
          const policy = USER_VALIDATION_RULES.PASSWORD_POLICY;
          return (
            value.length >= policy.minLength &&
            value.length <= policy.maxLength &&
            /[A-Z]/.test(value) && // Uppercase
            /[a-z]/.test(value) && // Lowercase
            /[0-9]/.test(value) && // Numbers
            /[!@#$%^&*]/.test(value) // Special chars
          );
        },
        message: 'Password does not meet security requirements'
      }
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.ANALYST,
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => USER_VALIDATION_RULES.PROFILE_RULES.name.pattern.test(value),
        message: 'Invalid first name format'
      },
      maxlength: USER_VALIDATION_RULES.PROFILE_RULES.name.maxLength
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string) => USER_VALIDATION_RULES.PROFILE_RULES.name.pattern.test(value),
        message: 'Invalid last name format'
      },
      maxlength: USER_VALIDATION_RULES.PROFILE_RULES.name.maxLength
    },
    lastLogin: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    accountLockoutUntil: {
      type: Date,
      default: null
    },
    passwordLastChanged: {
      type: Date,
      default: Date.now
    },
    passwordHistory: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 5,
        message: 'Maximum password history limit exceeded'
      }
    },
    securityQuestions: {
      type: [{
        question: String,
        answer: String
      }],
      default: [],
      validate: {
        validator: (value: Array<{ question: string; answer: string }>) => value.length <= 3,
        message: 'Maximum security questions limit exceeded'
      }
    },
    activeSessions: {
      type: [{
        sessionId: String,
        device: String,
        lastActive: Date
      }],
      default: []
    },
    gdprConsent: {
      type: Boolean,
      default: false
    },
    dataRetentionApproval: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

/**
 * Pre-save middleware for password hashing and validation
 */
UserSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    // Validate password against history
    if (this.passwordHistory.length > 0) {
      for (const oldPassword of this.passwordHistory) {
        const isMatch = await verifyPassword(this.password, oldPassword);
        if (isMatch) {
          throw new Error('Password has been used recently');
        }
      }
    }

    // Hash new password
    const hashedPassword = await hashPassword(this.password);
    
    // Update password history
    this.passwordHistory = [
      hashedPassword,
      ...this.passwordHistory.slice(0, 4) // Keep last 5 passwords
    ];
    
    this.password = hashedPassword;
    this.passwordLastChanged = new Date();
    
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to verify password with security measures
 */
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    // Check if account is locked
    if (this.accountLockoutUntil && this.accountLockoutUntil > new Date()) {
      throw new Error('Account is temporarily locked');
    }

    const isMatch = await verifyPassword(candidatePassword, this.password);

    if (!isMatch) {
      this.failedLoginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (this.failedLoginAttempts >= 5) {
        await this.lockAccount();
      }
      
      await this.save();
    } else {
      // Reset failed attempts on successful login
      if (this.failedLoginAttempts > 0) {
        this.failedLoginAttempts = 0;
        this.accountLockoutUntil = null;
        await this.save();
      }
    }

    return isMatch;
  } catch (error) {
    throw new Error(`Password verification failed: ${error.message}`);
  }
};

/**
 * Method to handle account lockout
 */
UserSchema.methods.lockAccount = async function(): Promise<void> {
  this.accountLockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
  this.activeSessions = []; // Clear all active sessions
  await this.save();
};

/**
 * Method to validate security question answers
 */
UserSchema.methods.validateSecurityQuestion = async function(
  question: string,
  answer: string
): Promise<boolean> {
  const securityQuestion = this.securityQuestions.find(q => q.question === question);
  if (!securityQuestion) {
    return false;
  }

  return await verifyPassword(answer, securityQuestion.answer);
};

// Create and export the User model
export const User = model<IUser>('User', UserSchema);