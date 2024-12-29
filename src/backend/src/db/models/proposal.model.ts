/**
 * @fileoverview Enhanced Proposal model for managing AI-assisted grant proposals
 * Implements comprehensive version control, collaboration support, and AI enhancement tracking
 * @version 1.0.0
 */

import { Model, DataTypes } from 'sequelize'; // ^6.35.0
import { Technology } from './technology.model';
import { User } from './user.model';
import { IProposal, ProposalStatus } from '../../interfaces/grant.interface';

/**
 * Enhanced Sequelize model class for AI-assisted grant proposals
 * Implements comprehensive version control and collaboration features
 */
@Table({
  tableName: 'proposals',
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['technologyId'] },
    { fields: ['version'] }
  ]
})
export class Proposal extends Model implements IProposal {
  @Column({
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  })
  id!: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  })
  userId!: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'technologies',
      key: 'id'
    }
  })
  technologyId!: string;

  @Column({
    type: DataTypes.TEXT,
    allowNull: false
  })
  content!: string;

  @Column({
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  })
  version!: number;

  @Column({
    type: DataTypes.ENUM(...Object.values(ProposalStatus)),
    allowNull: false,
    defaultValue: ProposalStatus.DRAFT
  })
  status!: ProposalStatus;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  })
  versionHistory!: Array<{
    version: number;
    content: string;
    timestamp: Date;
    author: string;
    changes: string[];
    aiMetadata?: {
      model: string;
      confidence: number;
      processingTime: number;
    };
  }>;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  })
  aiEnhancements!: Array<{
    type: string;
    suggestions: string[];
    model: string;
    confidence: number;
    timestamp: Date;
  }>;

  @Column({
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: false,
    defaultValue: []
  })
  collaborators!: string[];

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      metrics: {
        readabilityScore: 0,
        technicalAccuracy: 0,
        completenessScore: 0,
        innovationScore: 0
      },
      generation: {
        model: '',
        temperature: 0,
        maxTokens: 0
      }
    }
  })
  metadata!: Record<string, any>;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  createdAt!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  updatedAt!: Date;

  /**
   * Increments proposal version with AI enhancement tracking
   * @param aiChanges AI-generated changes to track
   * @param userId User making the changes
   * @returns New version number
   */
  async incrementVersion(
    aiChanges: {
      model: string;
      confidence: number;
      changes: string[];
    },
    userId: string
  ): Promise<number> {
    // Validate user permissions
    if (!this.collaborators.includes(userId) && this.userId !== userId) {
      throw new Error('User not authorized to modify proposal');
    }

    // Create version history entry
    const versionEntry = {
      version: this.version + 1,
      content: this.content,
      timestamp: new Date(),
      author: userId,
      changes: aiChanges.changes,
      aiMetadata: {
        model: aiChanges.model,
        confidence: aiChanges.confidence,
        processingTime: Date.now()
      }
    };

    // Update version history
    this.versionHistory = [...this.versionHistory, versionEntry];
    this.version += 1;

    // Update metadata
    this.metadata.lastAiEnhancement = {
      timestamp: new Date(),
      model: aiChanges.model,
      confidence: aiChanges.confidence
    };

    await this.save();
    return this.version;
  }

  /**
   * Updates proposal status with validation
   * @param newStatus New status to set
   * @param userId User making the status change
   */
  async updateStatus(newStatus: ProposalStatus, userId: string): Promise<void> {
    // Validate user permissions
    if (!this.collaborators.includes(userId) && this.userId !== userId) {
      throw new Error('User not authorized to update status');
    }

    // Validate status transition
    const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
      [ProposalStatus.DRAFT]: [ProposalStatus.IN_REVIEW],
      [ProposalStatus.IN_REVIEW]: [ProposalStatus.APPROVED, ProposalStatus.REJECTED, ProposalStatus.REVISION_REQUESTED],
      [ProposalStatus.REVISION_REQUESTED]: [ProposalStatus.IN_REVIEW],
      [ProposalStatus.APPROVED]: [ProposalStatus.ARCHIVED],
      [ProposalStatus.REJECTED]: [ProposalStatus.ARCHIVED],
      [ProposalStatus.ARCHIVED]: []
    };

    if (!validTransitions[this.status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
    this.metadata.statusHistory = [
      ...(this.metadata.statusHistory || []),
      {
        from: this.status,
        to: newStatus,
        timestamp: new Date(),
        userId
      }
    ];

    await this.save();
  }

  /**
   * Adds a collaborator to the proposal
   * @param collaboratorId ID of user to add as collaborator
   * @param role Collaboration role
   * @returns Success status
   */
  async addCollaborator(collaboratorId: string, role: string): Promise<boolean> {
    // Validate collaborator exists
    const collaborator = await User.findByPk(collaboratorId);
    if (!collaborator) {
      throw new Error('Collaborator not found');
    }

    // Check for duplicate
    if (this.collaborators.includes(collaboratorId)) {
      return false;
    }

    // Add collaborator
    this.collaborators = [...this.collaborators, collaboratorId];
    this.metadata.collaboratorRoles = {
      ...this.metadata.collaboratorRoles,
      [collaboratorId]: role
    };

    await this.save();
    return true;
  }

  /**
   * Records AI enhancement metrics
   * @param enhancement Enhancement details to track
   */
  async trackAIEnhancement(enhancement: {
    type: string;
    suggestions: string[];
    model: string;
    confidence: number;
  }): Promise<void> {
    // Validate enhancement data
    if (!enhancement.type || !enhancement.model || !Array.isArray(enhancement.suggestions)) {
      throw new Error('Invalid enhancement data');
    }

    // Add to enhancements array
    this.aiEnhancements = [
      ...this.aiEnhancements,
      {
        ...enhancement,
        timestamp: new Date()
      }
    ];

    // Update success metrics
    this.metadata.metrics.aiEnhancementCount = (this.metadata.metrics.aiEnhancementCount || 0) + 1;
    this.metadata.metrics.lastEnhancementSuccess = enhancement.confidence > 0.8;

    await this.save();
  }
}

export default Proposal;