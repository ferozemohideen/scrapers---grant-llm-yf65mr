/**
 * Grant Editor Page Component
 * 
 * Provides a comprehensive interface for creating, editing, and managing grant proposals
 * with AI assistance, real-time collaboration, and version control features.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // ^6.0.0
import DashboardLayout from '../../layouts/DashboardLayout';
import GrantEditor from '../../components/grant/GrantEditor';
import { useAuth } from '../../hooks/useAuth';
import { GrantService } from '../../services/grant.service';
import { IProposal, ProposalStatus } from '../../interfaces/grant.interface';

// URL parameters interface
interface IEditorPageParams {
  proposalId?: string;
  technologyId: string;
}

// Enhanced state interface for the editor page
interface IEditorPageState {
  loading: boolean;
  error: string | null;
  proposal: IProposal | null;
  collaborators: Array<{
    id: string;
    name: string;
    role: string;
    active: boolean;
  }>;
  versionHistory: Array<{
    version: number;
    createdAt: Date;
    createdBy: string;
    changes: string[];
  }>;
  unsavedChanges: boolean;
  currentVersion: number;
  conflictState: {
    hasConflict: boolean;
    serverContent: string | null;
    localContent: string | null;
  } | null;
}

/**
 * Enhanced Grant Editor Page component with collaboration and version control
 */
const GrantEditorPage: React.FC = () => {
  const { proposalId, technologyId } = useParams<IEditorPageParams>();
  const navigate = useNavigate();
  const { user, checkPermission } = useAuth();
  const grantService = new GrantService();

  // Initialize enhanced page state
  const [state, setState] = useState<IEditorPageState>({
    loading: true,
    error: null,
    proposal: null,
    collaborators: [],
    versionHistory: [],
    unsavedChanges: false,
    currentVersion: 1,
    conflictState: null
  });

  /**
   * Loads proposal data and version history
   */
  const loadProposalData = useCallback(async () => {
    if (!technologyId) {
      setState(prev => ({ ...prev, error: 'Technology ID is required' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));

      if (proposalId) {
        // Load existing proposal
        const proposal = await grantService.getProposal(proposalId);
        const versionHistory = await grantService.getVersionHistory(proposalId);

        setState(prev => ({
          ...prev,
          proposal,
          versionHistory,
          currentVersion: proposal.version,
          loading: false
        }));
      } else {
        // Initialize new proposal
        const newProposal = await grantService.createProposal({
          technologyId,
          status: ProposalStatus.DRAFT,
          content: '',
          metadata: {
            title: '',
            institution: user?.profile?.organization || '',
            department: '',
            fundingAmount: 0,
            submissionDeadline: new Date(),
            collaborators: [],
            keywords: [],
            grantType: ''
          }
        }, technologyId);

        setState(prev => ({
          ...prev,
          proposal: newProposal,
          loading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to load proposal: ${error.message}`,
        loading: false
      }));
    }
  }, [proposalId, technologyId, user, grantService]);

  /**
   * Handles proposal save with version control and conflict resolution
   */
  const handleSave = useCallback(async (updatedProposal: IProposal) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      // Check for version conflicts
      if (state.proposal && updatedProposal.version !== state.currentVersion) {
        const comparison = await grantService.compareVersions(
          updatedProposal.id,
          state.currentVersion,
          updatedProposal.version
        );

        if (comparison.changes.length > 0) {
          setState(prev => ({
            ...prev,
            conflictState: {
              hasConflict: true,
              serverContent: state.proposal?.content || null,
              localContent: updatedProposal.content
            },
            loading: false
          }));
          return;
        }
      }

      // Save proposal
      const savedProposal = await grantService.updateProposal(
        updatedProposal.id,
        updatedProposal
      );

      // Update version history
      const versionHistory = await grantService.getVersionHistory(savedProposal.id);

      setState(prev => ({
        ...prev,
        proposal: savedProposal,
        versionHistory,
        currentVersion: savedProposal.version,
        unsavedChanges: false,
        conflictState: null,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to save proposal: ${error.message}`,
        loading: false
      }));
    }
  }, [state.proposal, state.currentVersion, grantService]);

  // Load initial data
  useEffect(() => {
    loadProposalData();
  }, [loadProposalData]);

  // Prompt user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.unsavedChanges]);

  return (
    <DashboardLayout
      requireAuth
      requiredRoles={['analyst', 'manager', 'admin']}
    >
      <div className="editor-page">
        {/* Header section */}
        <div className="editor-page__header">
          <h1>
            {state.proposal?.metadata.title || 'New Grant Proposal'}
          </h1>
          {state.loading && (
            <div className="editor-page__loading">Loading...</div>
          )}
        </div>

        {/* Error display */}
        {state.error && (
          <div 
            className="editor-page__error"
            role="alert"
          >
            {state.error}
          </div>
        )}

        {/* Main editor */}
        {state.proposal && (
          <div className="editor-page__content">
            <GrantEditor
              proposalId={state.proposal.id}
              technologyId={technologyId!}
              onSave={handleSave}
              collaborators={state.collaborators}
              versionHistory={state.versionHistory}
              collaborationConfig={{
                enabled: true,
                users: state.collaborators.map(c => c.id),
                permissions: ['edit', 'comment']
              }}
              versioningConfig={{
                enabled: true,
                autoSave: true,
                saveInterval: 30000
              }}
              performanceConfig={{
                chunkSize: 5000,
                debounceDuration: 1000,
                virtualizationEnabled: true
              }}
            />
          </div>
        )}

        {/* Version control panel */}
        <div className="editor-page__version-control">
          {state.versionHistory.length > 0 && (
            <div className="version-history">
              <h3>Version History</h3>
              <ul>
                {state.versionHistory.map(version => (
                  <li key={version.version}>
                    Version {version.version} - 
                    {new Date(version.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Collaboration panel */}
        <div className="editor-page__collaboration">
          <h3>Collaborators</h3>
          <ul>
            {state.collaborators.map(collaborator => (
              <li 
                key={collaborator.id}
                className={collaborator.active ? 'active' : ''}
              >
                {collaborator.name} ({collaborator.role})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default GrantEditorPage;