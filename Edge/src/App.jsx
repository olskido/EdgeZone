// src/App.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import useTokenStore from './store/useTokenStore';
import { api } from './services/api';
import './App.css';

// Components
import Header from './components/Header/Header';
import TokenTable from './components/TokenTable/TokenTable';
import Sidebar from './components/Sidebar/Sidebar';
import RiskLegend from './components/RiskLegend/RiskLegend';
import Footer from './components/Footer/Footer';

// Query client with longer timeouts for multi-search
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45000, // 45 seconds
      refetchInterval: 60000, // 1 minute (slower to avoid rate limits)
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: 2000,
    },
  },
});

function EdgeZoneApp() {
  const qc = useQueryClient();
  const { selectedToken, selectToken } = useTokenStore();
  const [activePage, setActivePage] = useState('terminal');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Handle window resize for responsive check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onNavigate = useCallback((page) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackToTable = () => {
    selectToken(null);
  };

  // Fetch tokens with React Query
  const { data, isLoading, isError, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.fetchTokens({ limit: 200 }),
    staleTime: 45000,
    refetchInterval: 60000,
    retry: 1,
  });

  // Sync to Zustand
  useEffect(() => {
    if (isLoading || isFetching) {
      useTokenStore.setState({ loading: true, error: null });
      return;
    }

    if (isError) {
      useTokenStore.setState({
        loading: false,
        error: error?.message || 'Failed to fetch trending tokens',
      });
      console.error('❌ Fetch error:', error);
      return;
    }

    if (data) {
      const tokenList = Array.isArray(data) ? data : data.tokens || [];

      useTokenStore.setState({
        tokens: tokenList,
        loading: false,
        error: null,
        lastFetchTime: data.lastUpdate || new Date().toISOString(),
      });

      const time = new Date().toLocaleTimeString();
      console.log(`🚀 EdgeZone: ${tokenList.length} tokens loaded at ${time}`);
    }
  }, [data, isLoading, isError, error, isFetching]);

  // Log updates
  useEffect(() => {
    if (dataUpdatedAt && !isLoading) {
      const updateTime = new Date(dataUpdatedAt).toLocaleTimeString();
      console.log(`🔄 Data refreshed at ${updateTime}`);
    }
  }, [dataUpdatedAt, isLoading]);

  const handleSearch = useCallback((query) => {
    useTokenStore.setState({ searchQuery: query });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    console.log('🔄 Manual refresh started...');
    try {
      // refetch() alone is enough to update data in background without clearing it
      // invalidateQueries might cause a hard loading state depending on config, so we start with refetch
      await refetch();
      console.log('✅ Manual refresh complete');
    } catch (err) {
      console.error('❌ Refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [refetch]);

  return (
    <>
      <Header
        activePage={activePage}
        onNavigate={onNavigate}
        onSearch={handleSearch}
        searchQuery={useTokenStore(s => s.searchQuery)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isFetching}
      />

      {activePage === 'terminal' && (
        <>
          <RiskLegend />
          <div className="terminal-layout">
            {isError ? (
              <ErrorPanel error={error} onRetry={handleRefresh} />
            ) : isLoading ? (
              <LoadingPanel />
            ) : (
              <>
                {/* Table Section - Hidden on mobile if token selected */}
                <div className={`table-section ${isMobile && selectedToken ? 'mobile-hidden' : ''}`}>
                  <TokenTable />
                </div>

                {/* Sidebar Section - Always rendered, hidden on mobile if NO token selected */}
                <div className={`sidebar-section ${isMobile && !selectedToken ? 'mobile-hidden' : ''}`}>
                  <Sidebar
                    isMobile={isMobile}
                    onBack={handleBackToTable}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activePage === 'edge-memory' && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <h2>🧠 Edge Memory</h2>
          <p>Module under construction</p>
        </div>
      )}

      <Footer />
    </>
  );
}

// Loading indicator
function LoadingPanel() {
  return (
    <div style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '12px',
      margin: '2rem 0',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
        🔍
      </div>
      <h2 style={{
        color: '#3b82f6',
        marginBottom: '1rem',
        fontSize: '1.5rem',
        fontWeight: '600',
      }}>
        Scanning Solana Markets...
      </h2>
      <p style={{
        color: '#94a3b8',
        fontSize: '1rem',
      }}>
        Searching trending tokens across DexScreener
      </p>
      <div style={{
        marginTop: '1.5rem',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        This may take 5-10 seconds on first load
      </div>
    </div>
  );
}

// Error display
function ErrorPanel({ error, onRetry }) {
  return (
    <div style={{
      padding: '3rem 2rem',
      textAlign: 'center',
      background: 'rgba(220, 38, 38, 0.1)',
      border: '1px solid rgba(220, 38, 38, 0.3)',
      borderRadius: '12px',
      margin: '2rem 0',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{
        color: '#ef4444',
        marginBottom: '1rem',
        fontSize: '1.5rem',
        fontWeight: '600',
      }}>
        Connection Error
      </h2>
      <p style={{
        color: '#cbd5e1',
        marginBottom: '2rem',
        fontSize: '1rem',
        maxWidth: '500px',
        margin: '0 auto 2rem',
      }}>
        {error?.message || 'Unable to fetch market data from DexScreener'}
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '0.875rem 2rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: '600',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        🔄 Retry Connection
      </button>
      <div style={{
        marginTop: '1.5rem',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        Check browser console (F12) for details
      </div>
    </div>
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