import React, { useState, useCallback } from 'react';
import './Header.css';

const Header = ({ activePage = 'terminal', onNavigate, onSearch, onRefresh, searchQuery = '', isRefreshing = false }) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setLocalQuery(value);
    if (onSearch) {
      onSearch(value);
    }
  }, [onSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(localQuery);
    }
  }, [localQuery, onSearch]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch]);

  const handleRefresh = useCallback(() => {
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  }, [onRefresh, isRefreshing]);

  return (
    <header>
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">🔥</div>
          <span>EDGE ZONE™</span>
        </div>
        <nav className="nav-menu">
          <a
            className={activePage === 'terminal' ? 'active' : ''}
            onClick={() => onNavigate && onNavigate('terminal')}
          >
            Overview
          </a>
          <a
            className={activePage === 'edge-memory' ? 'active' : ''}
            onClick={() => onNavigate && onNavigate('edge-memory')}
          >
            Edge Memory
          </a>
        </nav>
      </div>
      <div className="header-right">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search tokens..."
            value={localQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {localQuery && (
            <span className="search-clear" onClick={handleClear}>✕</span>
          )}
        </div>
        <button
          className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh data"
        >
          🔄
        </button>
        <button className="telegram-btn">📱 Telegram</button>
        <button className="notification-btn">🔔</button>
      </div>
    </header>
  );
};

export default Header;
