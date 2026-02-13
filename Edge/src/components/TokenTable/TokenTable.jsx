import React, { useState } from 'react';
import useTokenStore from '../../store/useTokenStore';
import './TokenTable.css';

// Formatter Helpers
const formatUsd = (value, compact = false) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: n < 1 ? 8 : 2
    }).format(n);
};

const formatVol = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(n);
};

const formatPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
};

const formatAge = (dateString) => {
    if (!dateString) return '-';
    const created = new Date(dateString);
    const now = new Date();
    const diffMs = now - created;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) return `${Math.floor(diffHours)}h`;
    const diffDays = diffHours / 24;
    if (diffDays < 30) return `${Math.floor(diffDays)}d`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
};

// Threat Emoji Logic
const getThreatEmoji = (level) => {
    if (level === 'HIGH') return '🔴';
    if (level === 'MODERATE') return '🟡';
    if (level === 'LOW') return '🔵'; // As requested
    return '🟢'; // Default safe
};

const TokenTable = () => {
    const {
        tokens,
        currentSort,
        setSort,
        selectToken,
        selectedToken,
        loading,
        error,
        searchQuery
    } = useTokenStore();

    const [expandedRowId, setExpandedRowId] = useState(null);

    // Filter tokens by search query
    const filteredTokens = tokens.filter(token => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            token.name?.toLowerCase().includes(query) ||
            token.symbol?.toLowerCase().includes(query) ||
            token.contract?.toLowerCase().includes(query)
        );
    });

    const toggleExpand = (e, id) => {
        e.stopPropagation();
        setExpandedRowId(expandedRowId === id ? null : id);
    };

    const handleSort = (field) => {
        setSort(field);
    };

    const renderSortArrow = (field) => {
        return currentSort === field ? <span className="sort-active">▼</span> : <span className="sort-hint">▼</span>;
    };

    if (loading) return <div className="table-empty">Loading market data...</div>;
    if (error) return <div className="table-empty error">{error}</div>;
    if (!loading && tokens.length === 0) return <div className="table-empty">No tokens found.</div>;
    if (filteredTokens.length === 0) return <div className="table-empty">No tokens match "{searchQuery}"</div>;

    return (
        <div className="table-container">
            {/* Header */}
            {/* Header */}
            <div className="table-header-row user-layout">
                <div className="col-token">Token</div>
                <div className="col-metric clickable" onClick={() => handleSort('price')}>
                    Price {renderSortArrow('price')}
                </div>
                <div className="col-metric clickable" onClick={() => handleSort('marketCap')}>
                    Market Cap {renderSortArrow('marketCap')}
                </div>
                <div className="col-metric clickable" onClick={() => handleSort('liquidity')}>
                    Liquidity {renderSortArrow('liquidity')}
                </div>
            </div>

            {/* Body */}
            <div className="table-body">
                {filteredTokens.map((token) => {
                    const isSelected = selectedToken?.id === token.id;
                    const isExpanded = expandedRowId === token.id;
                    const threatLevel = token.threatLevel || 'LOW';

                    // Calculate Sentiment
                    const totalTx = (token.buys24h || 0) + (token.sells24h || 0);
                    const buyPercent = totalTx > 0 ? ((token.buys24h || 0) / totalTx) * 100 : 50;

                    return (
                        <div key={`${token.id}-${token.updatedAt || 'static'}`} className={`table-row-group ${isSelected ? 'selected' : ''}`}>
                            <div
                                className="table-row-primary user-layout"
                                onClick={() => selectToken(token)}
                            >
                                {/* Token Identity */}
                                <div className="col-token">
                                    <div className="token-logo">
                                        {token.logoUrl ? <img src={token.logoUrl} alt="" /> : <div className="logo-placeholder">{token.symbol?.[0] || '?'}</div>}
                                    </div>
                                    <div className="token-meta">
                                        <span className="token-sym">{token.symbol}</span>
                                        <span className="token-name">{token.name}</span>
                                    </div>
                                </div>

                                {/* Metrics */}
                                <div className="col-metric strong">{formatUsd(token.price)}</div>
                                <div className="col-metric">{formatVol(token.marketCap)}</div>
                                <div className="col-metric">{formatVol(token.liquidity)}</div>

                                <div className="col-metric">{formatVol(token.liquidity)}</div>
                                <div className="col-metric">{formatVol(token.liquidity)}</div>

                                {/* Expand Toggle */}
                                <div className="col-expand" onClick={(e) => toggleExpand(e, token.id)}>
                                    {isExpanded ? '▲' : '▼'}
                                </div>
                            </div>

                            {/* Expanded Details - Keeping extra info here */}
                            {
                                isExpanded && (
                                    <div className="table-row-details">
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Price Δ24h</label>
                                                <span className={token.priceChange24h >= 0 ? 'positive' : 'negative'}>
                                                    {formatPercent(token.priceChange24h)}
                                                </span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Vol Δ24h</label>
                                                <span className={token.volumeChange24h >= 0 ? 'positive' : 'negative'}>
                                                    {formatPercent(token.volumeChange24h)}
                                                </span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Momentum</label>
                                                <span>{token.momentumScore || 0}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Contract</label>
                                                <span className="mono">{token.contract?.slice(0, 6)}...{token.contract?.slice(-4)}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Liq/MC Ratio</label>
                                                <span>{token.convictionRatio ? token.convictionRatio.toFixed(2) : '0'}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    );
                })}
            </div>
        </div >
    );
};

export default TokenTable;
