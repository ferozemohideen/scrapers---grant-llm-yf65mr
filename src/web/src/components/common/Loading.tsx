import React, { useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import '../../assets/styles/variables.css';

// Interfaces
interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  overlay?: boolean;
  message?: string;
  ariaLabel?: string;
}

// Animations
const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Styled Components
const SpinnerContainer = styled.div<{ overlay?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  ${({ overlay }) => overlay && `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: var(--z-index-modal);
  `}
`;

const Spinner = styled.div<{ 
  size: { width: string; height: string }; 
  color: string;
  prefersReducedMotion: boolean;
}>`
  width: ${props => props.size.width};
  height: ${props => props.size.height};
  border: 2px solid var(--background-color-dark);
  border-top-color: ${props => props.color};
  border-radius: var(--border-radius-full);
  animation: ${props => props.prefersReducedMotion ? 'none' : `${spin} 1s linear infinite`};
  transition: var(--transition-base);
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.5;
  }
`;

const LoadingMessage = styled.span`
  margin-top: var(--spacing-2);
  color: var(--text-color);
  font-size: var(--font-size-sm);
  text-align: center;
  font-family: var(--font-family-base);
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-color);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
`;

// Utility Functions
const getSpinnerSize = (size: LoadingProps['size'] = 'medium'): { width: string; height: string } => {
  const sizes = {
    small: { width: '16px', height: '16px' },
    medium: { width: '32px', height: '32px' },
    large: { width: '48px', height: '48px' }
  };

  // Apply responsive scaling for mobile devices
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
    return {
      width: `calc(${sizes[size].width} * 0.8)`,
      height: `calc(${sizes[size].height} * 0.8)`
    };
  }

  return sizes[size];
};

/**
 * Loading Component
 * 
 * A reusable loading spinner that provides visual feedback during async operations.
 * Supports different sizes, colors, and overlay modes with comprehensive accessibility features.
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  color = 'var(--primary-color)',
  overlay = false,
  message,
  ariaLabel = 'Loading...'
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Handle keyboard events for overlay mode
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (overlay && event.key === 'Escape') {
      // Prevent focus trap in overlay mode
      event.preventDefault();
      // Optional: Add callback for overlay close if needed
    }
  }, [overlay]);

  // Add keyboard event listener for overlay mode
  useEffect(() => {
    if (overlay) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [overlay, handleKeyDown]);

  const spinnerContent = (
    <SpinnerContainer role="status" aria-live="polite" aria-busy="true">
      <Spinner 
        size={getSpinnerSize(size)}
        color={color}
        prefersReducedMotion={prefersReducedMotion}
        aria-hidden="true"
      />
      {message && (
        <LoadingMessage aria-live="polite">
          {message}
        </LoadingMessage>
      )}
      <span className="sr-only">
        {ariaLabel}
      </span>
    </SpinnerContainer>
  );

  // Render with or without overlay
  return overlay ? (
    <Overlay role="dialog" aria-modal="true" aria-label={ariaLabel}>
      {spinnerContent}
    </Overlay>
  ) : spinnerContent;
};

export default Loading;