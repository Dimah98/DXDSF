import { useState, useEffect, useCallback } from 'react';
import './InventoryOverview.css';

interface ResourceMetadata {
  image: string;
  index: number;
}

interface InventoryOverviewData {
  accounts: string[];
  resources: ResourceMetadata[];
  data: (number | null)[][];
  timestamp: number;
}

interface FilterSettings {
  searchQuery: string;
  hideEmptyColumns: boolean;
}

const STORAGE_KEY = 'inventory-overview-filters';
const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

const InventoryOverview = () => {
  // State management
  const [data, setData] = useState<InventoryOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const filters: FilterSettings = JSON.parse(stored);
        setSearchQuery(filters.searchQuery || '');
        setHideEmptyColumns(filters.hideEmptyColumns || false);
      }
    } catch (e) {
      console.warn('Failed to load filters from localStorage:', e);
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      const filters: FilterSettings = { searchQuery, hideEmptyColumns };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('Failed to save filters to localStorage:', e);
    }
  }, [searchQuery, hideEmptyColumns]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Add timeout to prevent infinite waiting
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/api/inventory/overview', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        setError('Unauthorized. Please log in.');
        setLoading(false);
        // Set empty data instead of staying in loading
        setData({ accounts: [], resources: [], data: [], timestamp: Date.now() });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.error || `HTTP error: ${response.status}`);
        setLoading(false);
        // Set empty data instead of staying in loading
        setData({ accounts: [], resources: [], data: [], timestamp: Date.now() });
        return;
      }

      const result: InventoryOverviewData = await response.json();
      setData(result);
      setLastRefreshTime(Date.now());
    } catch (err) {
      console.error('Fetch error:', err);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timeout. Server is not responding.');
        } else {
          setError(`Failed to load data: ${err.message}`);
        }
      } else {
        setError('Failed to load data. Check your connection.');
      }
      // Set empty data to show empty state instead of infinite loading
      setData({ accounts: [], resources: [], data: [], timestamp: Date.now() });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Filter accounts by search query (case-insensitive)
  const filteredAccounts = data?.accounts.filter((account) =>
    account.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Determine which columns to show (hide empty if enabled)
  const visibleResourceIndices = data?.resources.map((_, idx) => {
    if (!hideEmptyColumns) return idx;

    // Check if column is empty (all values are 0 or null)
    const isEmpty = data?.data.every((row) => {
      const value = row[idx];
      return value === null || value === 0;
    });

    return isEmpty ? -1 : idx;
  }).filter(idx => idx !== -1) || [];

  const visibleResources = visibleResourceIndices.map(idx => data!.resources[idx]);

  // Export to CSV
  const exportToCSV = () => {
    if (!data) return;

    // Build CSV content
    const headers = ['Account', ...visibleResources.map(r => r.image)];
    const rows = filteredAccounts.map((account) => {
      const accountIdx = data.accounts.indexOf(account);
      const values = visibleResourceIndices.map(resourceIdx => {
        const value = data.data[accountIdx][resourceIdx];
        return value !== null ? value : '';
      });
      return [account, ...values];
    });

    // Convert to CSV string
    const csvLines = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];
    const csvContent = csvLines.join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_overview_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format cell value for display
  const formatCellValue = (value: number | null): string => {
    if (value === null || value === 0) return '-';
    return value.toFixed(1);
  };

  // Render loading state
  if (loading && !data) {
    return (
      <div className="inventory-overview">
        <div className="inventory-overview__loading">
          <div className="inventory-overview__spinner"></div>
          <p>Loading inventory data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !data) {
    return (
      <div className="inventory-overview">
        <div className="inventory-overview__error">
          <p className="inventory-overview__error-message">{error}</p>
          <button 
            className="inventory-overview__button" 
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render main content
  return (
    <div className="inventory-overview">
      {/* Toolbar */}
      <div className="inventory-overview__toolbar">
        <div className="inventory-overview__toolbar-left">
          <input
            type="text"
            className="inventory-overview__search"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="inventory-overview__checkbox-label">
            <input
              type="checkbox"
              checked={hideEmptyColumns}
              onChange={(e) => setHideEmptyColumns(e.target.checked)}
            />
            Hide empty resources
          </label>
          <span className="inventory-overview__count">
            {filteredAccounts.length} / {data?.accounts.length || 0} accounts
          </span>
        </div>
        <div className="inventory-overview__toolbar-right">
          <button 
            className="inventory-overview__button" 
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            className="inventory-overview__button inventory-overview__button--export" 
            onClick={exportToCSV}
            disabled={!data || filteredAccounts.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Error banner (if error but we have old data) */}
      {error && data && (
        <div className="inventory-overview__error-banner">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="inventory-overview__table-container">
        <table className="inventory-overview__table">
          <thead>
            <tr>
              <th className="inventory-overview__header inventory-overview__header--account">
                Account
              </th>
              {visibleResources.map((resource) => (
                <th key={resource.index} className="inventory-overview__header">
                  <img 
                    src={resource.image} 
                    alt="Resource" 
                    className="inventory-overview__resource-icon"
                    title={resource.image}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((account) => {
              const accountIdx = data!.accounts.indexOf(account);
              return (
                <tr key={account} className="inventory-overview__row">
                  <td className="inventory-overview__cell inventory-overview__cell--account">
                    {account}
                  </td>
                  {visibleResourceIndices.map((resourceIdx) => {
                    const value = data!.data[accountIdx][resourceIdx];
                    return (
                      <td key={resourceIdx} className="inventory-overview__cell">
                        {formatCellValue(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer with timestamp */}
      {data && (
        <div className="inventory-overview__footer">
          Last updated: {new Date(lastRefreshTime).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default InventoryOverview;
