import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash/debounce';
import { DataGrid, DataGridColumn } from '../common/DataGrid';
import { GrantService } from '../../services/grant.service';
import { IProposal, ProposalStatus } from '../../interfaces/grant.interface';

// Props interface with comprehensive configuration options
interface GrantListProps {
  userId?: string;
  onProposalSelect?: (proposal: IProposal) => void;
  pageSize?: number;
  enableBulkOperations?: boolean;
  showVersionHistory?: boolean;
  collaborationEnabled?: boolean;
}

// Styled components for enhanced layout and responsiveness
const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  width: 100%;
  min-height: 0;
  position: relative;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
  gap: var(--spacing-sm);
`;

const ActionButton = styled.button`
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: var(--transition-base);

  &:hover {
    background: var(--primary-color-dark);
  }

  &:disabled {
    background: var(--background-color-disabled);
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span<{ status: ProposalStatus }>`
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: ${({ status }) => {
    switch (status) {
      case ProposalStatus.DRAFT: return 'var(--background-color-dark)';
      case ProposalStatus.IN_REVIEW: return 'var(--warning-color)';
      case ProposalStatus.APPROVED: return 'var(--success-color)';
      case ProposalStatus.REJECTED: return 'var(--error-color)';
      default: return 'var(--background-color-disabled)';
    }
  }};
  color: white;
`;

// Main component implementation
export const GrantList: React.FC<GrantListProps> = ({
  userId,
  onProposalSelect,
  pageSize = 10,
  enableBulkOperations = false,
  showVersionHistory = false,
  collaborationEnabled = true,
}) => {
  // State management
  const [proposals, setProposals] = useState<IProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProposals, setSelectedProposals] = useState<IProposal[]>([]);
  const navigate = useNavigate();

  // Column definitions with comprehensive data display
  const columns: DataGridColumn<IProposal>[] = useMemo(() => [
    {
      key: 'metadata.title',
      title: 'Title',
      sortable: true,
      filterable: true,
      width: '25%',
      render: (_, proposal) => proposal.metadata.title,
    },
    {
      key: 'metadata.institution',
      title: 'Institution',
      sortable: true,
      filterable: true,
      width: '20%',
      render: (_, proposal) => proposal.metadata.institution,
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: Object.values(ProposalStatus).map(status => ({
        label: status,
        value: status,
      })),
      width: '15%',
      render: (_, proposal) => (
        <StatusBadge status={proposal.status}>
          {proposal.status}
        </StatusBadge>
      ),
    },
    {
      key: 'metadata.submissionDeadline',
      title: 'Deadline',
      sortable: true,
      filterable: true,
      filterType: 'date',
      width: '15%',
      render: (_, proposal) => new Date(proposal.metadata.submissionDeadline).toLocaleDateString(),
    },
    {
      key: 'version',
      title: 'Version',
      sortable: true,
      width: '10%',
      render: (_, proposal) => `v${proposal.version}`,
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '15%',
      render: (_, proposal) => (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <ActionButton
            onClick={() => handleProposalEdit(proposal)}
            aria-label="Edit proposal"
          >
            Edit
          </ActionButton>
          {showVersionHistory && (
            <ActionButton
              onClick={() => handleVersionHistory(proposal)}
              aria-label="View version history"
            >
              History
            </ActionButton>
          )}
        </div>
      ),
    },
  ], [showVersionHistory]);

  // Data fetching with error handling
  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await GrantService.getProposals(userId);
      setProposals(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load proposals. Please try again.');
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initialize data on mount
  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Action handlers
  const handleProposalEdit = useCallback((proposal: IProposal) => {
    navigate(`/proposals/${proposal.id}/edit`);
  }, [navigate]);

  const handleVersionHistory = useCallback(async (proposal: IProposal) => {
    try {
      const versions = await GrantService.getProposalVersions(proposal.id);
      // Implementation for version history display
      console.log('Proposal versions:', versions);
    } catch (err) {
      console.error('Error fetching version history:', err);
    }
  }, []);

  const handleBulkOperation = useCallback(async (operation: 'delete' | 'export') => {
    if (!selectedProposals.length) return;

    try {
      setLoading(true);
      if (operation === 'delete') {
        await Promise.all(
          selectedProposals.map(proposal => GrantService.deleteProposals(proposal.id))
        );
        await fetchProposals();
      } else if (operation === 'export') {
        // Implementation for bulk export
        console.log('Exporting proposals:', selectedProposals);
      }
    } catch (err) {
      setError(`Failed to ${operation} proposals. Please try again.`);
      console.error(`Error during bulk ${operation}:`, err);
    } finally {
      setLoading(false);
      setSelectedProposals([]);
    }
  }, [selectedProposals, fetchProposals]);

  // Debounced search handler
  const handleSearch = useMemo(
    () => debounce((searchTerm: string) => {
      // Implementation for search functionality
      console.log('Searching proposals:', searchTerm);
    }, 300),
    []
  );

  return (
    <ListContainer>
      <HeaderContainer>
        <h1>Grant Proposals</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          {enableBulkOperations && selectedProposals.length > 0 && (
            <>
              <ActionButton
                onClick={() => handleBulkOperation('delete')}
                disabled={loading}
              >
                Delete Selected
              </ActionButton>
              <ActionButton
                onClick={() => handleBulkOperation('export')}
                disabled={loading}
              >
                Export Selected
              </ActionButton>
            </>
          )}
          <ActionButton
            onClick={() => navigate('/proposals/new')}
            disabled={loading}
          >
            New Proposal
          </ActionButton>
        </div>
      </HeaderContainer>

      <DataGrid<IProposal>
        columns={columns}
        data={proposals}
        loading={loading}
        error={error || undefined}
        onSelectionChange={setSelectedProposals}
        defaultSort={{ key: 'metadata.submissionDeadline', order: 'asc' }}
        virtualScroll
        selectable={enableBulkOperations}
        stickyHeader
        pageSize={pageSize}
      />
    </ListContainer>
  );
};

export default GrantList;