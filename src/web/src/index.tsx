/**
 * Application Entry Point
 * 
 * Initializes the React application with comprehensive error handling,
 * performance monitoring, security features, and required providers.
 * 
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import { createRoot } from 'react-dom/client'; // ^18.0.0
import * as Sentry from '@sentry/react'; // ^7.0.0
import { BrowserTracing } from '@sentry/tracing'; // ^7.0.0
import { ErrorBoundary } from '@sentry/react';

// Internal imports
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

// Initialize error monitoring and performance tracing
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    integrations: [new BrowserTracing()],
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      // Sanitize sensitive data before sending
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    }
  });
}

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert"
    className="error-boundary-fallback"
    style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #ff0000',
      borderRadius: '4px'
    }}
  >
    <h2>Something went wrong:</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>
      {error.message}
    </pre>
    <button 
      onClick={() => window.location.reload()}
      style={{
        padding: '8px 16px',
        marginTop: '16px',
        backgroundColor: '#0066cc',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Reload Application
    </button>
  </div>
);

// Root element validation
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Create root with concurrent features
const root = createRoot(rootElement);

// Render application with provider hierarchy
root.render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error) => {
        console.error('Application Error:', error);
        // Log to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
          Sentry.captureException(error);
        }
      }}
    >
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    // Re-render your app when hot updates are available
    const NextApp = require('./App').default;
    root.render(
      <React.StrictMode>
        <ErrorBoundary fallback={ErrorFallback}>
          <ThemeProvider>
            <ToastProvider>
              <NextApp />
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
}

// Report web vitals in production
if (process.env.NODE_ENV === 'production') {
  const reportWebVitals = async (metric: any) => {
    // Send metrics to analytics service
    try {
      await Sentry.sendEvent({
        message: 'Web Vitals',
        level: 'info',
        extra: {
          metric
        }
      });
    } catch (error) {
      console.error('Failed to send web vitals:', error);
    }
  };

  reportWebVitals();
}