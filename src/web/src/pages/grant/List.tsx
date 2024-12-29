/**
 * Grant List Page Component
 * 
 * A secure, accessible, and performant dashboard interface for managing grant proposals.
 * Implements role-based access control, real-time updates, and comprehensive proposal
 * management capabilities with optimized rendering and error handling.
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import DashboardLayout from '../../layouts/DashboardLayout';
import GrantList from '../../components/grant/GrantList';
import { useAuth } from '../../hooks/useAuth';
import { IProposal } from '../../interfaces/grant.interface';
import { GRANT_ROUTES } from '../../constants/routes.constants';

/**
 * Grant List Page Component
 * Provides a secure and accessible interface for managing grant proposals
 */
const GrantListPage: React.FC = () => {
  // Authentication and navigation hooks
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Local state management
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Memoized configuration options based on user permissions
  const listConfig = useMemo(() => ({
    enableBulkOperations: hasPermission('manage:proposals'),
    showVersionHistory: hasPermission('view:proposal_history'),
    collaborationEnabled: hasPermission('collaborate:proposals'),
    pageSize: 10
  }), [hasPermission]);

  // Error boundary handler
  const handleError = useCallback((error: Error) => {
    console.error('Grant list error:', error);
    setError('An error occurred while loading proposals. Please try again.');
  }, []);

  // Proposal selection handler with security checks
  const handleProposalSelect = useCallback(async (proposal: IProposal) => {
    try {
      if (!hasPermission('view:proposals')) {
        throw new Error('Insufficient permissions to view proposals');
      }

      setIsLoading(true);
      navigate(`${GRANT_ROUTES.EDITOR}/${proposal.id}`);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, hasPermission, handleError]);

  // Effect for initializing real-time updates if available
  useEffect(() => {
    let websocketConnection: WebSocket | null = null;

    if (listConfig.collaborationEnabled) {
      try {
        websocketConnection = new WebSocket(process.env.REACT_APP_WS_URL || '');
        websocketConnection.onmessage = (event) => {
          // Handle real-time proposal updates
          console.log('Received update:', event.data);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    }

    return () => {
      websocketConnection?.close();
    };
  }, [listConfig.collaborationEnabled]);

  return (
    <DashboardLayout
      className="grant-list-page"
      requiredRole="analyst"
    >
      <div
        className="grant-list-container"
        role="main"
        aria-label="Grant Proposals Management"
      >
        <GrantList
          userId={user?.id}
          onProposalSelect={handleProposalSelect}
          pageSize={listConfig.pageSize}
          enableBulkOperations={listConfig.enableBulkOperations}
          showVersionHistory={listConfig.showVersionHistory}
          collaborationEnabled={listConfig.collaborationEnabled}
        />

        {/* Error display with accessibility support */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="error-message"
          >
            {error}
          </div>
        )}

        {/* Loading state indicator */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="loading-indicator"
          >
            Loading proposal details...
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

// Add display name for debugging
GrantListPage.displayName = 'GrantListPage';

// Export the component
export default GrantListPage;