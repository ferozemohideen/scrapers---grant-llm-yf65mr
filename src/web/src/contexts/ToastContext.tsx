import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid'; // ^8.3.0
import { motion, AnimatePresence } from 'framer-motion'; // ^6.0.0

// Constants
const DEFAULT_TOAST_DURATION = 3000;
const DEFAULT_TOAST_POSITION = 'top-right';

// Toast variant configurations
const TOAST_VARIANTS = {
  success: {
    icon: 'CheckCircleIcon',
    className: 'bg-green-50 text-green-800'
  },
  error: {
    icon: 'XCircleIcon',
    className: 'bg-red-50 text-red-800'
  },
  warning: {
    icon: 'ExclamationCircleIcon',
    className: 'bg-yellow-50 text-yellow-800'
  },
  info: {
    icon: 'InformationCircleIcon',
    className: 'bg-blue-50 text-blue-800'
  }
} as const;

// Type Definitions
export type ToastType = keyof typeof TOAST_VARIANTS;
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  position: ToastPosition;
}

export interface ToastConfig {
  type: ToastType;
  message: string;
  duration?: number;
  position?: ToastPosition;
}

interface ToastContextState {
  toasts: Toast[];
  showToast: (config: ToastConfig) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

// Create Context
const ToastContext = createContext<ToastContextState | undefined>(undefined);

// Toast Container Component
const ToastContainer: React.FC<{
  toasts: Toast[];
  onHide: (id: string) => void;
}> = ({ toasts, onHide }) => {
  // Group toasts by position
  const groupedToasts = toasts.reduce<Record<ToastPosition, Toast[]>>((acc, toast) => {
    if (!acc[toast.position]) {
      acc[toast.position] = [];
    }
    acc[toast.position].push(toast);
    return acc;
  }, {} as Record<ToastPosition, Toast[]>);

  // Position-specific styles
  const getPositionStyles = (position: ToastPosition): React.CSSProperties => {
    const base = { position: 'fixed', zIndex: 50 };
    const positions = {
      'top-right': { top: 20, right: 20 },
      'top-left': { top: 20, left: 20 },
      'bottom-right': { bottom: 20, right: 20 },
      'bottom-left': { bottom: 20, left: 20 }
    };
    return { ...base, ...positions[position] };
  };

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          style={getPositionStyles(position as ToastPosition)}
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="sync">
            {positionToasts.map((toast) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onHide={onHide}
              />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </>
  );
};

// Individual Toast Item Component
const ToastItem: React.FC<{
  toast: Toast;
  onHide: (id: string) => void;
}> = ({ toast, onHide }) => {
  useEffect(() => {
    const duration = toast.duration || DEFAULT_TOAST_DURATION;
    const timer = setTimeout(() => {
      onHide(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onHide]);

  const variant = TOAST_VARIANTS[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`${variant.className} p-4 rounded-lg shadow-lg mb-4 flex items-center max-w-sm`}
      role="alert"
      aria-label={`${toast.type} notification: ${toast.message}`}
    >
      <span className="mr-2" aria-hidden="true">
        {/* Icon component would be rendered here */}
      </span>
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onHide(toast.id)}
        className="ml-auto text-gray-600 hover:text-gray-800"
        aria-label="Close notification"
      >
        {/* Close icon would be rendered here */}
      </button>
    </motion.div>
  );
};

// Provider Component
export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((config: ToastConfig) => {
    const newToast: Toast = {
      id: uuidv4(),
      type: config.type,
      message: config.message,
      duration: config.duration || DEFAULT_TOAST_DURATION,
      position: config.position || DEFAULT_TOAST_POSITION
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toasts,
    showToast,
    hideToast,
    clearAllToasts
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

// Custom Hook
export const useToastContext = (): ToastContextState => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};