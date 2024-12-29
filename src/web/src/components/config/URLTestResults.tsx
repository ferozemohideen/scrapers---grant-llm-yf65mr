import React, { memo, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table } from '../common/Table';
import { Alert } from '../common/Alert';
import { Button } from '../common/Button';
import { URLConfig } from '../../interfaces/config.interface';
import { STATUS } from '../../constants/ui.constants';

// Interfaces
interface TestResult {
  urlId: string;
  institution: string;
  url: string;
  status: typeof STATUS[keyof typeof STATUS];
  errorMessage?: string;
  timestamp: Date;
}

interface URLTestResultsProps {
  results: TestResult[];
  onRetry: (urlId: string) => Promise<void>;
  onEdit: (urlId: string) => void;
  loading?: boolean;
  retryCount?: Record<string, number>;
}

// Styled Components
const ResultsContainer = styled.div`
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--background-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);

  @media (max-width: 768px) {
    padding: var(--spacing-md);
    gap: var(--spacing-sm);
  }
`;

const SummarySection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--background-color-dark);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-md);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const StatLabel = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-color-light);
`;

const StatValue = styled.span<{ status?: string }>`
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: ${({ status }) => {
    switch (status) {
      case STATUS.SUCCESS:
        return 'var(--success-color)';
      case STATUS.ERROR:
        return 'var(--error-color)';
      default:
        return 'var(--text-color)';
    }
  }};
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xs);
`;

// Helper function to get status color
const getStatusColor = (status: string): string => {
  switch (status) {
    case STATUS.SUCCESS:
      return 'var(--success-color)';
    case STATUS.ERROR:
      return 'var(--error-color)';
    case STATUS.LOADING:
      return 'var(--warning-color)';
    default:
      return 'var(--text-color-light)';
  }
};

// Main Component
export const URLTestResults: React.FC<URLTestResultsProps> = memo(({
  results,
  onRetry,
  onEdit,
  loading = false,
  retryCount = {}
}) => {
  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = results.length;
    const successful = results.filter(r => r.status === STATUS.SUCCESS).length;
    const failed = results.filter(r => r.status === STATUS.ERROR).length;
    
    return {
      total,
      successful,
      failed,
      successRate: total ? Math.round((successful / total) * 100) : 0
    };
  }, [results]);

  // Handle retry with loading state
  const handleRetry = useCallback(async (urlId: string) => {
    try {
      await onRetry(urlId);
    } catch (error) {
      console.error('Error retrying URL test:', error);
    }
  }, [onRetry]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      key: 'institution',
      title: 'Institution',
      width: '25%',
      render: (value: string) => (
        <span className="font-medium">{value}</span>
      )
    },
    {
      key: 'url',
      title: 'URL',
      width: '35%',
      render: (value: string) => (
        <span className="text-sm text-ellipsis overflow-hidden">{value}</span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      width: '15%',
      render: (value: string) => (
        <span
          style={{ color: getStatusColor(value) }}
          role="status"
          aria-label={`Status: ${value}`}
        >
          {value}
        </span>
      )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '25%',
      render: (_: any, record: TestResult) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRetry(record.urlId)}
            loading={loading && retryCount[record.urlId] > 0}
            disabled={record.status === STATUS.SUCCESS}
            ariaLabel={`Retry test for ${record.institution}`}
          >
            Retry
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(record.urlId)}
            ariaLabel={`Edit configuration for ${record.institution}`}
          >
            Edit
          </Button>
        </div>
      )
    }
  ], [handleRetry, onEdit, loading, retryCount]);

  return (
    <ResultsContainer role="region" aria-label="URL Test Results">
      <SummarySection>
        <StatItem>
          <StatLabel>Total URLs</StatLabel>
          <StatValue>{summary.total}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Successful</StatLabel>
          <StatValue status={STATUS.SUCCESS}>{summary.successful}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Failed</StatLabel>
          <StatValue status={STATUS.ERROR}>{summary.failed}</StatValue>
        </StatItem>
        <StatItem>
          <StatLabel>Success Rate</StatLabel>
          <StatValue>{summary.successRate}%</StatValue>
        </StatItem>
      </SummarySection>

      {loading && (
        <Alert
          variant="info"
          message="Testing URLs in progress..."
          role="status"
          live="polite"
        />
      )}

      <Table
        columns={columns}
        data={results}
        loading={loading}
        sortable
        virtualScroll
        pageSize={10}
        ariaLabel="URL test results table"
      />

      {results.length === 0 && !loading && (
        <Alert
          variant="info"
          message="No test results available"
          role="status"
        />
      )}
    </ResultsContainer>
  );
});

URLTestResults.displayName = 'URLTestResults';

export default URLTestResults;