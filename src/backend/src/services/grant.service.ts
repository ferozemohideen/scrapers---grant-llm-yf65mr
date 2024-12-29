/**
 * @fileoverview Enhanced service class for managing grant proposal operations
 * Implements comprehensive proposal generation, enhancement, and review functionality
 * with advanced performance optimization and monitoring
 * @version 1.0.0
 */

import { Injectable, Logger, Cache } from '@nestjs/common'; // ^8.0.0
import { CircuitBreaker } from '@nestjs/common'; // ^8.0.0
import { IProposal, ProposalStatus, IProposalGeneration, IProposalEnhancement } from '../../interfaces/grant.interface';
import { ProposalRepository } from '../../db/repositories/proposal.repository';
import { GPT4Service } from '../../lib/ai/gpt4.service';

@Injectable()
export class GrantService {
  private readonly logger = new Logger(GrantService.name);
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly proposalRepository: ProposalRepository,
    private readonly gpt4Service: GPT4Service,
    @Cache() private readonly cache: Cache
  ) {
    // Initialize circuit breaker for GPT-4 calls
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
    });
  }

  /**
   * Generates a new grant proposal with AI assistance and quality validation
   * @param data Proposal generation requirements and parameters
   * @returns Generated proposal with quality metrics
   */
  async generateProposal(data: IProposalGeneration): Promise<IProposal> {
    this.logger.log(`Starting proposal generation for technology ${data.technologyId}`);

    try {
      // Generate proposal content using GPT-4
      const content = await this.circuitBreaker.fire(() =>
        this.gpt4Service.generateProposal(
          data.technologyId,
          data.requirements,
          data.aiParameters
        )
      );

      // Calculate initial success probability
      const initialReview = await this.gpt4Service.reviewProposal(content, {
        technical: true,
        impact: true,
        innovation: true,
      });

      // Create new proposal with metrics
      const proposal = await this.proposalRepository.create({
        userId: data.userId,
        technologyId: data.technologyId,
        content,
        status: ProposalStatus.DRAFT,
        metadata: {
          requirements: data.requirements,
          aiParameters: data.aiParameters,
          initialMetrics: initialReview,
          generationTimestamp: new Date(),
        },
      });

      // Cache the generated proposal
      await this.cache.set(
        `proposal:${proposal.id}`,
        proposal,
        { ttl: 3600 } // 1 hour cache
      );

      this.logger.log(`Successfully generated proposal ${proposal.id}`);
      return proposal;

    } catch (error) {
      this.logger.error(`Proposal generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhances existing proposal with AI-powered improvements
   * @param id Proposal ID
   * @param enhancement Enhancement parameters
   * @returns Enhanced proposal with improvement metrics
   */
  async enhanceProposal(id: string, enhancement: IProposalEnhancement): Promise<IProposal> {
    this.logger.log(`Starting proposal enhancement for ${id}`);

    try {
      // Retrieve existing proposal
      const proposal = await this.proposalRepository.findById(id);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      // Create new version
      const currentVersion = proposal.version;
      
      // Apply AI enhancements
      const enhancedContent = await this.circuitBreaker.fire(() =>
        this.gpt4Service.enhanceProposal(
          proposal.content,
          enhancement.enhancementType
        )
      );

      // Calculate improvement metrics
      const beforeMetrics = await this.gpt4Service.reviewProposal(proposal.content, {
        comprehensive: true,
      });
      const afterMetrics = await this.gpt4Service.reviewProposal(enhancedContent.suggestions.join('\n'), {
        comprehensive: true,
      });

      // Update proposal with enhancements
      const updatedProposal = await this.proposalRepository.update(id, {
        content: enhancedContent.suggestions.join('\n'),
        version: currentVersion + 1,
        metadata: {
          ...proposal.metadata,
          enhancements: [
            ...(proposal.metadata.enhancements || []),
            {
              type: enhancement.enhancementType,
              timestamp: new Date(),
              metrics: {
                before: beforeMetrics,
                after: afterMetrics,
                improvement: this.calculateImprovement(beforeMetrics, afterMetrics),
              },
            },
          ],
        },
      });

      // Invalidate and update cache
      await this.cache.del(`proposal:${id}`);
      await this.cache.set(
        `proposal:${id}`,
        updatedProposal,
        { ttl: 3600 }
      );

      this.logger.log(`Successfully enhanced proposal ${id}`);
      return updatedProposal;

    } catch (error) {
      this.logger.error(`Proposal enhancement failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reviews proposal with comprehensive feedback and success prediction
   * @param id Proposal ID
   * @returns Detailed review with success probability
   */
  async reviewProposal(id: string): Promise<Record<string, any>> {
    this.logger.log(`Starting proposal review for ${id}`);

    try {
      // Check cache first
      const cachedReview = await this.cache.get(`review:${id}`);
      if (cachedReview) {
        return cachedReview;
      }

      // Retrieve proposal
      const proposal = await this.proposalRepository.findById(id);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      // Generate comprehensive review
      const review = await this.circuitBreaker.fire(() =>
        this.gpt4Service.reviewProposal(proposal.content, {
          technical: true,
          impact: true,
          innovation: true,
          clarity: true,
          completeness: true,
        })
      );

      // Calculate success probability
      const successProbability = await this.calculateSuccessProbability(review);

      // Compile complete review
      const completeReview = {
        ...review,
        successProbability,
        timestamp: new Date(),
        proposalVersion: proposal.version,
      };

      // Update proposal metrics
      await this.proposalRepository.update(id, {
        metadata: {
          ...proposal.metadata,
          latestReview: completeReview,
        },
      });

      // Cache review
      await this.cache.set(
        `review:${id}`,
        completeReview,
        { ttl: 1800 } // 30 minutes cache
      );

      this.logger.log(`Successfully reviewed proposal ${id}`);
      return completeReview;

    } catch (error) {
      this.logger.error(`Proposal review failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculates improvement between before and after metrics
   * @private
   */
  private calculateImprovement(before: any, after: any): Record<string, number> {
    return {
      technical: (after.technical - before.technical) / before.technical,
      clarity: (after.clarity - before.clarity) / before.clarity,
      impact: (after.impact - before.impact) / before.impact,
      overall: (after.overallScore - before.overallScore) / before.overallScore,
    };
  }

  /**
   * Calculates proposal success probability based on review metrics
   * @private
   */
  private async calculateSuccessProbability(review: any): Promise<number> {
    const weights = {
      technical: 0.3,
      impact: 0.25,
      innovation: 0.2,
      clarity: 0.15,
      completeness: 0.1,
    };

    return Object.entries(weights).reduce(
      (prob, [key, weight]) => prob + (review[key] * weight),
      0
    );
  }
}