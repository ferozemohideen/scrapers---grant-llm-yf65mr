import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { URLConfigForm, URLConfigFormProps, URLConfigValidationResult } from '../../components/config/URLConfigForm';
import { DataGrid, DataGridColumn, BatchOperationProps } from '../../components/common/DataGrid';
import { ConfigService } from '../../services/config.service';
import { debounce } from 'lodash'; // v4.17.21
import { URLConfig, InstitutionType } from '../../interfaces/config.interface';

// State interface for the URL configuration page
interface URLConfigPageState {
  urlConfigs: URLConfig[];
  isLoading: boolean;
  isModalOpen: boolean;
  selectedConfig: URLConfig | null;
  error: string | null;
  selectedConfigs: URLConfig[];
  validationStatus: Record<string, URLConfigValidationResult>;
  filterOptions: {
    searchTerm: string;
    institutionType: InstitutionType | '';
    active: boolean | null;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * URL Configuration Management Page Component
 * Provides comprehensive interface for managing technology transfer data source URLs
 */
const URLConfigPage: React.FC = () => {
  // Initialize state
  const [state, setState] = useState<URLConfigPageState>({
    urlConfigs: [],
    isLoading: false,
    isModalOpen: false,
    selectedConfig: null,
    error: null,
    selectedConfigs: [],
    validationStatus: {},
    filterOptions: {
      searchTerm: '',
      institutionType: '',
      active: null,
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
    },
  });

  // Grid columns configuration
  const columns: DataGridColumn<URLConfig>[] = useMemo(() => [
    {
      key: 'institution.name',
      title: 'Institution',
      sortable: true,
      filterable: true,
      render: (_, record) => record.institution.name,
    },
    {
      key: 'url',
      title: 'URL',
      sortable: true,
      filterable: true,
      render: (value) => (
        <a href={value as string} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ),
    },
    {
      key: 'institution.type',
      title: 'Type',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: Object.values(InstitutionType).map(type => ({
        label: type.replace('_', ' '),
        value: type,
      })),
    },
    {
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Active', value: true },
        { label: 'Inactive', value: false },
      ],
      render: (value) => (
        <span className={`status-badge ${value ? 'active' : 'inactive'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'lastUpdated',
      title: 'Last Updated',
      sortable: true,
      render: (value) => new Date(value as string).toLocaleDateString(),
    },
  ], []);

  // Load URL configurations
  const loadURLConfigs = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { filterOptions, pagination } = state;
      const response = await ConfigService.getURLConfigs(
        {
          institutionType: filterOptions.institutionType as InstitutionType,
          active: filterOptions.active,
          searchTerm: filterOptions.searchTerm,
        },
        {
          page: pagination.page,
          limit: pagination.limit,
        }
      );

      setState(prev => ({
        ...prev,
        urlConfigs: response.data,
        pagination: {
          ...prev.pagination,
          total: response.total,
        },
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load URL configurations',
        isLoading: false,
      }));
    }
  }, [state.filterOptions, state.pagination]);

  // Initialize data load
  useEffect(() => {
    loadURLConfigs();
  }, [loadURLConfigs]);

  // Handle form submission
  const handleSubmit = useCallback(async (config: URLConfig) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      if (state.selectedConfig) {
        await ConfigService.updateURLConfig(state.selectedConfig.id, config);
      } else {
        await ConfigService.createURLConfig(config);
      }
      setState(prev => ({ ...prev, isModalOpen: false }));
      loadURLConfigs();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to save URL configuration',
        isLoading: false,
      }));
    }
  }, [state.selectedConfig, loadURLConfigs]);

  // Handle batch operations
  const handleBatchOperation = useCallback(async (operation: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      switch (operation) {
        case 'activate':
        case 'deactivate':
          await Promise.all(
            state.selectedConfigs.map(config =>
              ConfigService.updateURLConfig(config.id, {
                active: operation === 'activate',
              })
            )
          );
          break;
        case 'delete':
          // Implement delete functionality if needed
          break;
        case 'validate':
          const validationResults = await Promise.all(
            state.selectedConfigs.map(async config => {
              const result = await ConfigService.testURLConfig(config);
              return { config, result };
            })
          );
          setState(prev => ({
            ...prev,
            validationStatus: validationResults.reduce((acc, { config, result }) => ({
              ...acc,
              [config.id]: result,
            }), {}),
          }));
          break;
      }
      loadURLConfigs();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to perform batch operation: ${operation}`,
        isLoading: false,
      }));
    }
  }, [state.selectedConfigs, loadURLConfigs]);

  // Debounced filter handler
  const handleFilterChange = useMemo(
    () =>
      debounce((filters: Record<string, any>) => {
        setState(prev => ({
          ...prev,
          filterOptions: {
            ...prev.filterOptions,
            ...filters,
          },
          pagination: {
            ...prev.pagination,
            page: 1,
          },
        }));
      }, 300),
    []
  );

  return (
    <div className="url-config-page">
      <header className="page-header">
        <h1>URL Configuration Management</h1>
        <div className="header-actions">
          <button
            onClick={() => setState(prev => ({
              ...prev,
              isModalOpen: true,
              selectedConfig: null,
            }))}
            className="btn-primary"
          >
            Add New URL
          </button>
        </div>
      </header>

      {state.error && (
        <div className="error-message" role="alert">
          {state.error}
        </div>
      )}

      <DataGrid
        columns={columns}
        data={state.urlConfigs}
        loading={state.isLoading}
        onFilterChange={handleFilterChange}
        onSelectionChange={(selected) =>
          setState(prev => ({ ...prev, selectedConfigs: selected }))
        }
        defaultFilters={state.filterOptions}
        selectable
        stickyHeader
        currentPage={state.pagination.page}
        pageSize={state.pagination.limit}
        onPageChange={(page) =>
          setState(prev => ({
            ...prev,
            pagination: { ...prev.pagination, page },
          }))
        }
      />

      {state.isModalOpen && (
        <URLConfigForm
          initialValues={state.selectedConfig || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setState(prev => ({ ...prev, isModalOpen: false }))}
          isEdit={!!state.selectedConfig}
          isLoading={state.isLoading}
        />
      )}
    </div>
  );
};

export default URLConfigPage;