import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { useWebSocket } from 'react-use-websocket';
import { Table, TableColumn } from '../common/Table';
import { IProposalVersion } from '../../interfaces/grant.interface';
import { GrantService } from '../../services/grant.service';

// Props interface for the VersionHistory component
interface VersionHistoryProps {
  proposalId: string;
  onVersionSelect?: (version: IProposalVersion) => void;
  onVersionCompare?: (v1: IProposalVersion, v2: IProposalVersion) => void;
  showDiff?: boolean;
}

// Styled components
const VersionHistoryContainer = styled.div`
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  background: var(--background);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  position: relative;
  min-height: 400px;
`;

const CompareContainer = styled.div`
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  align-items: center;
`;

const CompareButton = styled.button`
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: var(--transition-base);

  &:disabled {
    background: var(--background-color-disabled);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--primary-color-dark);
  }
`;

const VersionSelect = styled.select`
  padding: var(--spacing-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--background);
`;

const DiffView = styled.div`
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--background-color-dark);
  border-radius: var(--border-radius-sm);
  overflow: auto;
  max-height: 300px;
`;

// Main component
export const VersionHistory: React.FC<VersionHistoryProps> = ({
  proposalId,
  onVersionSelect,
  onVersionCompare,
  showDiff = false,
}) => {
  // State management
  const [versions, setVersions] = useState<IProposalVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<{v1?: number; v2?: number}>({});
  const [diffData, setDiffData] = useState<{
    additions: string[];
    deletions: string[];
    changes: string[];
  } | null>(null);

  // WebSocket setup for real-time updates
  const { lastMessage } = useWebSocket(
    `${process.env.VITE_WS_URL}/proposals/${proposalId}/versions`,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
    }
  );

  // Fetch initial version history
  const fetchVersionHistory = useCallback(async () => {
    try {
      setLoading(true);
      const versionHistory = await GrantService.getVersionHistory(proposalId);
      setVersions(versionHistory);
      setError(null);
    } catch (err) {
      setError('Failed to load version history');
      console.error('Version history error:', err);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      const update = JSON.parse(lastMessage.data);
      setVersions(prevVersions => {
        const updatedVersions = [...prevVersions];
        const index = updatedVersions.findIndex(v => v.versionNumber === update.versionNumber);
        if (index >= 0) {
          updatedVersions[index] = update;
        } else {
          updatedVersions.push(update);
        }
        return updatedVersions.sort((a, b) => b.versionNumber - a.versionNumber);
      });
    }
  }, [lastMessage]);

  // Initial load
  useEffect(() => {
    fetchVersionHistory();
  }, [fetchVersionHistory]);

  // Compare versions
  const handleCompare = useCallback(async () => {
    if (!selectedVersions.v1 || !selectedVersions.v2) return;

    try {
      const comparison = await GrantService.compareVersions(
        proposalId,
        selectedVersions.v1,
        selectedVersions.v2
      );
      setDiffData(comparison);
      onVersionCompare?.(
        versions.find(v => v.versionNumber === selectedVersions.v1)!,
        versions.find(v => v.versionNumber === selectedVersions.v2)!
      );
    } catch (err) {
      setError('Failed to compare versions');
      console.error('Version comparison error:', err);
    }
  }, [proposalId, selectedVersions, versions, onVersionCompare]);

  // Table columns configuration
  const columns = useMemo<TableColumn<IProposalVersion>[]>(() => [
    {
      key: 'versionNumber',
      title: 'Version',
      width: '100px',
      sortable: true,
    },
    {
      key: 'createdAt',
      title: 'Date',
      width: '200px',
      sortable: true,
      render: (value) => format(new Date(value), 'MMM dd, yyyy HH:mm'),
    },
    {
      key: 'createdBy',
      title: 'Author',
      width: '200px',
    },
    {
      key: 'changeSummary',
      title: 'Changes',
      render: (value) => value || 'No summary provided',
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '150px',
      render: (_, record) => (
        <button
          onClick={() => onVersionSelect?.(record)}
          aria-label={`View version ${record.versionNumber}`}
        >
          View
        </button>
      ),
    },
  ], [onVersionSelect]);

  return (
    <VersionHistoryContainer>
      {error && (
        <div role="alert" style={{ color: 'var(--error-color)', marginBottom: 'var(--spacing-md)' }}>
          {error}
        </div>
      )}

      <CompareContainer>
        <VersionSelect
          value={selectedVersions.v1}
          onChange={(e) => setSelectedVersions(prev => ({ ...prev, v1: Number(e.target.value) }))}
          aria-label="Select first version for comparison"
        >
          <option value="">Select Version 1</option>
          {versions.map(v => (
            <option key={v.versionNumber} value={v.versionNumber}>
              Version {v.versionNumber}
            </option>
          ))}
        </VersionSelect>

        <VersionSelect
          value={selectedVersions.v2}
          onChange={(e) => setSelectedVersions(prev => ({ ...prev, v2: Number(e.target.value) }))}
          aria-label="Select second version for comparison"
        >
          <option value="">Select Version 2</option>
          {versions.map(v => (
            <option key={v.versionNumber} value={v.versionNumber}>
              Version {v.versionNumber}
            </option>
          ))}
        </VersionSelect>

        <CompareButton
          onClick={handleCompare}
          disabled={!selectedVersions.v1 || !selectedVersions.v2}
          aria-label="Compare selected versions"
        >
          Compare Versions
        </CompareButton>
      </CompareContainer>

      <Table
        columns={columns}
        data={versions}
        loading={loading}
        sortable
        pageSize={10}
        ariaLabel="Version history table"
      />

      {showDiff && diffData && (
        <DiffView>
          <h4>Changes</h4>
          <div style={{ color: 'var(--success-color)' }}>
            {diffData.additions.map((addition, i) => (
              <div key={`addition-${i}`}>+ {addition}</div>
            ))}
          </div>
          <div style={{ color: 'var(--error-color)' }}>
            {diffData.deletions.map((deletion, i) => (
              <div key={`deletion-${i}`}>- {deletion}</div>
            ))}
          </div>
          <div>
            {diffData.changes.map((change, i) => (
              <div key={`change-${i}`}># {change}</div>
            ))}
          </div>
        </DiffView>
      )}
    </VersionHistoryContainer>
  );
};

export default VersionHistory;