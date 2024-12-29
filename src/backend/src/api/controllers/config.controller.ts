/**
 * @fileoverview Enhanced configuration controller implementing secure configuration management
 * with comprehensive validation, versioning, and audit capabilities.
 * @version 1.0.0
 */

import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  UseGuards, 
  UseInterceptors,
  Query 
} from '@nestjs/common'; // v8.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger'; // v5.0.0
import { RateLimit } from '@nestjs/throttler'; // v2.0.0

import { ConfigService } from '../../services/config.service';
import { 
  DatabaseConfig, 
  ScraperConfig, 
  AuthConfig, 
  EnvironmentConfig 
} from '../../interfaces/config.interface';
import { 
  authenticate, 
  authorize, 
  auditLog 
} from '../middleware/auth.middleware';

/**
 * Enhanced configuration controller with comprehensive security and validation
 */
@Controller('config')
@ApiTags('Configuration')
@UseGuards(authenticate)
@ApiSecurity('bearer')
@RateLimit({ ttl: 60, limit: 10 })
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieves scraper configuration with environment-specific settings
   */
  @Get('scraper')
  @ApiOperation({ summary: 'Get scraper configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(authorize(['ADMIN', 'MANAGER']))
  @UseInterceptors(auditLog)
  async getScraperConfig(
    @Query('environment') environment: string
  ): Promise<ScraperConfig> {
    try {
      const config = await this.configService.getConfig<ScraperConfig>('scraper');
      return this.filterConfigByRole(config, environment);
    } catch (error) {
      throw new Error(`Failed to retrieve scraper configuration: ${error.message}`);
    }
  }

  /**
   * Updates scraper configuration with validation and versioning
   */
  @Put('scraper')
  @ApiOperation({ summary: 'Update scraper configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(authorize(['ADMIN']))
  @UseInterceptors(auditLog)
  async updateScraperConfig(
    @Body() config: ScraperConfig,
    @Query('environment') environment: string
  ): Promise<{ success: boolean; version: string }> {
    try {
      // Create backup before update
      await this.configService.backupConfig('scraper', environment);

      const result = await this.configService.updateConfig('scraper', config, {
        validateOnly: false,
        skipCache: false,
        reloadDependencies: true,
        auditLog: true
      });

      if (!result.isValid) {
        throw new Error(`Configuration validation failed: ${result.errors.join(', ')}`);
      }

      return {
        success: true,
        version: result.metrics.timestamp
      };
    } catch (error) {
      throw new Error(`Failed to update scraper configuration: ${error.message}`);
    }
  }

  /**
   * Retrieves database configuration with security filtering
   */
  @Get('database')
  @ApiOperation({ summary: 'Get database configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(authorize(['ADMIN']))
  @UseInterceptors(auditLog)
  async getDatabaseConfig(
    @Query('environment') environment: string
  ): Promise<DatabaseConfig> {
    try {
      const config = await this.configService.getConfig<DatabaseConfig>('database');
      return this.sanitizeDatabaseConfig(config);
    } catch (error) {
      throw new Error(`Failed to retrieve database configuration: ${error.message}`);
    }
  }

  /**
   * Creates configuration backup
   */
  @Post('backup')
  @ApiOperation({ summary: 'Create configuration backup' })
  @ApiResponse({ status: 201, description: 'Backup created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(authorize(['ADMIN']))
  @UseInterceptors(auditLog)
  async backupConfig(
    @Query('environment') environment: string
  ): Promise<{ success: boolean; backupId: string }> {
    try {
      const backupId = await this.configService.backupConfig('all', environment);
      return { success: true, backupId };
    } catch (error) {
      throw new Error(`Failed to create configuration backup: ${error.message}`);
    }
  }

  /**
   * Restores configuration from backup
   */
  @Post('restore')
  @ApiOperation({ summary: 'Restore configuration from backup' })
  @ApiResponse({ status: 200, description: 'Configuration restored successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(authorize(['ADMIN']))
  @UseInterceptors(auditLog)
  async restoreConfig(
    @Body('backupId') backupId: string,
    @Query('environment') environment: string
  ): Promise<{ success: boolean }> {
    try {
      await this.configService.restoreConfig(backupId, environment);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to restore configuration: ${error.message}`);
    }
  }

  /**
   * Filters configuration based on user role
   */
  private filterConfigByRole(
    config: ScraperConfig, 
    environment: string
  ): ScraperConfig {
    // Remove sensitive information for non-admin roles
    const filteredConfig = { ...config };
    delete filteredConfig.security;
    delete filteredConfig.credentials;
    return filteredConfig;
  }

  /**
   * Sanitizes database configuration by removing sensitive data
   */
  private sanitizeDatabaseConfig(config: DatabaseConfig): DatabaseConfig {
    const sanitized = { ...config };
    delete sanitized.password;
    delete sanitized.username;
    delete sanitized.connectionString;
    return sanitized;
  }
}