import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion'; // ^6.0.0
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/react'; // ^2.0.0
import { TOAST_VARIANTS } from '../../contexts/ToastContext';

// Animation variants for toast notifications
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
};

// Map of toast types to their respective icons
const TOAST_ICONS = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationCircleIcon,
  info: InformationCircleIcon
} as const;

interface ToastProps {
  id: string;
  type: keyof typeof TOAST_VARIANTS;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  onClose,
  duration,
  position
}) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const pausedRef = useRef<boolean>(false);

  // Set up auto-dismiss timer
  useEffect(() => {
    if (duration && !pausedRef.current) {
      timerRef.current = setTimeout(() => {
        onClose(id);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, id, onClose]);

  // Handle mouse enter/leave for pause functionality
  const handleMouseEnter = () => {
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleMouseLeave = () => {
    pausedRef.current = false;
    if (duration) {
      timerRef.current = setTimeout(() => {
        onClose(id);
      }, duration);
    }
  };

  // Get the appropriate icon component
  const IconComponent = TOAST_ICONS[type];
  const variant = TOAST_VARIANTS[type];

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      variants={ANIMATION_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${variant.className} flex items-center p-4 rounded-lg shadow-lg max-w-sm w-full pointer-events-auto`}
      data-testid={`toast-${id}`}
    >
      <div className="flex-shrink-0">
        <IconComponent
          className="h-5 w-5"
          aria-hidden="true"
        />
      </div>
      
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onClose(id)}
        className="ml-4 flex-shrink-0 rounded-md p-1.5 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Close notification"
      >
        <XCircleIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export default Toast;