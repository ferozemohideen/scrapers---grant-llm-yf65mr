/**
 * @fileoverview TypeScript interface definitions for grant proposal data structures
 * Provides comprehensive type definitions for proposal management, version control,
 * and metadata tracking in the Technology Transfer Data Aggregation system.
 * @version 1.0.0
 */

/**
 * Enum representing all possible states of a grant proposal throughout its lifecycle
 */
export enum ProposalStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED'
}

/**
 * Interface defining detailed metadata for grant proposals including funding
 * and collaboration information
 */
export interface IProposalMetadata {
  /** Title of the grant proposal */
  title: string;
  
  /** Institution submitting the proposal */
  institution: string;
  
  /** Department within the institution */
  department: string;
  
  /** Requested funding amount in the proposal */
  fundingAmount: number;
  
  /** Deadline for proposal submission */
  submissionDeadline: Date;
  
  /** Array of collaborator identifiers */
  collaborators: string[];
  
  /** Keywords/tags associated with the proposal */
  keywords: string[];
  
  /** Type/category of grant being applied for */
  grantType: string;
}

/**
 * Interface for tracking individual versions of a proposal with change history
 * and user attribution
 */
export interface IProposalVersion {
  /** Reference to the parent proposal */
  proposalId: string;
  
  /** Sequential version number */
  versionNumber: number;
  
  /** Full content of this version */
  content: string;
  
  /** Array of changes made in this version */
  changes: string[];
  
  /** Timestamp of version creation */
  createdAt: Date;
  
  /** User ID of version creator */
  createdBy: string;
}

/**
 * Core interface defining the complete structure of a grant proposal
 * including metadata, versioning, and lifecycle status
 */
export interface IProposal {
  /** Unique identifier for the proposal */
  id: string;
  
  /** ID of the user who created the proposal */
  userId: string;
  
  /** Reference to the associated technology */
  technologyId: string;
  
  /** Current content of the proposal */
  content: string;
  
  /** Current version number */
  version: number;
  
  /** Current status in the proposal lifecycle */
  status: ProposalStatus;
  
  /** Comprehensive metadata about the proposal */
  metadata: IProposalMetadata;
  
  /** Timestamp of proposal creation */
  createdAt: Date;
  
  /** Timestamp of last update */
  updatedAt: Date;
}