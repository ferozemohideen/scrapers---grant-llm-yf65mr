import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import GrantEditor, { GrantEditorProps } from '../../src/components/grant/GrantEditor';
import GrantService from '../../src/services/grant.service';
import { IProposal, ProposalStatus } from '../../src/interfaces/grant.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock services and utilities
jest.mock('../../src/services/grant.service');
const mockGrantService = jest.mocked(GrantService);

// Mock WebSocket for collaboration testing
jest.mock('websocket', () => ({
  w3cwebsocket: jest.fn()
}));

// Mock PerformanceObserver for metrics testing
const mockPerformanceObserver = jest.fn();
global.PerformanceObserver = mockPerformanceObserver;

describe('GrantEditor', () => {
  // Default test props
  const defaultProps: GrantEditorProps = {
    technologyId: 'tech-123',
    proposalId: 'proposal-123',
    collaborationConfig: {
      enabled: true,
      users: ['user1', 'user2'],
      permissions: ['edit', 'comment']
    },
    versioningConfig: {
      enabled: true,
      autoSave: true,
      saveInterval: 30000
    },
    performanceConfig: {
      chunkSize: 5000,
      debounceDuration: 1000,
      virtualizationEnabled: true
    }
  };

  // Mock proposal data
  const mockProposal: IProposal = {
    id: 'proposal-123',
    userId: 'user-123',
    technologyId: 'tech-123',
    content: 'Initial proposal content',
    version: 1,
    status: ProposalStatus.DRAFT,
    metadata: {
      title: 'Test Proposal',
      institution: 'Test University',
      department: 'Research',
      fundingAmount: 50000,
      submissionDeadline: new Date('2024-12-31'),
      collaborators: ['user1'],
      keywords: ['technology', 'research'],
      grantType: 'research'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeAll(() => {
    // Configure performance monitoring
    mockPerformanceObserver.mockImplementation((callback) => ({
      observe: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default service mocks
    mockGrantService.getProposal.mockResolvedValue(mockProposal);
    mockGrantService.updateProposal.mockResolvedValue({
      ...mockProposal,
      version: mockProposal.version + 1
    });
  });

  describe('Initialization and Loading', () => {
    it('should load proposal data on mount', async () => {
      render(<GrantEditor {...defaultProps} />);

      await waitFor(() => {
        expect(mockGrantService.getProposal).toHaveBeenCalledWith('proposal-123');
        expect(screen.getByText(mockProposal.content)).toBeInTheDocument();
      });
    });

    it('should handle loading errors gracefully', async () => {
      mockGrantService.getProposal.mockRejectedValue(new Error('Failed to load'));
      
      render(<GrantEditor {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load proposal');
      });
    });

    it('should initialize with correct editor configuration', () => {
      render(<GrantEditor {...defaultProps} />);
      
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-multiline', 'true');
      expect(editor).not.toHaveAttribute('readonly');
    });
  });

  describe('Editing and Content Management', () => {
    it('should update content on user input', async () => {
      const user = userEvent.setup();
      render(<GrantEditor {...defaultProps} />);

      const editor = await screen.findByRole('textbox');
      await user.type(editor, ' Additional content');

      expect(editor).toHaveValue('Initial proposal content Additional content');
    });

    it('should auto-save content after specified interval', async () => {
      jest.useFakeTimers();
      render(<GrantEditor {...defaultProps} />);

      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: 'Updated content' } });

      jest.advanceTimersByTime(30000); // Auto-save interval

      await waitFor(() => {
        expect(mockGrantService.updateProposal).toHaveBeenCalledWith(
          'proposal-123',
          expect.objectContaining({ content: 'Updated content' })
        );
      });

      jest.useRealTimers();
    });

    it('should handle version conflicts', async () => {
      mockGrantService.updateProposal.mockRejectedValueOnce({
        code: 409,
        serverContent: 'Server content'
      });

      render(<GrantEditor {...defaultProps} />);
      
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: 'Conflicting content' } });

      await waitFor(() => {
        expect(screen.getByText('Version Conflict Detected')).toBeInTheDocument();
        expect(screen.getByText('Resolve Conflict')).toBeInTheDocument();
      });
    });
  });

  describe('Collaboration Features', () => {
    it('should display active collaborators', async () => {
      const collaborators = [
        { id: 'user1', name: 'John Doe', cursor: { line: 1, column: 1 } }
      ];

      render(<GrantEditor {...defaultProps} />);

      await waitFor(() => {
        const collaboratorSection = screen.getByClassName('grant-editor__collaborators');
        expect(within(collaboratorSection).getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should handle collaborative changes', async () => {
      render(<GrantEditor {...defaultProps} />);

      // Simulate collaborative change
      await waitFor(() => {
        expect(mockGrantService.subscribeToChanges).toHaveBeenCalledWith(
          'proposal-123',
          expect.any(Function)
        );
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track editor performance metrics', async () => {
      render(<GrantEditor {...defaultProps} />);

      await waitFor(() => {
        expect(mockPerformanceObserver).toHaveBeenCalled();
      });

      // Verify performance entries are collected
      const performanceCallback = mockPerformanceObserver.mock.calls[0][0];
      performanceCallback({
        getEntries: () => [{
          name: 'editor-render',
          duration: 100
        }]
      });
    });

    it('should implement virtualization for large documents', async () => {
      const largeContent = Array(1000).fill('Content line').join('\n');
      mockGrantService.getProposal.mockResolvedValueOnce({
        ...mockProposal,
        content: largeContent
      });

      render(<GrantEditor {...defaultProps} />);

      await waitFor(() => {
        // Verify only visible content is rendered
        const visibleLines = screen.getAllByRole('presentation').length;
        expect(visibleLines).toBeLessThan(1000);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<GrantEditor {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<GrantEditor {...defaultProps} />);

      const editor = await screen.findByRole('textbox');
      await user.tab();
      expect(editor).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages', async () => {
      mockGrantService.updateProposal.mockRejectedValue(new Error('Update failed'));
      
      render(<GrantEditor {...defaultProps} />);
      
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: 'New content' } });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to save proposal');
      });
    });

    it('should recover from temporary errors', async () => {
      mockGrantService.updateProposal
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          ...mockProposal,
          version: mockProposal.version + 1
        });

      render(<GrantEditor {...defaultProps} />);
      
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: 'Retry content' } });

      await waitFor(() => {
        expect(mockGrantService.updateProposal).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });
});