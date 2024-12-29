import React, { useState, useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // v2.3.1
import debounce from 'lodash/debounce'; // v4.17.21
import { Form, Field, FormProps } from '../common/Form';
import useForm from '../../hooks/useForm';
import { GrantService } from '../../services/grant.service';
import { IProposal, ProposalStatus } from '../../interfaces/grant.interface';

/**
 * Props interface for the ProposalForm component
 */
export interface ProposalFormProps {
  proposal: IProposal | null;
  technologyId: string;
  onSubmit: (proposal: IProposal) => Promise<void>;
  onCancel: () => void;
  collaborators?: string[];
  onVersionConflict?: (conflicts: any[]) => Promise<void>;
  onCollaboratorUpdate?: (collaborators: string[]) => void;
}

/**
 * Enhanced form component for creating and editing grant proposals with AI assistance
 * and real-time collaboration features.
 */
export const ProposalForm: React.FC<ProposalFormProps> = ({
  proposal,
  technologyId,
  onSubmit,
  onCancel,
  collaborators = [],
  onVersionConflict,
  onCollaboratorUpdate
}) => {
  // Service instance
  const grantService = new GrantService(null, {
    enableRealTimeUpdates: true,
    aiModelVersion: 'gpt-4'
  });

  // State management
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [versionConflict, setVersionConflict] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Form validation schema
  const validationSchema = {
    title: (value: string) => !value ? 'Title is required' : undefined,
    content: (value: string) => {
      if (!value) return 'Content is required';
      if (value.length < 1000) return 'Content must be at least 1000 characters';
      return undefined;
    },
    fundingAmount: (value: number) => {
      if (!value) return 'Funding amount is required';
      if (value < 1000) return 'Minimum funding amount is $1,000';
      if (value > 10000000) return 'Maximum funding amount is $10,000,000';
      return undefined;
    },
    submissionDeadline: (value: string) => {
      if (!value) return 'Submission deadline is required';
      const deadline = new Date(value);
      if (deadline < new Date()) return 'Deadline cannot be in the past';
      return undefined;
    }
  };

  // Initialize form with proposal data or defaults
  const initialValues = proposal ? {
    title: proposal.metadata.title,
    content: proposal.content,
    fundingAmount: proposal.metadata.fundingAmount,
    submissionDeadline: proposal.metadata.submissionDeadline.toISOString().split('T')[0],
    department: proposal.metadata.department,
    keywords: proposal.metadata.keywords.join(', ')
  } : {
    title: '',
    content: '',
    fundingAmount: 0,
    submissionDeadline: '',
    department: '',
    keywords: ''
  };

  // Enhanced form hook with real-time validation
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    setFieldValue,
    handleSubmit
  } = useForm({
    initialValues,
    validationSchema,
    onSubmit: async (formValues) => {
      try {
        const proposalData: Partial<IProposal> = {
          content: formValues.content,
          metadata: {
            title: formValues.title,
            fundingAmount: Number(formValues.fundingAmount),
            submissionDeadline: new Date(formValues.submissionDeadline),
            department: formValues.department,
            keywords: formValues.keywords.split(',').map(k => k.trim()),
            institution: '', // Set from user context
            collaborators,
            grantType: 'RESEARCH' // Set based on technology type
          },
          status: ProposalStatus.DRAFT,
          version: proposal?.version ?? 1
        };

        if (proposal) {
          await grantService.updateProposal(proposal.id, proposalData);
        } else {
          await grantService.createProposal(proposalData, technologyId);
        }

        await onSubmit(proposalData as IProposal);
      } catch (error) {
        if (error.message.includes('version conflict')) {
          setVersionConflict(true);
          onVersionConflict?.([error.conflicts]);
        } else {
          throw error;
        }
      }
    }
  });

  // Handle AI-assisted content generation
  const handleGenerateContent = useCallback(async () => {
    try {
      setIsGenerating(true);
      abortControllerRef.current = new AbortController();

      const result = await grantService.generateProposal(
        technologyId,
        {
          grantType: 'RESEARCH',
          fundingAmount: values.fundingAmount,
          deadline: new Date(values.submissionDeadline),
          keywords: values.keywords.split(',').map(k => k.trim())
        },
        (progress, status) => {
          setGenerationProgress(progress);
          setGenerationStatus(status);
        }
      );

      setFieldValue('content', result.content);
      
      // Update metadata with AI suggestions
      if (result.metadata) {
        Object.entries(result.metadata).forEach(([key, value]) => {
          if (!values[key]) {
            setFieldValue(key, value);
          }
        });
      }
    } catch (error) {
      console.error('Content generation failed:', error);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
      abortControllerRef.current = null;
    }
  }, [technologyId, values, setFieldValue]);

  // Cancel content generation
  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setGenerationProgress(0);
    setGenerationStatus('');
  }, []);

  // Real-time collaboration setup
  useEffect(() => {
    if (proposal?.id) {
      const cleanup = grantService.initializeRealtimeUpdates(proposal.id);
      return () => {
        cleanup();
      };
    }
  }, [proposal?.id]);

  // Update collaborators
  useEffect(() => {
    onCollaboratorUpdate?.(collaborators);
  }, [collaborators, onCollaboratorUpdate]);

  return (
    <Form
      id="proposal-form"
      className={classNames('proposal-form', {
        'proposal-form--generating': isGenerating,
        'proposal-form--conflict': versionConflict
      })}
      onSubmit={handleSubmit}
    >
      <div className="proposal-form__header">
        <h2>{proposal ? 'Edit Proposal' : 'New Proposal'}</h2>
        {collaborators.length > 0 && (
          <div className="proposal-form__collaborators">
            <span>Collaborators: </span>
            {collaborators.join(', ')}
          </div>
        )}
      </div>

      <Field
        id="title"
        name="title"
        type="text"
        label="Proposal Title"
        required
      />

      <Field
        id="department"
        name="department"
        type="text"
        label="Department"
      />

      <div className="proposal-form__row">
        <Field
          id="fundingAmount"
          name="fundingAmount"
          type="number"
          label="Funding Amount ($)"
          required
        />

        <Field
          id="submissionDeadline"
          name="submissionDeadline"
          type="date"
          label="Submission Deadline"
          required
        />
      </div>

      <Field
        id="keywords"
        name="keywords"
        type="text"
        label="Keywords (comma-separated)"
      />

      <div className="proposal-form__content">
        <label htmlFor="content">Proposal Content</label>
        <textarea
          id="content"
          name="content"
          value={values.content}
          onChange={(e) => setFieldValue('content', e.target.value)}
          className={classNames({
            'has-error': touched.content && errors.content
          })}
        />
        {touched.content && errors.content && (
          <div className="error-message">{errors.content}</div>
        )}
      </div>

      <div className="proposal-form__actions">
        <button
          type="button"
          onClick={handleGenerateContent}
          disabled={isGenerating || !values.fundingAmount || !values.submissionDeadline}
          className="button button--secondary"
        >
          {isGenerating ? 'Generating...' : 'Generate Content'}
        </button>

        {isGenerating && (
          <>
            <div className="generation-progress">
              <div 
                className="generation-progress__bar"
                style={{ width: `${generationProgress}%` }}
              />
              <span>{generationStatus}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelGeneration}
              className="button button--text"
            >
              Cancel Generation
            </button>
          </>
        )}

        <div className="proposal-form__submit">
          <button
            type="button"
            onClick={onCancel}
            className="button button--text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting || isGenerating}
            className="button button--primary"
          >
            {isSubmitting ? 'Saving...' : proposal ? 'Update Proposal' : 'Create Proposal'}
          </button>
        </div>
      </div>
    </Form>
  );
};

export default ProposalForm;