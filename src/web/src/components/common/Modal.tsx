import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import classnames from 'classnames';
import styled from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import Button from './Button';
import Loading from './Loading';

// Modal size configuration
const modalSizes = {
  sm: 'max-width: 400px',
  md: 'max-width: 600px',
  lg: 'max-width: 800px',
  xl: 'max-width: 1000px'
};

// Styled components with animation support
const ModalOverlay = styled.div<{ isOpen: boolean; disableAnimation: boolean }>`
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
  opacity: ${props => props.isOpen ? 1 : 0};
  transition: ${props => props.disableAnimation ? 'none' : 'opacity var(--duration-normal) var(--easing-standard)'};
`;

const ModalContainer = styled.div<{ 
  isOpen: boolean; 
  size: keyof typeof modalSizes;
  disableAnimation: boolean;
}>`
  background: var(--background-color);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  ${props => modalSizes[props.size]};
  margin: var(--spacing-4);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  position: relative;
  transform: ${props => props.isOpen ? 'scale(1)' : 'scale(0.95)'};
  opacity: ${props => props.isOpen ? 1 : 0};
  transition: ${props => props.disableAnimation ? 'none' : 'transform var(--duration-normal) var(--easing-standard), opacity var(--duration-normal) var(--easing-standard)'};
`;

const ModalHeader = styled.header`
  padding: var(--spacing-4);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--text-color);
`;

const ModalContent = styled.div`
  padding: var(--spacing-4);
  overflow-y: auto;
  flex: 1;
`;

const ModalFooter = styled.footer`
  padding: var(--spacing-4);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-2);
`;

// Props interface
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  animationDuration?: number;
  disableAnimation?: boolean;
}

// Custom hook for focus management
const useModalFocus = (isOpen: boolean) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      const focusableElements = modalRef.current?.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements?.length) {
        (focusableElements[0] as HTMLElement).focus();
      }
    } else if (previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  return modalRef;
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="p-4 text-error-color">
    <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
    <pre className="text-sm">{error.message}</pre>
  </div>
);

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  loading = false,
  footer,
  closeOnOverlayClick = true,
  disableAnimation = false,
}) => {
  const modalRef = useModalFocus(isOpen);
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create portal container if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('modal-root')) {
      const modalRoot = document.createElement('div');
      modalRoot.id = 'modal-root';
      document.body.appendChild(modalRoot);
    }
  }, []);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  const modalContent = (
    <ModalOverlay 
      isOpen={isOpen} 
      onClick={handleOverlayClick}
      disableAnimation={disableAnimation || prefersReducedMotion}
      aria-hidden="true"
    >
      <ModalContainer
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        isOpen={isOpen}
        size={size}
        disableAnimation={disableAnimation || prefersReducedMotion}
      >
        {title && (
          <ModalHeader>
            <ModalTitle id="modal-title">{title}</ModalTitle>
            <Button
              variant="text"
              size="sm"
              onClick={onClose}
              ariaLabel="Close modal"
            >
              ✕
            </Button>
          </ModalHeader>
        )}

        <ModalContent>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            {loading ? (
              <Loading size="medium" overlay={false} message="Loading..." />
            ) : (
              children
            )}
          </ErrorBoundary>
        </ModalContent>

        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContainer>
    </ModalOverlay>
  );

  return isOpen ? createPortal(modalContent, document.getElementById('modal-root')!) : null;
};

export default Modal;