import React, { useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import Card, { CardProps } from '../common/Card';
import { IProposal } from '../../interfaces/grant.interface';

import styles from './ProposalPreview.module.css';

/**
 * Props interface for the ProposalPreview component
 */
export interface ProposalPreviewProps {
  /** Proposal data to be displayed */
  proposal: IProposal;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional callback for version selection */
  onVersionSelect?: (version: number) => void;
}

/**
 * Formats the proposal content with enhanced typography and semantic structure
 * @param content - Raw proposal content
 * @returns Formatted JSX content
 */
const formatContent = (content: string): JSX.Element => {
  // Split content into sections while preserving formatting
  const sections = content.split(/\n(?=#{1,6}\s)/);
  
  return (
    <div className={styles['proposal-preview__content']}>
      {sections.map((section, index) => {
        const isHeading = section.match(/^#{1,6}\s/);
        if (isHeading) {
          const level = section.match(/^#+/)?.[0].length || 1;
          const text = section.replace(/^#+\s/, '');
          const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag 
              key={`section-${index}`}
              className={styles[`proposal-preview__heading-${level}`]}
            >
              {text}
            </HeadingTag>
          );
        }
        return (
          <p 
            key={`section-${index}`}
            className={styles['proposal-preview__paragraph']}
          >
            {section}
          </p>
        );
      })}
    </div>
  );
};

/**
 * A React component that provides a read-only preview of grant proposals with
 * enhanced formatting, accessibility, and internationalization support.
 */
export const ProposalPreview: React.FC<ProposalPreviewProps> = ({
  proposal,
  className,
  onVersionSelect
}) => {
  const { t } = useTranslation();

  // Memoize formatted metadata for performance
  const formattedMetadata = useMemo(() => ({
    institution: proposal.metadata.institution,
    department: proposal.metadata.department,
    fundingAmount: new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD'
    }).format(proposal.metadata.fundingAmount),
    deadline: new Intl.Date(proposal.metadata.submissionDeadline)
      .toLocaleDateString(),
    collaborators: proposal.metadata.collaborators.join(', '),
    keywords: proposal.metadata.keywords.join(', ')
  }), [proposal.metadata]);

  // Status indicator configuration
  const statusConfig = {
    DRAFT: { color: 'gray', label: t('status.draft') },
    IN_REVIEW: { color: 'blue', label: t('status.inReview') },
    APPROVED: { color: 'green', label: t('status.approved') },
    SUBMITTED: { color: 'purple', label: t('status.submitted') },
    REJECTED: { color: 'red', label: t('status.rejected') },
    REVISION_REQUESTED: { color: 'yellow', label: t('status.revisionRequested') }
  };

  return (
    <Card
      variant="outlined"
      className={classNames(styles['proposal-preview'], className)}
      role="article"
      aria-label={t('proposal.preview.title', { title: proposal.metadata.title })}
    >
      {/* Header Section */}
      <div className={styles['proposal-preview__header']}>
        <h1 className={styles['proposal-preview__title']}>
          {proposal.metadata.title}
        </h1>
        <div 
          className={classNames(
            styles['proposal-preview__status'],
            styles[`proposal-preview__status--${statusConfig[proposal.status].color}`]
          )}
          aria-label={t('proposal.status', { status: statusConfig[proposal.status].label })}
        >
          {statusConfig[proposal.status].label}
        </div>
      </div>

      {/* Content Section */}
      <div 
        className={styles['proposal-preview__body']}
        role="region"
        aria-label={t('proposal.content')}
      >
        {formatContent(proposal.content)}
      </div>

      {/* Metadata Section */}
      <div 
        className={styles['proposal-preview__metadata']}
        role="complementary"
        aria-label={t('proposal.metadata')}
      >
        <dl>
          {Object.entries(formattedMetadata).map(([key, value]) => (
            <div key={key} className={styles['proposal-preview__metadata-item']}>
              <dt>{t(`proposal.metadata.${key}`)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Version Timeline */}
      {onVersionSelect && (
        <div 
          className={styles['proposal-preview__version']}
          role="navigation"
          aria-label={t('proposal.versions')}
        >
          <h2 className={styles['proposal-preview__version-title']}>
            {t('proposal.version.title')}
          </h2>
          <div className={styles['proposal-preview__version-timeline']}>
            <button
              className={classNames(
                styles['proposal-preview__version-button'],
                proposal.version === proposal.version && styles['proposal-preview__version-button--current']
              )}
              onClick={() => onVersionSelect(proposal.version)}
              aria-current={proposal.version === proposal.version}
            >
              {t('proposal.version.number', { version: proposal.version })}
            </button>
          </div>
        </div>
      )}

      {/* Last Modified Timestamp */}
      <div 
        className={styles['proposal-preview__timestamp']}
        aria-label={t('proposal.lastModified')}
      >
        {t('proposal.lastModified')}: {' '}
        {new Intl.DateTimeFormat(undefined, {
          dateStyle: 'full',
          timeStyle: 'long'
        }).format(proposal.updatedAt)}
      </div>
    </Card>
  );
};

export default React.memo(ProposalPreview);