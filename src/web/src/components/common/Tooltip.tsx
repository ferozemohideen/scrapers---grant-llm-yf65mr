import React, { useRef, useState, useCallback, useEffect } from 'react';
import classnames from 'classnames';
import '../../assets/styles/variables.css';

// Interface for the Tooltip component props
interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
  highContrast?: boolean;
}

// Constants for positioning and animation
const TOOLTIP_VIEWPORT_PADDING = 8;
const POSITIONS = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
} as const;

// Custom hook for calculating tooltip position
const useTooltipPosition = (
  triggerRef: React.RefObject<HTMLElement>,
  tooltipRef: React.RefObject<HTMLElement>,
  preferredPosition: 'top' | 'right' | 'bottom' | 'left'
) => {
  const [position, setPosition] = useState(preferredPosition);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if preferred position fits in viewport
    const positions = {
      top: triggerRect.top - tooltipRect.height - TOOLTIP_VIEWPORT_PADDING >= 0,
      right: triggerRect.right + tooltipRect.width + TOOLTIP_VIEWPORT_PADDING <= viewportWidth,
      bottom: triggerRect.bottom + tooltipRect.height + TOOLTIP_VIEWPORT_PADDING <= viewportHeight,
      left: triggerRect.left - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING >= 0,
    };

    // Determine best position
    let bestPosition = preferredPosition;
    if (!positions[preferredPosition]) {
      const fallbackOrder = ['top', 'right', 'bottom', 'left'];
      bestPosition = fallbackOrder.find(pos => positions[pos as keyof typeof positions]) as typeof preferredPosition || 'top';
    }

    setPosition(bestPosition);

    // Calculate coordinates based on position
    const isRTL = document.dir === 'rtl';
    const coords = {
      x: triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2),
      y: triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2),
    };

    if (isRTL) {
      coords.x = viewportWidth - coords.x - tooltipRect.width;
    }

    setCoordinates(coords);
  }, [preferredPosition]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [calculatePosition]);

  return { position, coordinates };
};

// Custom hook for accessibility
const useTooltipA11y = (tooltipId: string) => {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return {
    triggerProps: {
      'aria-describedby': tooltipId,
      role: 'button',
      tabIndex: 0,
    },
    tooltipProps: {
      id: tooltipId,
      role: 'tooltip',
      'aria-hidden': 'false',
    },
    isKeyboardUser,
  };
};

// Tooltip component
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 200,
  className,
  highContrast = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  const { position: calculatedPosition } = useTooltipPosition(
    triggerRef,
    tooltipRef,
    position
  );

  const { triggerProps, tooltipProps, isKeyboardUser } = useTooltipA11y(tooltipId);

  const showTooltip = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setIsMounted(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setTimeout(() => setIsMounted(false), 200); // Match transition duration
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const tooltipClasses = classnames(
    'absolute px-2 py-1 text-sm rounded shadow-lg transition-opacity duration-200',
    POSITIONS[calculatedPosition],
    {
      'opacity-0': !isVisible,
      'opacity-100': isVisible,
      'bg-gray-900 text-white': !highContrast,
      'bg-white text-black border-2 border-black': highContrast,
    },
    className
  );

  return (
    <div
      ref={triggerRef}
      className="inline-block relative"
      onMouseEnter={!isKeyboardUser ? showTooltip : undefined}
      onMouseLeave={!isKeyboardUser ? hideTooltip : undefined}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      {...triggerProps}
    >
      {children}
      {isMounted && (
        <div
          ref={tooltipRef}
          className={tooltipClasses}
          {...tooltipProps}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;