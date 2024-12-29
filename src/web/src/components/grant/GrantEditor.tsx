import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react'; // v4.5.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0

import Form, { FormProps } from '../common/Form';
import GrantService from '../../services/grant.service';
import { IProposal, ProposalStatus } from '../../interfaces/grant.interface';

/**
 * Props interface for the GrantEditor component
 */
export interface GrantEditorProps {
  proposalId?: string;
  technologyId: string;
  readOnly?: boolean;
  onSave?: (proposal: IProposal) => Promise<void>;
  collaborationConfig?: {
    enabled: boolean;
    users: string[];
    permissions: string[];
  };
  versioningConfig?: {
    enabled: boolean;
    autoSave: boolean;
    saveInterval: number;
  };
  performanceConfig?: {
    chunkSize: number;
    debounceDuration: number;
    virtualizationEnabled: boolean;
  };
}

/**
 * Interface for editor state management
 */
interface EditorState {
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  versionLock: {
    version: number;
    lockedBy: string | null;
    lockedAt: Date | null;
  };
  activeCollaborators: Array<{
    id: string;
    name: string;
    cursor: { line: number; column: number };
  }>;
  conflictState: {
    hasConflict: boolean;
    serverContent: string | null;
    localContent: string | null;
  };
  performanceMetrics: {
    lastSaveTime: number;
    changeCount: number;
    renderTime: number;
  };
}

/**
 * Enhanced GrantEditor component with AI assistance, collaboration, and version control
 */
export const GrantEditor: React.FC<GrantEditorProps> = ({
  proposalId,
  technologyId,
  readOnly = false,
  onSave,
  collaborationConfig = { enabled: false, users: [], permissions: [] },
  versioningConfig = { enabled: true, autoSave: true, saveInterval: 30000 },
  performanceConfig = { chunkSize: 5000, debounceDuration: 1000, virtualizationEnabled: true }
}) => {
  // Editor state management
  const [editorState, setEditorState] = useState<EditorState>({
    content: '',
    isDirty: false,
    isSaving: false,
    error: null,
    versionLock: { version: 1, lockedBy: null, lockedAt: null },
    activeCollaborators: [],
    conflictState: { hasConflict: false, serverContent: null, localContent: null },
    performanceMetrics: { lastSaveTime: 0, changeCount: 0, renderTime: 0 }
  });

  // References
  const editorRef = useRef<any>(null);
  const contentRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced content for performance
  const [debouncedContent] = useDebounce(
    editorState.content,
    performanceConfig.debounceDuration
  );

  // Initialize virtualization for large documents
  const rowVirtualizer = useVirtualizer({
    count: editorState.content.split('\n').length,
    getScrollElement: () => editorRef.current?.getScrollElement(),
    estimateSize: () => 20, // Estimated line height
    overscan: 5
  });

  /**
   * Loads initial proposal data
   */
  const loadProposal = useCallback(async () => {
    if (!proposalId) return;

    try {
      const proposal = await GrantService.getProposal(proposalId);
      setEditorState(prev => ({
        ...prev,
        content: proposal.content,
        versionLock: {
          version: proposal.version,
          lockedBy: null,
          lockedAt: null
        }
      }));
    } catch (error) {
      setEditorState(prev => ({
        ...prev,
        error: 'Failed to load proposal'
      }));
    }
  }, [proposalId]);

  /**
   * Handles collaborative changes with conflict resolution
   */
  const handleCollaborativeChanges = useCallback(async (changes: string) => {
    if (!collaborationConfig.enabled) return;

    try {
      const updatedContent = await GrantService.updateProposal(proposalId!, {
        content: changes,
        version: editorState.versionLock.version
      });

      setEditorState(prev => ({
        ...prev,
        content: updatedContent.content,
        versionLock: {
          version: updatedContent.version,
          lockedBy: null,
          lockedAt: null
        }
      }));
    } catch (error: any) {
      if (error.code === 409) { // Conflict detected
        setEditorState(prev => ({
          ...prev,
          conflictState: {
            hasConflict: true,
            serverContent: error.serverContent,
            localContent: changes
          }
        }));
      }
    }
  }, [proposalId, editorState.versionLock, collaborationConfig.enabled]);

  /**
   * Handles version conflicts during saves
   */
  const handleVersionConflict = useCallback(async () => {
    const { serverContent, localContent } = editorState.conflictState;
    if (!serverContent || !localContent) return;

    try {
      const resolvedContent = await GrantService.resolveConflict(proposalId!, {
        serverContent,
        localContent,
        version: editorState.versionLock.version
      });

      setEditorState(prev => ({
        ...prev,
        content: resolvedContent,
        conflictState: {
          hasConflict: false,
          serverContent: null,
          localContent: null
        }
      }));
    } catch (error) {
      setEditorState(prev => ({
        ...prev,
        error: 'Failed to resolve version conflict'
      }));
    }
  }, [proposalId, editorState.conflictState, editorState.versionLock]);

  /**
   * Auto-saves content at specified intervals
   */
  const autoSave = useCallback(async () => {
    if (!versioningConfig.autoSave || !editorState.isDirty) return;

    try {
      setEditorState(prev => ({ ...prev, isSaving: true }));
      
      await handleCollaborativeChanges(editorState.content);
      
      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false,
        performanceMetrics: {
          ...prev.performanceMetrics,
          lastSaveTime: Date.now()
        }
      }));
    } catch (error) {
      setEditorState(prev => ({
        ...prev,
        isSaving: false,
        error: 'Auto-save failed'
      }));
    }
  }, [editorState.content, editorState.isDirty, handleCollaborativeChanges, versioningConfig.autoSave]);

  // Setup auto-save interval
  useEffect(() => {
    if (versioningConfig.autoSave) {
      saveTimeoutRef.current = setInterval(autoSave, versioningConfig.saveInterval);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current);
      }
    };
  }, [autoSave, versioningConfig]);

  // Handle content changes
  useEffect(() => {
    if (debouncedContent !== contentRef.current) {
      contentRef.current = debouncedContent;
      setEditorState(prev => ({ ...prev, isDirty: true }));
    }
  }, [debouncedContent]);

  // Load initial data
  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  return (
    <div className="grant-editor">
      {editorState.error && (
        <div className="grant-editor__error" role="alert">
          {editorState.error}
        </div>
      )}

      {editorState.conflictState.hasConflict && (
        <div className="grant-editor__conflict">
          <h3>Version Conflict Detected</h3>
          <button onClick={handleVersionConflict}>
            Resolve Conflict
          </button>
        </div>
      )}

      <Editor
        height="600px"
        defaultLanguage="markdown"
        value={editorState.content}
        onChange={(value) => {
          setEditorState(prev => ({
            ...prev,
            content: value || '',
            performanceMetrics: {
              ...prev.performanceMetrics,
              changeCount: prev.performanceMetrics.changeCount + 1
            }
          }));
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false
        }}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
      />

      {collaborationConfig.enabled && (
        <div className="grant-editor__collaborators">
          {editorState.activeCollaborators.map(collaborator => (
            <div key={collaborator.id} className="collaborator">
              {collaborator.name}
            </div>
          ))}
        </div>
      )}

      <div className="grant-editor__status">
        {editorState.isSaving ? 'Saving...' : 'All changes saved'}
        {editorState.isDirty && ' (Unsaved changes)'}
      </div>
    </div>
  );
};

GrantEditor.displayName = 'GrantEditor';

export default GrantEditor;