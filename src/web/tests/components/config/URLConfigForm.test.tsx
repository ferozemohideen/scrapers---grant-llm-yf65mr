import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { URLConfigForm } from '../../../components/config/URLConfigForm';
import { ConfigService } from '../../../services/config.service';
import { InstitutionType } from '../../../interfaces/config.interface';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock ConfigService
jest.mock('../../../services/config.service', () => ({
  testURLConfig: jest.fn(),
  validateSelectors: jest.fn()
}));

// Test data
const validURLConfig = {
  url: 'https://techfinder.stanford.edu/',
  institution: {
    name: 'Stanford University',
    type: InstitutionType.US_UNIVERSITY,
    country: 'US',
    metadata: {
      contactEmail: 'contact@stanford.edu',
      apiKeyEnv: '',
      refreshInterval: 14
    }
  },
  scraping: {
    selectors: {
      title: '.tech-title',
      description: '.tech-description',
      pagination: '.pagination',
      custom: {}
    },
    rateLimit: 2,
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000
    }
  },
  active: true,
  lastUpdated: new Date()
};

describe('URLConfigForm', () => {
  let mockOnSubmit: jest.Mock;
  let mockOnCancel: jest.Mock;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockOnSubmit = jest.fn();
    mockOnCancel = jest.fn();
    user = userEvent.setup();
    
    // Reset all mocks
    jest.clearAllMocks();
    (ConfigService.testURLConfig as jest.Mock).mockResolvedValue({
      accessible: true,
      responseTime: 200,
      validSelectors: true
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-busy', 'false');

    // Check required field indicators
    const requiredFields = screen.getAllByText('*');
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it('renders all form sections correctly', () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Verify section headings
    expect(screen.getByText('Institution Details')).toBeInTheDocument();
    expect(screen.getByText('URL Configuration')).toBeInTheDocument();
    expect(screen.getByText('Scraping Configuration')).toBeInTheDocument();

    // Verify essential fields
    expect(screen.getByLabelText(/Institution Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Base URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Title Selector/i)).toBeInTheDocument();
  });

  it('handles URL validation and testing', async () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Test invalid URL
    const urlInput = screen.getByLabelText(/Base URL/i);
    await user.type(urlInput, 'invalid-url');
    await waitFor(() => {
      expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument();
    });

    // Test valid URL
    await user.clear(urlInput);
    await user.type(urlInput, validURLConfig.url);
    
    // Test connection
    const testButton = screen.getByText(/Test Connection/i);
    await user.click(testButton);
    
    expect(ConfigService.testURLConfig).toHaveBeenCalledWith(
      expect.objectContaining({ url: validURLConfig.url })
    );
    
    await waitFor(() => {
      expect(testButton).not.toBeDisabled();
    });
  });

  it('validates institution details', async () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Try to submit without required fields
    const submitButton = screen.getByText(/Create Configuration/i);
    await user.click(submitButton);

    // Check required field errors
    await waitFor(() => {
      expect(screen.getByText(/Institution name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Contact email is required/i)).toBeInTheDocument();
    });

    // Fill required fields
    await user.type(screen.getByLabelText(/Institution Name/i), validURLConfig.institution.name);
    await user.type(
      screen.getByLabelText(/Contact Email/i),
      validURLConfig.institution.metadata.contactEmail
    );

    // Verify errors are cleared
    await waitFor(() => {
      expect(screen.queryByText(/Institution name is required/i)).not.toBeInTheDocument();
    });
  });

  it('manages scraping settings correctly', async () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill scraping configuration
    await user.type(
      screen.getByLabelText(/Title Selector/i),
      validURLConfig.scraping.selectors.title
    );
    await user.type(
      screen.getByLabelText(/Description Selector/i),
      validURLConfig.scraping.selectors.description
    );
    await user.type(
      screen.getByLabelText(/Rate Limit/i),
      validURLConfig.scraping.rateLimit.toString()
    );

    // Submit form with valid data
    await user.click(screen.getByText(/Create Configuration/i));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          scraping: expect.objectContaining({
            selectors: expect.objectContaining({
              title: validURLConfig.scraping.selectors.title,
              description: validURLConfig.scraping.selectors.description
            }),
            rateLimit: validURLConfig.scraping.rateLimit
          })
        })
      );
    });
  });

  it('handles edit mode correctly', () => {
    render(
      <URLConfigForm
        initialValues={validURLConfig}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isEdit={true}
      />
    );

    // Verify form is populated with initial values
    expect(screen.getByLabelText(/Institution Name/i)).toHaveValue(validURLConfig.institution.name);
    expect(screen.getByLabelText(/Base URL/i)).toHaveValue(validURLConfig.url);
    expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument();
  });

  it('handles cancellation correctly', async () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Click cancel button
    await user.click(screen.getByText(/Cancel/i));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows API key field for federal labs', async () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Select federal lab institution type
    const typeSelect = screen.getByLabelText(/Institution Type/i);
    await user.selectOptions(typeSelect, InstitutionType.FEDERAL_LAB);

    // Verify API key field appears
    await waitFor(() => {
      expect(screen.getByLabelText(/API Key Environment Variable/i)).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', () => {
    render(
      <URLConfigForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    // Verify buttons are disabled during loading
    expect(screen.getByText(/Create Configuration/i)).toBeDisabled();
    expect(screen.getByText(/Test Connection/i)).toBeDisabled();
    expect(screen.getByText(/Cancel/i)).toBeDisabled();
  });
});