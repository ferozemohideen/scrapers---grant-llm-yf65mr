/**
 * @fileoverview Enhanced repository class for secure and scalable proposal data access
 * Implements comprehensive version control, caching, and audit logging capabilities
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^8.0.0
import { Repository, EntityRepository, QueryRunner, DataSource } from 'typeorm'; // ^0.3.0
import Redis from 'ioredis'; // ^5.0.0
import { Proposal } from '../models/proposal.model';
import { IProposal, ProposalStatus, IProposalUpdate } from '../../interfaces/grant.interface';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

@Injectable()
@EntityRepository(Proposal)
export class ProposalRepository extends Repository<Proposal> {
  private readonly redis: Redis;
  private readonly queryRunner: QueryRunner;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly CACHE_PREFIX = 'proposal:';

  constructor(private readonly dataSource: DataSource) {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3
    });
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  /**
   * Creates a new proposal with security validation and caching
   * @param data Partial proposal data
   * @param userId User creating the proposal
   * @returns Created proposal with initial version
   */
  async create(data: Partial<IProposal>, userId: string): Promise<Proposal> {
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();

    try {
      // Validate user permissions and input data
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Create new proposal instance
      const proposal = new Proposal();
      Object.assign(proposal, {
        ...data,
        userId,
        version: 1,
        status: ProposalStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Validate proposal content
      await proposal.validateContent();

      // Save proposal
      const savedProposal = await this.queryRunner.manager.save(proposal);

      // Cache the new proposal
      await this.cacheProposal(savedProposal);

      await this.queryRunner.commitTransaction();
      return savedProposal;

    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await this.queryRunner.release();
    }
  }

  /**
   * Updates proposal with version control and cache invalidation
   * @param id Proposal ID
   * @param updates Partial proposal updates
   * @param userId User making the update
   * @returns Updated proposal
   */
  async update(id: string, updates: IProposalUpdate, userId: string): Promise<Proposal> {
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();

    try {
      const proposal = await this.findOne({ where: { id } });
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      // Verify user permissions
      if (proposal.userId !== userId && !proposal.collaborators.includes(userId)) {
        throw new Error('User not authorized to update proposal');
      }

      // Check if content has changed
      const contentChanged = updates.content && updates.content !== proposal.content;

      if (contentChanged) {
        // Increment version and update version history
        await proposal.incrementVersion({
          model: updates.metadata?.aiModel || 'manual',
          confidence: updates.metadata?.confidence || 1.0,
          changes: updates.metadata?.changes || ['Manual content update']
        }, userId);
      }

      // Update proposal fields
      Object.assign(proposal, {
        ...updates,
        updatedAt: new Date()
      });

      // Validate updated content
      await proposal.validateContent();

      // Save changes
      const updatedProposal = await this.queryRunner.manager.save(proposal);

      // Update cache
      await this.invalidateCache(id);
      await this.cacheProposal(updatedProposal);

      await this.queryRunner.commitTransaction();
      return updatedProposal;

    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await this.queryRunner.release();
    }
  }

  /**
   * Finds proposal by ID with caching
   * @param id Proposal ID
   * @returns Found proposal or null
   */
  async findById(id: string): Promise<Proposal | null> {
    // Try cache first
    const cached = await this.getCachedProposal(id);
    if (cached) {
      return cached;
    }

    // If not in cache, get from database
    const proposal = await this.findOne({ where: { id } });
    if (proposal) {
      await this.cacheProposal(proposal);
    }

    return proposal;
  }

  /**
   * Finds all proposals for a user with pagination
   * @param userId User ID
   * @param page Page number
   * @param limit Results per page
   * @returns Paginated proposals
   */
  async findByUserId(
    userId: string,
    page = 1,
    limit = API_VALIDATION_RULES.PAGINATION.defaultLimit
  ): Promise<{ proposals: Proposal[]; total: number }> {
    const [proposals, total] = await this.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: Math.min(limit, API_VALIDATION_RULES.PAGINATION.maxLimit),
      order: { updatedAt: 'DESC' }
    });

    return { proposals, total };
  }

  /**
   * Caches a proposal in Redis
   * @param proposal Proposal to cache
   */
  private async cacheProposal(proposal: Proposal): Promise<void> {
    await this.redis.setex(
      `${this.CACHE_PREFIX}${proposal.id}`,
      this.CACHE_TTL,
      JSON.stringify(proposal)
    );
  }

  /**
   * Retrieves cached proposal
   * @param id Proposal ID
   * @returns Cached proposal or null
   */
  private async getCachedProposal(id: string): Promise<Proposal | null> {
    const cached = await this.redis.get(`${this.CACHE_PREFIX}${id}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  /**
   * Invalidates proposal cache
   * @param id Proposal ID
   */
  private async invalidateCache(id: string): Promise<void> {
    await this.redis.del(`${this.CACHE_PREFIX}${id}`);
  }

  /**
   * Cleanup resources on application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}