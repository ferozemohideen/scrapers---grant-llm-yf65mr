/**
 * Grant Service
 * Provides comprehensive grant proposal management with AI-powered generation,
 * version control, and collaboration features.
 * 
 * @version 1.0.0
 */

import { ApiService, ApiResponse, RetryConfig } from './api.service';
import { IProposal, IProposalVersion, ProposalStatus, IProposalMetadata } from '../interfaces/grant.interface';
import { API_ENDPOINTS, getParameterizedUrl } from '../constants/api.constants';

/**
 * Configuration options for proposal generation
 */
interface GenerationParams {
  grantType: string;
  fundingAmount: number;
  deadline: Date;
  keywords: string[];
  aiModel?: string;
  temperature?: number;
}

/**
 * Progress callback interface for generation tracking
 */
interface ProgressCallback {
  (progress: number, status: string): void;
}

/**
 * Service configuration interface
 */
interface ServiceConfig {
  retryConfig?: RetryConfig;
  enableRealTimeUpdates?: boolean;
  aiModelVersion?: string;
}

/**
 * Result interface for proposal generation
 */
interface GenerationResult {
  content: string;
  suggestions: string[];
  metadata: IProposalMetadata;
  confidence: number;
}

/**
 * Enhanced service class for managing grant proposals
 */
export class GrantService {
  private readonly apiService: ApiService;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private readonly enableRealTimeUpdates: boolean;
  private readonly aiModelVersion: string;

  /**
   * Initializes the grant service with configuration
   */
  constructor(
    apiService: ApiService,
    config: ServiceConfig = {}
  ) {
    this.apiService = apiService;
    this.retryAttempts = config.retryConfig?.maxRetries || 3;
    this.retryDelay = config.retryConfig?.retryDelay || 1000;
    this.enableRealTimeUpdates = config.enableRealTimeUpdates || false;
    this.aiModelVersion = config.aiModelVersion || 'gpt-4';
  }

  /**
   * Retrieves a specific proposal by ID
   */
  public async getProposal(proposalId: string): Promise<IProposal> {
    try {
      const url = getParameterizedUrl(API_ENDPOINTS.GRANT.GET, { id: proposalId });
      const response = await this.apiService.get<IProposal>(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to retrieve proposal: ${error.message}`);
    }
  }

  /**
   * Creates a new grant proposal
   */
  public async createProposal(
    proposalData: Partial<IProposal>,
    technologyId: string
  ): Promise<IProposal> {
    try {
      const proposal: Partial<IProposal> = {
        ...proposalData,
        technologyId,
        version: 1,
        status: ProposalStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const response = await this.apiService.post<IProposal>(
        API_ENDPOINTS.GRANT.CREATE,
        proposal
      );

      if (this.enableRealTimeUpdates) {
        this.initializeRealtimeUpdates(response.data.id);
      }

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create proposal: ${error.message}`);
    }
  }

  /**
   * Generates proposal content using AI with progress tracking
   */
  public async generateProposal(
    technologyId: string,
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    try {
      const generations: string[] = [];
      let progress = 0;

      // Initialize generation session
      const session = await this.apiService.post<{ sessionId: string }>(
        `${API_ENDPOINTS.GRANT.CREATE}/generate`,
        {
          technologyId,
          params,
          model: this.aiModelVersion
        }
      );

      // Track generation progress
      while (progress < 100) {
        const statusResponse = await this.apiService.get<{
          progress: number;
          content?: string;
          status: string;
        }>(`${API_ENDPOINTS.GRANT.CREATE}/generate/${session.data.sessionId}`);

        progress = statusResponse.data.progress;
        if (statusResponse.data.content) {
          generations.push(statusResponse.data.content);
        }

        onProgress?.(progress, statusResponse.data.status);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Compile final result
      const result: GenerationResult = {
        content: generations.join('\n'),
        suggestions: this.generateSuggestions(generations),
        metadata: this.extractMetadata(generations),
        confidence: this.calculateConfidence(generations)
      };

      return result;
    } catch (error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * Updates an existing proposal with version control
   */
  public async updateProposal(
    proposalId: string,
    updates: Partial<IProposal>
  ): Promise<IProposal> {
    try {
      const url = getParameterizedUrl(API_ENDPOINTS.GRANT.UPDATE, { id: proposalId });
      const currentProposal = await this.getProposal(proposalId);

      const updatedProposal: Partial<IProposal> = {
        ...updates,
        version: currentProposal.version + 1,
        updatedAt: new Date()
      };

      const response = await this.apiService.put<IProposal>(url, updatedProposal);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update proposal: ${error.message}`);
    }
  }

  /**
   * Retrieves version history for a proposal
   */
  public async getVersionHistory(proposalId: string): Promise<IProposalVersion[]> {
    try {
      const url = getParameterizedUrl(API_ENDPOINTS.GRANT.VERSIONS, { id: proposalId });
      const response = await this.apiService.get<IProposalVersion[]>(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to retrieve version history: ${error.message}`);
    }
  }

  /**
   * Compares two versions of a proposal
   */
  public async compareVersions(
    proposalId: string,
    version1: number,
    version2: number
  ): Promise<{ additions: string[]; deletions: string[]; changes: string[] }> {
    try {
      const url = getParameterizedUrl(API_ENDPOINTS.GRANT.COMPARE, { id: proposalId });
      const response = await this.apiService.post(url, { version1, version2 });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to compare versions: ${error.message}`);
    }
  }

  /**
   * Adds a collaborator to a proposal
   */
  public async addCollaborator(
    proposalId: string,
    userId: string,
    permissions: string[]
  ): Promise<void> {
    try {
      const url = getParameterizedUrl(API_ENDPOINTS.GRANT.COLLABORATE, { id: proposalId });
      await this.apiService.post(url, { userId, permissions });
    } catch (error) {
      throw new Error(`Failed to add collaborator: ${error.message}`);
    }
  }

  /**
   * Initializes real-time updates for collaborative editing
   */
  private initializeRealtimeUpdates(proposalId: string): void {
    // Implementation would depend on WebSocket or similar real-time service
    console.log(`Initialized real-time updates for proposal ${proposalId}`);
  }

  /**
   * Generates improvement suggestions from AI generations
   */
  private generateSuggestions(generations: string[]): string[] {
    // Implementation would analyze generations and extract suggestions
    return generations.map(g => `Suggestion based on: ${g.substring(0, 100)}...`);
  }

  /**
   * Extracts metadata from generated content
   */
  private extractMetadata(generations: string[]): IProposalMetadata {
    // Implementation would parse generations to extract metadata
    return {
      title: '',
      institution: '',
      department: '',
      fundingAmount: 0,
      submissionDeadline: new Date(),
      collaborators: [],
      keywords: [],
      grantType: ''
    };
  }

  /**
   * Calculates confidence score for generated content
   */
  private calculateConfidence(generations: string[]): number {
    // Implementation would analyze generations for confidence scoring
    return 0.85; // Example confidence score
  }
}