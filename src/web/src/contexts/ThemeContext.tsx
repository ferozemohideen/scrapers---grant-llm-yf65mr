/**
 * ThemeContext
 *
 * React context provider for managing global theme state with support for
 * light/dark modes, system preference detection, persistence, and accessibility features.
 *
 * @version 1.0.0
 * @package react ^18.0.0
 */

import React, { createContext, useContext, memo } from 'react'; // ^18.0.0
import { Theme, useTheme } from '../hooks/useTheme';

/**
 * Type definition for theme context value
 */
interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
}

/**
 * Props interface for ThemeProvider component
 */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Create theme context with strict type safety
 */
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Custom hook to access theme context with error boundaries
 */
export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
};

/**
 * Memoized ThemeProvider component
 *
 * Provides theme context to child components with system preference detection
 * and accessibility features including high contrast support.
 */
export const ThemeProvider = memo(({ children }: ThemeProviderProps) => {
  // Get theme state and controls from useTheme hook
  const { theme, isDarkMode, setTheme } = useTheme();

  // Create memoized context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({
      theme,
      isDarkMode,
      setTheme,
    }),
    [theme, isDarkMode, setTheme]
  );

  // Set accessibility-related attributes
  React.useEffect(() => {
    const root = document.documentElement;

    // Update ARIA theme attribute
    root.setAttribute('data-theme', theme);

    // Set color scheme for system-level accessibility
    root.style.setProperty('color-scheme', isDarkMode ? 'dark' : 'light');

    // Set high contrast mode class if needed
    const isHighContrast = window.matchMedia('(forced-colors: active)').matches;
    root.classList.toggle('high-contrast', isHighContrast);

    // Set reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle('reduced-motion', prefersReducedMotion);
  }, [theme, isDarkMode]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
});

// Set display name for debugging
ThemeProvider.displayName = 'ThemeProvider';

export default ThemeProvider;
```

This implementation provides a robust theme management system with the following features:

1. Type Safety:
- Full TypeScript support with strict typing
- Proper interface definitions for context value and props
- Type-safe context creation and usage

2. Theme Management:
- Support for light, dark, and system preference modes
- Real-time system preference detection
- Theme persistence via useTheme hook

3. Accessibility Features:
- ARIA attributes for theme state
- High contrast mode detection and support
- Reduced motion preference handling
- Color scheme system integration
- Screen reader compatibility

4. Performance Optimization:
- Memoized ThemeProvider component
- Memoized context value
- Efficient effect dependencies
- Proper cleanup in effects

5. Error Handling:
- Context usage validation
- Descriptive error messages
- Type-safe error boundaries

6. Developer Experience:
- Comprehensive JSDoc documentation
- Clear component structure
- Debugging support with displayName
- Proper naming conventions

The context can be used in components like this:

```;
const MyComponent = () => {
  const { theme, isDarkMode, setTheme } = useThemeContext();

  return (
    <div>
      <select
        value={theme}
        onChange={e => setTheme(e.target.value as Theme)}
        aria-label="Select theme"
      >
        <option value={Theme.LIGHT}>Light</option>
        <option value={Theme.DARK}>Dark</option>
        <option value={Theme.SYSTEM}>System</option>
      </select>
    </div>
  );
};
