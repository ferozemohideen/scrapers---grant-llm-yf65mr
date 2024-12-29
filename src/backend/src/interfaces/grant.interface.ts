// @ts-nocheck
import { Document } from 'mongoose'; // v6.0.0

/**
 * Enum defining all possible states of a grant proposal
 */
export enum ProposalStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Interface for version history tracking
 */
export interface IVersionHistory {
  version: number;
  content: string;
  timestamp: Date;
  author: string;
  note: string;
  changes: string[];
}

/**
 * Interface for review comments
 */
export interface IReviewComment {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

/**
 * Interface for AI-related metadata
 */
export interface IAIMetadata {
  modelVersion: string;
  timestamp: Date;
  processingTime: number;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Interface for AI generation parameters
 */
export interface IAIParameters {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences?: string[];
}

/**
 * Interface for proposal generation requirements
 */
export interface IGenerationRequirements {
  targetLength: number;
  focusAreas: string[];
  technicalDepth: 'basic' | 'intermediate' | 'advanced';
  includeSections: string[];
  formatGuidelines: string[];
  citationStyle?: string;
}

/**
 * Interface for proposal metadata
 */
export interface IProposalMetadata {
  institution: string;
  department: string;
  grantType: string;
  fundingAmount: number;
  submissionDeadline: Date;
  keywords: string[];
  category: string;
  targetAudience: string[];
}

/**
 * Main interface for grant proposal document
 */
export interface IProposal extends Document {
  id: string;
  userId: string;
  technologyId: string;
  content: string;
  version: number;
  status: ProposalStatus;
  versionHistory: IVersionHistory[];
  collaborators: string[];
  aiEnhancements: IProposalEnhancement[];
  metadata: IProposalMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for proposal generation requests
 */
export interface IProposalGeneration {
  userId: string;
  technologyId: string;
  requirements: IGenerationRequirements;
  aiParameters: IAIParameters;
  templateId: string;
}

/**
 * Interface for proposal update operations
 */
export interface IProposalUpdate {
  content: string;
  status: ProposalStatus;
  versionNote: string;
  reviewComments: IReviewComment[];
}

/**
 * Interface for AI-powered proposal enhancements
 */
export interface IProposalEnhancement {
  proposalId: string;
  enhancementType: string;
  suggestions: string[];
  aiModel: string;
  confidence: number;
  metadata: IAIMetadata;
}

/**
 * Interface for proposal search criteria
 */
export interface IProposalSearchCriteria {
  userId?: string;
  status?: ProposalStatus;
  institution?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  keywords?: string[];
  fundingRange?: {
    min: number;
    max: number;
  };
}

/**
 * Interface for proposal analytics
 */
export interface IProposalAnalytics {
  proposalId: string;
  readabilityScore: number;
  technicalAccuracy: number;
  completenessScore: number;
  innovationScore: number;
  aiSuggestions: {
    type: string;
    score: number;
    recommendations: string[];
  }[];
}