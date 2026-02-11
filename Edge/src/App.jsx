import React, { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import Header from './components/Header/Header';
import TopStats from './components/TopStats/TopStats';
import HypeTracker from './components/HypeTracker/HypeTracker';
import TokenTable from './components/TokenTable/TokenTable';
import FilterBar from './components/FilterBar/FilterBar';
import Sidebar from './components/Sidebar/Sidebar';
import EdgeMemory from './components/EdgeMemory/EdgeMemory';
import EdgeZoneHistory from './components/EdgeZoneHistory/EdgeZoneHistory';
import Footer from './components/Footer/Footer';
import useTokenStore from './store/useTokenStore';
import { api } from './services/api';
import { useWebSocket } from './hooks/useWebSocket';
import './App.css';

// Initialize Query Client
const queryClient = new QueryClient();

function EdgeZoneApp() {
  const qc = useQueryClient();
  const {
    setTokens, setLoading, setError,
    currentPage, trendFilter, searchQuery, setSearchQuery
  } = useTokenStore();

  const [activePage, setActivePage] = useState('terminal');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onNavigate = useCallback((page) => {
    setActivePage(page);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  const backendEnabled = (import.meta.env.VITE_BACKEND_ENABLED ?? 'false') === 'true';

  // WebSocket Subscription
  useWebSocket();

  // React Query for fetching tokens
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tokens', currentPage, trendFilter],
    queryFn: () => api.fetchTokens({ page: currentPage, sort: trendFilter, limit: 100 }),
    enabled: backendEnabled,
    staleTime: 30000,
    refetchInterval: backendEnabled ? 60000 : false,
    retry: (failureCount, err) => {
      if (err?.response?.status === 503 && failureCount < 3) {
        return true;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Sync React Query data to Zustand Store
  useEffect(() => {
    if (!backendEnabled) {
      console.warn('⚠️ Backend is disabled! Check VITE_BACKEND_ENABLED in .env');
      return;
    }
    if (isLoading) setLoading(true);
    if (isError) setError(error?.message || 'Failed to load tokens');

    if (data) {
      setLoading(false);
      const tokens = Array.isArray(data) ? data : data.tokens || [];
      console.log('✅ Setting tokens:', tokens.length, 'tokens');
      setTokens(tokens);
    }
  }, [backendEnabled, data, isLoading, isError, error, setTokens, setLoading, setError]);

  // Handler for header search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  // Handler for manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all queries to force fresh data
      await qc.invalidateQueries({ queryKey: ['tokens'] });
      await refetch();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [qc, refetch]);

  return (
    <>
      <Header
        activePage={activePage}
        onNavigate={onNavigate}
        onSearch={handleSearch}
        searchQuery={searchQuery}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isLoading}
      />
      <div className="container">
        {activePage === 'edge-memory' ? (
          <>
            <EdgeMemory />
            <EdgeZoneHistory />
          </>
        ) : (
          <>
            <TopStats />
            <HypeTracker />

            <div className="content-wrapper">
              <div className="main-panel">
                <FilterBar />
                {isError ? (
                  <div className="error-panel">
                    <span>⚠️ Failed to load tokens</span>
                    <button onClick={handleRefresh}>Retry</button>
                  </div>
                ) : (
                  <TokenTable />
                )}
              </div>
              <Sidebar />
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EdgeZoneApp />
    </QueryClientProvider>
  );
}

export default App;
