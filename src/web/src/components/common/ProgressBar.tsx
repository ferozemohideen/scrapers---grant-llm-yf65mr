import React from 'react'; // ^18.0.0
import styled, { keyframes } from 'styled-components'; // ^5.3.0
import '../../assets/styles/variables.css';

// Interfaces
interface ProgressBarProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  animated?: boolean;
  ariaLabel?: string;
}

// Helper function to get size-specific height values
const getSizeValue = (size?: 'sm' | 'md' | 'lg'): string => {
  switch (size) {
    case 'sm':
      return '0.5rem';
    case 'lg':
      return '1rem';
    case 'md':
    default:
      return '0.75rem';
  }
};

// Animation keyframes for progress pulse effect
const progressPulseKeyframes = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 1;
  }
`;

// Styled Components
const ProgressBarContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  gap: var(--spacing-2);
  position: relative;
`;

const ProgressBarTrack = styled.div<{ size?: 'sm' | 'md' | 'lg' }>`
  width: 100%;
  height: ${props => getSizeValue(props.size)};
  background-color: var(--background-color-dark);
  border-radius: var(--border-radius-sm);
  overflow: hidden;
  position: relative;
`;

const ProgressBarFill = styled.div<{
  progress: number;
  variant: 'primary' | 'success' | 'warning' | 'error';
  animated?: boolean;
}>`
  width: ${props => `${props.progress}%`};
  height: 100%;
  background-color: var(--${props => props.variant}-color);
  transition: width var(--transition-base);
  animation: ${props => props.animated ? `${progressPulseKeyframes} 2s infinite` : 'none'};
  transform-origin: left center;
`;

const ProgressText = styled.span`
  font-size: var(--font-size-sm);
  color: var(--text-color);
  min-width: 3.5em;
  text-align: right;
  user-select: none;
`;

// Main Component
const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  progress: rawProgress,
  size = 'md',
  variant = 'primary',
  showPercentage = true,
  animated = false,
  ariaLabel,
}) => {
  // Ensure progress is bounded between 0 and 100
  const progress = Math.min(Math.max(0, rawProgress), 100);
  
  // Round progress for display
  const displayProgress = Math.round(progress);

  return (
    <ProgressBarContainer>
      <ProgressBarTrack
        size={size}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || 'Progress indicator'}
        tabIndex={-1}
      >
        <ProgressBarFill
          progress={progress}
          variant={variant}
          animated={animated}
          data-testid="progress-bar-fill"
        />
      </ProgressBarTrack>
      {showPercentage && (
        <ProgressText data-testid="progress-text">
          {displayProgress}%
        </ProgressText>
      )}
    </ProgressBarContainer>
  );
});

// Display name for debugging
ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;