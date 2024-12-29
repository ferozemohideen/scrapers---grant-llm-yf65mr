import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, jest } from '@jest/globals';
import Button from '../../src/components/common/Button';

// Test data constants
const defaultProps = {
  children: 'Click me',
  variant: 'primary' as const,
  size: 'md' as const,
  disabled: false,
  loading: false,
  ariaLabel: 'Test button',
};

// Mock handlers
const mockHandlers = {
  onClick: jest.fn(),
  onFocus: jest.fn(),
  onBlur: jest.fn(),
};

describe('Button component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Mock matchMedia for high contrast detection
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  describe('Rendering', () => {
    test('renders with default props', () => {
      render(<Button>{defaultProps.children}</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(defaultProps.children);
    });

    test('renders with all variants', () => {
      const variants = ['primary', 'secondary', 'outline', 'text'] as const;
      variants.forEach(variant => {
        const { rerender } = render(
          <Button variant={variant}>{defaultProps.children}</Button>
        );
        const button = screen.getByRole('button');
        expect(button).toHaveClass(variant === 'primary' ? 'bg-[var(--primary-color)]' : '');
        rerender(<></>);
      });
    });

    test('renders with all sizes', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      sizes.forEach(size => {
        const { rerender } = render(
          <Button size={size}>{defaultProps.children}</Button>
        );
        const button = screen.getByRole('button');
        const expectedClass = size === 'md' ? 'px-4 py-2' : size === 'sm' ? 'px-3 py-1.5' : 'px-6 py-3';
        expect(button).toHaveClass(expectedClass);
        rerender(<></>);
      });
    });

    test('renders loading spinner when loading prop is true', () => {
      render(<Button {...defaultProps} loading={true} />);
      const spinner = screen.getByRole('button').querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });
  });

  describe('Interaction handling', () => {
    test('calls onClick handler when clicked', async () => {
      render(<Button {...defaultProps} onClick={mockHandlers.onClick} />);
      const button = screen.getByRole('button');
      await userEvent.click(button);
      expect(mockHandlers.onClick).toHaveBeenCalledTimes(1);
    });

    test('does not call onClick when disabled', async () => {
      render(<Button {...defaultProps} disabled onClick={mockHandlers.onClick} />);
      const button = screen.getByRole('button');
      await userEvent.click(button);
      expect(mockHandlers.onClick).not.toHaveBeenCalled();
    });

    test('does not call onClick when loading', async () => {
      render(<Button {...defaultProps} loading onClick={mockHandlers.onClick} />);
      const button = screen.getByRole('button');
      await userEvent.click(button);
      expect(mockHandlers.onClick).not.toHaveBeenCalled();
    });

    test('handles error in onClick gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      render(<Button {...defaultProps} onClick={errorHandler} />);
      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toBe('Button click handler error:');
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    test('has correct ARIA attributes', () => {
      render(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', defaultProps.ariaLabel);
      expect(button).toHaveAttribute('role', 'button');
    });

    test('has correct disabled state ARIA attributes', () => {
      render(<Button {...defaultProps} disabled />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabIndex', '-1');
    });

    test('has correct loading state ARIA attributes', () => {
      render(<Button {...defaultProps} loading />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('supports keyboard navigation', async () => {
      render(<Button {...defaultProps} onClick={mockHandlers.onClick} />);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.keyPress(button, { key: 'Enter', code: 'Enter' });
      expect(mockHandlers.onClick).toHaveBeenCalled();
    });
  });

  describe('High contrast mode', () => {
    beforeEach(() => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(forced-colors: active)',
          media: query,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });
    });

    test('applies high contrast styles when in forced-colors mode', () => {
      render(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-2', 'border-current');
    });
  });

  describe('Style system integration', () => {
    test('applies custom className correctly', () => {
      const customClass = 'custom-test-class';
      render(<Button {...defaultProps} className={customClass} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass(customClass);
    });

    test('combines variant and size classes correctly', () => {
      render(<Button {...defaultProps} variant="primary" size="lg" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-[var(--primary-color)]', 'px-6', 'py-3');
    });
  });

  describe('Type prop handling', () => {
    test('applies correct button type attribute', () => {
      const types = ['button', 'submit', 'reset'] as const;
      types.forEach(type => {
        const { rerender } = render(
          <Button {...defaultProps} type={type} />
        );
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('type', type);
        rerender(<></>);
      });
    });
  });
});