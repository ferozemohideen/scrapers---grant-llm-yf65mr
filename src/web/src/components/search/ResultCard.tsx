import React, { useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import Card from '../common/Card';
import type { SearchResult } from '../../interfaces/search.interface';

/**
 * Props interface for the ResultCard component with accessibility and loading states
 */
interface ResultCardProps {
  /** Search result data including highlights and tags */
  result: SearchResult;
  /** Callback when card is selected via click or keyboard */
  onSelect?: (id: string) => void;
  /** Additional CSS classes for styling customization */
  className?: string;
  /** Loading state for skeleton display */
  isLoading?: boolean;
  /** Search term for highlighting matches */
  highlightTerm?: string;
}

/**
 * Styles configuration for the ResultCard component
 */
const resultCardStyles = {
  container: 'hover:shadow-lg transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary-500',
  header: 'text-lg md:text-xl font-semibold text-primary-900 dark:text-primary-100',
  description: 'text-sm md:text-base text-gray-600 dark:text-gray-300 line-clamp-3',
  metadata: 'text-xs md:text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center',
  score: 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-200 px-2 py-1 rounded-full text-xs',
  skeleton: 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
  tags: 'flex flex-wrap gap-2 mt-2',
  tag: 'text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full',
};

/**
 * A memoized component that displays a technology transfer search result with
 * comprehensive accessibility features and responsive design.
 *
 * @component
 * @example
 * ```tsx
 * <ResultCard
 *   result={searchResult}
 *   onSelect={(id) => handleSelect(id)}
 *   isLoading={false}
 *   highlightTerm="innovation"
 * />
 * ```
 */
const ResultCard: React.FC<ResultCardProps> = React.memo(({
  result,
  onSelect,
  className,
  isLoading = false,
  highlightTerm,
}) => {
  // Memoize date formatting to prevent unnecessary recalculations
  const formattedDate = useMemo(() => {
    return format(new Date(result.discoveredAt), 'MMM d, yyyy');
  }, [result.discoveredAt]);

  // Memoize click handler to prevent unnecessary recreations
  const handleClick = useCallback(() => {
    onSelect?.(result.id);
  }, [onSelect, result.id]);

  // Memoize keyboard handler for accessibility
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(result.id);
    }
  }, [onSelect, result.id]);

  // Render loading skeleton
  if (isLoading) {
    return (
      <Card className={resultCardStyles.container}>
        <div className="space-y-4">
          <div className={`h-6 w-3/4 ${resultCardStyles.skeleton}`} />
          <div className="space-y-2">
            <div className={`h-4 w-full ${resultCardStyles.skeleton}`} />
            <div className={`h-4 w-5/6 ${resultCardStyles.skeleton}`} />
            <div className={`h-4 w-4/6 ${resultCardStyles.skeleton}`} />
          </div>
          <div className={`h-4 w-1/4 ${resultCardStyles.skeleton}`} />
        </div>
      </Card>
    );
  }

  // Highlight matching text if search term is provided
  const highlightText = (text: string): React.ReactNode => {
    if (!highlightTerm) return text;
    
    const parts = text.split(new RegExp(`(${highlightTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlightTerm?.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <Card
      variant="interactive"
      className={className}
      onClick={onSelect ? handleClick : undefined}
      onKeyPress={onSelect ? handleKeyPress : undefined}
      role="article"
      aria-label={`Technology: ${result.title}`}
      data-testid="result-card"
    >
      {/* Title Section */}
      <h3 className={resultCardStyles.header}>
        {result.highlights.title.length > 0
          ? <span dangerouslySetInnerHTML={{ __html: result.highlights.title[0] }} />
          : highlightText(result.title)}
      </h3>

      {/* Description Section */}
      <p className={resultCardStyles.description}>
        {result.highlights.description.length > 0
          ? <span dangerouslySetInnerHTML={{ __html: result.highlights.description[0] }} />
          : highlightText(result.description)}
      </p>

      {/* Tags Section */}
      {result.tags.length > 0 && (
        <div className={resultCardStyles.tags}>
          {result.tags.map((tag) => (
            <span key={tag} className={resultCardStyles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata Section */}
      <div className={resultCardStyles.metadata}>
        <div className="flex items-center gap-2">
          <span>{result.institution}</span>
          <span>•</span>
          <span>{result.category}</span>
        </div>
        <div className="flex items-center gap-4">
          <time dateTime={result.discoveredAt}>{formattedDate}</time>
          <span className={resultCardStyles.score} title="Relevance score">
            {Math.round(result.score * 100)}%
          </span>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
ResultCard.displayName = 'ResultCard';

export default ResultCard;