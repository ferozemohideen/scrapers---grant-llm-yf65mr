/**
 * @fileoverview Comprehensive unit test suite for GrantService
 * Tests proposal generation, enhancement, version control, and performance metrics
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { GrantService } from '../../../src/services/grant.service';
import { ProposalRepository } from '../../../src/db/repositories/proposal.repository';
import { GPT4Service } from '../../../src/lib/ai/gpt4.service';
import { ProposalStatus, IProposalGeneration, IProposalEnhancement } from '../../../src/interfaces/grant.interface';

// Mock implementations
jest.mock('../../../src/db/repositories/proposal.repository');
jest.mock('../../../src/lib/ai/gpt4.service');

describe('GrantService', () => {
  let grantService: GrantService;
  let proposalRepositoryMock: jest.Mocked<ProposalRepository>;
  let gpt4ServiceMock: jest.Mocked<GPT4Service>;
  let cacheMock: any;

  // Test data constants
  const mockUserId = 'mock-user-id';
  const mockTechnologyId = 'mock-tech-id';
  const mockProposalId = 'mock-proposal-id';

  const mockProposal = {
    id: mockProposalId,
    userId: mockUserId,
    technologyId: mockTechnologyId,
    content: 'Initial proposal content',
    status: ProposalStatus.DRAFT,
    version: 1,
    metadata: {
      requirements: {
        targetLength: 2000,
        focusAreas: ['innovation', 'impact']
      },
      aiParameters: {
        model: 'gpt-4',
        temperature: 0.7
      },
      initialMetrics: {
        technical: 0.8,
        impact: 0.75
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    proposalRepositoryMock = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      getVersionHistory: jest.fn()
    } as any;

    gpt4ServiceMock = {
      generateProposal: jest.fn(),
      enhanceProposal: jest.fn(),
      reviewProposal: jest.fn(),
      calculateSuccessProbability: jest.fn()
    } as any;

    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    // Initialize service with mocks
    grantService = new GrantService(
      proposalRepositoryMock,
      gpt4ServiceMock,
      cacheMock
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateProposal', () => {
    const mockGenerationData: IProposalGeneration = {
      userId: mockUserId,
      technologyId: mockTechnologyId,
      requirements: {
        targetLength: 2000,
        focusAreas: ['innovation', 'impact'],
        technicalDepth: 'advanced',
        includeSections: ['background', 'methodology'],
        formatGuidelines: ['apa']
      },
      aiParameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 1,
        frequencyPenalty: 0.3,
        presencePenalty: 0.3
      },
      templateId: 'default'
    };

    it('should successfully generate a new proposal', async () => {
      // Setup mocks
      const generatedContent = 'Generated proposal content';
      gpt4ServiceMock.generateProposal.mockResolvedValue(generatedContent);
      gpt4ServiceMock.reviewProposal.mockResolvedValue({
        technical: 0.8,
        impact: 0.75,
        overallScore: 0.85
      });
      proposalRepositoryMock.create.mockResolvedValue(mockProposal);

      // Execute test
      const result = await grantService.generateProposal(mockGenerationData);

      // Verify results
      expect(result).toBeDefined();
      expect(result.id).toBe(mockProposalId);
      expect(result.content).toBe('Initial proposal content');
      expect(result.status).toBe(ProposalStatus.DRAFT);
      
      // Verify interactions
      expect(gpt4ServiceMock.generateProposal).toHaveBeenCalledWith(
        mockTechnologyId,
        mockGenerationData.requirements,
        mockGenerationData.aiParameters
      );
      expect(proposalRepositoryMock.create).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalled();
    });

    it('should handle generation failures gracefully', async () => {
      // Setup mock failure
      gpt4ServiceMock.generateProposal.mockRejectedValue(
        new Error('Generation failed')
      );

      // Execute and verify error handling
      await expect(
        grantService.generateProposal(mockGenerationData)
      ).rejects.toThrow('Proposal generation failed');
    });

    it('should validate generation requirements', async () => {
      const invalidData = { ...mockGenerationData, requirements: undefined };
      await expect(
        grantService.generateProposal(invalidData as any)
      ).rejects.toThrow();
    });
  });

  describe('enhanceProposal', () => {
    const mockEnhancement: IProposalEnhancement = {
      proposalId: mockProposalId,
      enhancementType: 'technical_clarity',
      suggestions: [],
      aiModel: 'gpt-4',
      confidence: 0.85,
      metadata: {
        modelVersion: 'gpt-4',
        timestamp: new Date(),
        processingTime: 1500
      }
    };

    it('should successfully enhance an existing proposal', async () => {
      // Setup mocks
      proposalRepositoryMock.findById.mockResolvedValue(mockProposal);
      gpt4ServiceMock.enhanceProposal.mockResolvedValue({
        suggestions: ['Improvement 1', 'Improvement 2'],
        confidence: 0.9
      });
      proposalRepositoryMock.update.mockResolvedValue({
        ...mockProposal,
        version: 2,
        content: 'Enhanced content'
      });

      // Execute test
      const result = await grantService.enhanceProposal(
        mockProposalId,
        mockEnhancement
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.version).toBe(2);
      expect(result.content).toBe('Enhanced content');
      
      // Verify interactions
      expect(gpt4ServiceMock.enhanceProposal).toHaveBeenCalled();
      expect(proposalRepositoryMock.update).toHaveBeenCalled();
      expect(cacheMock.del).toHaveBeenCalledWith(`proposal:${mockProposalId}`);
    });

    it('should handle enhancement failures', async () => {
      proposalRepositoryMock.findById.mockResolvedValue(null);
      await expect(
        grantService.enhanceProposal(mockProposalId, mockEnhancement)
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('reviewProposal', () => {
    it('should provide comprehensive proposal review', async () => {
      // Setup mocks
      proposalRepositoryMock.findById.mockResolvedValue(mockProposal);
      gpt4ServiceMock.reviewProposal.mockResolvedValue({
        technical: 0.9,
        impact: 0.85,
        innovation: 0.8,
        clarity: 0.9,
        completeness: 0.95
      });

      // Execute test
      const result = await grantService.reviewProposal(mockProposalId);

      // Verify results
      expect(result).toBeDefined();
      expect(result.technical).toBeGreaterThan(0);
      expect(result.impact).toBeGreaterThan(0);
      
      // Verify cache interaction
      expect(cacheMock.get).toHaveBeenCalledWith(`review:${mockProposalId}`);
      expect(cacheMock.set).toHaveBeenCalled();
    });

    it('should use cached review when available', async () => {
      const cachedReview = {
        technical: 0.9,
        impact: 0.85,
        timestamp: new Date()
      };
      cacheMock.get.mockResolvedValue(cachedReview);

      const result = await grantService.reviewProposal(mockProposalId);
      expect(result).toEqual(cachedReview);
      expect(gpt4ServiceMock.reviewProposal).not.toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should track proposal generation time', async () => {
      const startTime = Date.now();
      gpt4ServiceMock.generateProposal.mockImplementation(
        async () => new Promise(resolve => setTimeout(resolve, 100))
      );

      await grantService.generateProposal(mockGenerationData);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(2000); // Max 2 seconds
    });

    it('should maintain success rate metrics', async () => {
      // Setup multiple successful generations
      gpt4ServiceMock.generateProposal.mockResolvedValue('Success');
      gpt4ServiceMock.reviewProposal.mockResolvedValue({ overallScore: 0.85 });

      for (let i = 0; i < 5; i++) {
        await grantService.generateProposal(mockGenerationData);
      }

      // Verify success rate
      const metrics = await grantService.getPerformanceMetrics();
      expect(metrics.successRate).toBeGreaterThan(0.8); // 80%+ success rate
    });
  });

  describe('Version Control', () => {
    it('should maintain proper version history', async () => {
      // Setup initial proposal
      proposalRepositoryMock.findById.mockResolvedValue(mockProposal);
      
      // Simulate multiple enhancements
      for (let i = 0; i < 3; i++) {
        await grantService.enhanceProposal(mockProposalId, {
          ...mockEnhancement,
          suggestions: [`Enhancement ${i + 1}`]
        });
      }

      // Verify version increments
      const finalCall = proposalRepositoryMock.update.mock.calls.pop();
      expect(finalCall[1].version).toBe(4); // Initial + 3 enhancements
    });

    it('should track AI enhancement metadata', async () => {
      proposalRepositoryMock.findById.mockResolvedValue(mockProposal);
      gpt4ServiceMock.enhanceProposal.mockResolvedValue({
        suggestions: ['Enhancement'],
        confidence: 0.9,
        metadata: {
          modelVersion: 'gpt-4',
          timestamp: new Date()
        }
      });

      await grantService.enhanceProposal(mockProposalId, mockEnhancement);

      const updateCall = proposalRepositoryMock.update.mock.calls[0];
      expect(updateCall[1].metadata.enhancements).toBeDefined();
      expect(updateCall[1].metadata.enhancements[0].type).toBe('technical_clarity');
    });
  });
});