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

// Score color logic based on the specified formulas
const getMomentumColor = (score) => {
    // Green: >15%, Red: <-10%
    if (score >= 15) return 'score-green';
    if (score >= 5) return 'score-blue';
    if (score >= -5) return 'score-neutral';
    if (score >= -10) return 'score-yellow';
    return 'score-red';
};

const getConvictionColor = (ratio) => {
    // Green: ≥15%, Red: <3%
    if (ratio >= 15) return 'score-green';
    if (ratio >= 8) return 'score-blue';
    if (ratio >= 3) return 'score-yellow';
    return 'score-red';
};

const getThreatColor = (level) => {
    // Inverted - LOW is good, HIGH is bad
    if (level === 'LOW') return 'threat-clean';
    if (level === 'MODERATE') return 'threat-mod';
    return 'threat-high';
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
            <div className="table-header-row">
                <div className="col-token">Token</div>
                <div className="col-metric clickable" onClick={() => handleSort('price')}>
                    Price {renderSortArrow('price')}
                </div>
                <div className="col-metric clickable" onClick={() => handleSort('liquidity')}>
                    Liquidity {renderSortArrow('liquidity')}
                </div>
                <div className="col-metric clickable" onClick={() => handleSort('volume')}>
                    24h Vol {renderSortArrow('volume')}
                </div>
                <div className="col-score">Momentum</div>
                <div className="col-score">Conviction</div>
                <div className="col-threat">Threat</div>
            </div>

            {/* Body */}
            <div className="table-body">
                {filteredTokens.map((token) => {
                    const isSelected = selectedToken?.id === token.id;
                    const isExpanded = expandedRowId === token.id;

                    // Get scores with fallbacks
                    const momentumScore = token.momentumScore ?? 0;
                    const convictionRatio = token.convictionRatio ?? 0;
                    const convictionScore = token.convictionScore ?? 0;
                    const threatLevel = token.threatLevel || 'LOW';
                    const threatScore = token.threatScore ?? 100;

                    return (
                        <div key={token.id} className={`table-row-group ${isSelected ? 'selected' : ''}`}>
                            <div
                                className="table-row-primary"
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
                                <div className="col-metric">{formatVol(token.liquidity)}</div>
                                <div className="col-metric">{formatVol(token.volume24h)}</div>

                                {/* Momentum Score: (PriceChange + VolumeChange) / 2 */}
                                <div className="col-score">
                                    <div className={`score-pill ${getMomentumColor(momentumScore)}`}>
                                        {formatPercent(momentumScore)}
                                    </div>
                                </div>

                                {/* Conviction Score: (Liquidity / MarketCap) × 100 */}
                                <div className="col-score">
                                    <div className={`score-pill ${getConvictionColor(convictionRatio)}`}>
                                        {convictionRatio.toFixed(1)}%
                                    </div>
                                </div>

                                {/* Threat Score: 100 - penalties */}
                                <div className="col-threat">
                                    <span className={getThreatColor(threatLevel)}>
                                        {threatLevel === 'LOW' && '✓'}
                                        {threatLevel === 'MODERATE' && '⚠'}
                                        {threatLevel === 'HIGH' && '⛔'}
                                    </span>
                                </div>

                                {/* Expand Toggle */}
                                <div className="col-expand" onClick={(e) => toggleExpand(e, token.id)}>
                                    {isExpanded ? '▲' : '▼'}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="table-row-details">
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <label>Market Cap</label>
                                            <span>{formatVol(token.marketCap)}</span>
                                        </div>
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
                                            <label>Safety Score</label>
                                            <span>{threatScore}/100</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Contract</label>
                                            <span className="mono">{token.contract?.slice(0, 6)}...{token.contract?.slice(-4)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label>Liq/MC Ratio</label>
                                            <span>{convictionRatio.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TokenTable;
